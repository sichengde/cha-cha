const { query, queryOne, insert, update } = require('../config/database')
const { parseJson } = require('../utils/json')

const isTrue = (value) => value === 1 || value === true || value === '1'

const queryData = async (req, res) => {
  try {
    const { id } = req.params
    const conditions = req.body.conditions || {}
    const now = new Date()

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ?',
      [id]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在'
      })
    }

    if (queryPage.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: '查询已结束'
      })
    }

    if (queryPage.start_time && new Date(queryPage.start_time) > now) {
      return res.status(400).json({
        success: false,
        message: '查询未开始'
      })
    }

    if (queryPage.end_time && new Date(queryPage.end_time) < now) {
      return res.status(400).json({
        success: false,
        message: '查询已过期'
      })
    }

    const openid = req.user?.openid || ''
    const queryLimit = Number(queryPage.query_limit) || 0
    const requiresAuth = queryPage.require_nickname === 1 || queryPage.require_nickname === true || queryLimit > 0

    if (requiresAuth && !openid) {
      return res.status(401).json({
        success: false,
        message: '请先登录后查询'
      })
    }

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? AND is_condition = 1 ORDER BY column_index',
      [id]
    )

    if (headers.length === 0) {
      return res.status(400).json({
        success: false,
        message: '未设置查询条件'
      })
    }

    let sql = 'SELECT * FROM query_data WHERE query_page_id = ?'
    const params = [id]

    for (const header of headers) {
      const inputValue = conditions[header.column_name]
      const value = typeof inputValue === 'string' ? inputValue.trim() : inputValue

      if (value === undefined || value === null || value === '') {
        return res.status(400).json({
          success: false,
          message: `请输入${header.column_name}`
        })
      }

      const normalizedValue = String(value).trim()
      const columnIndex = Number(header.column_index)
      const arrayPath = `$[${columnIndex}]`
      const objectPath = `$.${columnIndex}`

      // 兼容 data 存成数组($[n])和对象($.n)两种历史格式。
      sql += ` AND TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, ?)), JSON_UNQUOTE(JSON_EXTRACT(data, ?)), '')) = ?`
      params.push(arrayPath, objectPath, normalizedValue)
    }

    const dataRow = await queryOne(sql, params)

    if (!dataRow) {
      return res.status(404).json({
        success: false,
        message: '未找到匹配的数据，请检查查询条件'
      })
    }

    if (openid) {
      const existingRecord = await queryOne(
        'SELECT * FROM query_records WHERE query_page_id = ? AND query_data_id = ? AND openid = ?',
        [id, dataRow.id, openid]
      )

      if (queryLimit > 0 && existingRecord && existingRecord.query_count >= queryLimit) {
        return res.status(429).json({
          success: false,
          message: '查询次数已达上限'
        })
      }

      if (existingRecord) {
        // 原子递增，避免竞态条件
        if (queryLimit > 0) {
          const result = await query(
            'UPDATE `query_records` SET `query_count` = `query_count` + 1, `query_time` = NOW() WHERE id = ? AND `query_count` < ?',
            [existingRecord.id, queryLimit]
          )
          if (result.affectedRows === 0) {
            return res.status(429).json({
              success: false,
              message: '查询次数已达上限'
            })
          }
        } else {
          await query(
            'UPDATE `query_records` SET `query_count` = `query_count` + 1, `query_time` = NOW() WHERE id = ?',
            [existingRecord.id]
          )
        }
      } else {
        try {
          await insert('query_records', {
            query_page_id: id,
            query_data_id: dataRow.id,
            openid,
            query_count: 1
          })
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            // 并发插入冲突，改为原子递增
            await query(
              'UPDATE `query_records` SET `query_count` = `query_count` + 1, `query_time` = NOW() WHERE query_page_id = ? AND query_data_id = ? AND openid = ?',
              [id, dataRow.id, openid]
            )
          } else {
            throw error
          }
        }
      }
    }

    const allHeaders = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const signedRecord = await queryOne(
      'SELECT id FROM signatures WHERE query_page_id = ? AND query_data_id = ?',
      [id, dataRow.id]
    )

    const rowData = parseJson(dataRow.data, {})
    const allowModify = isTrue(queryPage.allow_modify)

    const resultData = allHeaders.map(h => ({
      label: h.column_name,
      value: rowData[h.column_index],
      is_modifiable: isTrue(h.is_modifiable),
      is_hidden: isTrue(h.is_hidden)
    })).filter(item => !item.is_hidden)

    let modifiableHeaders = allHeaders.filter(h => isTrue(h.is_modifiable) && !isTrue(h.is_hidden))
    if (allowModify && modifiableHeaders.length === 0) {
      modifiableHeaders = allHeaders.filter(h => !isTrue(h.is_hidden) && !isTrue(h.is_condition))
      if (modifiableHeaders.length === 0) {
        modifiableHeaders = allHeaders.filter(h => !isTrue(h.is_hidden))
      }
    }

    const modifiableFields = modifiableHeaders.map(h => ({
      label: h.column_name,
      value: rowData[h.column_index],
      newValue: ''
    }))

    res.json({
      success: true,
      data: {
        queryDataId: dataRow.id,
        resultData,
        modifiableFields,
        allowModify: allowModify,
        enableSign: isTrue(queryPage.enable_sign),
        signType: 'button',
        signed: Boolean(signedRecord)
      }
    })
  } catch (error) {
    console.error('查询数据失败:', error)
    res.status(500).json({
      success: false,
      message: '查询数据失败'
    })
  }
}

const modifyData = async (req, res) => {
  try {
    const { id, dataId } = req.params
    const { modifications } = req.body
    const modifierId = req.user?.id || req.user?.openid || ''
    const openid = req.user?.openid || ''

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ?',
      [id]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在'
      })
    }

    if (!isTrue(queryPage.allow_modify)) {
      return res.status(400).json({
        success: false,
        message: '不允许修改数据'
      })
    }

    // 验证用户是否查询过此数据（防止越权修改）
    if (openid) {
      const hasQueried = await queryOne(
        'SELECT 1 FROM query_records WHERE query_page_id = ? AND query_data_id = ? AND openid = ?',
        [id, dataId, openid]
      )
      if (!hasQueried) {
        return res.status(403).json({
          success: false,
          message: '无权修改此数据'
        })
      }
    }

    if (!Array.isArray(modifications) || modifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: '修改内容不能为空'
      })
    }

    const dataRow = await queryOne(
      'SELECT * FROM query_data WHERE id = ? AND query_page_id = ?',
      [dataId, id]
    )

    if (!dataRow) {
      return res.status(404).json({
        success: false,
        message: '数据不存在'
      })
    }

    let modifiableHeaders = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? AND is_modifiable = 1',
      [id]
    )

    if (modifiableHeaders.length === 0) {
      modifiableHeaders = await query(
        'SELECT * FROM query_headers WHERE query_page_id = ? AND is_hidden = 0 AND is_condition = 0 ORDER BY column_index',
        [id]
      )

      if (modifiableHeaders.length === 0) {
        modifiableHeaders = await query(
          'SELECT * FROM query_headers WHERE query_page_id = ? AND is_hidden = 0 ORDER BY column_index',
          [id]
        )
      }
    }

    const modifiableColumns = modifiableHeaders.map(h => h.column_name)

    const currentData = parseJson(dataRow.data, {})
    let hasChanged = false

    for (const mod of modifications) {
      if (!mod || typeof mod.column !== 'string') {
        continue
      }

      if (!modifiableColumns.includes(mod.column)) {
        continue
      }

      const header = modifiableHeaders.find(h => h.column_name === mod.column)
      if (header) {
        const oldValue = currentData[header.column_index]
        const newValue = mod.newValue === undefined || mod.newValue === null ? '' : String(mod.newValue)
        if (String(oldValue) === newValue) {
          continue
        }

        currentData[header.column_index] = newValue

        await insert('data_modifications', {
          query_data_id: dataId,
          column_name: mod.column,
          old_value: oldValue,
          new_value: newValue,
          modified_by: modifierId
        })
        hasChanged = true
      }
    }

    if (!hasChanged) {
      return res.status(400).json({
        success: false,
        message: '没有可保存的修改内容'
      })
    }

    await update(
      'query_data',
      {
        data: JSON.stringify(currentData),
        is_modified: 1,
        modified_at: new Date()
      },
      'id = ?',
      [dataId]
    )

    res.json({
      success: true,
      message: '修改成功'
    })
  } catch (error) {
    console.error('修改数据失败:', error)
    res.status(500).json({
      success: false,
      message: '修改数据失败'
    })
  }
}

const signData = async (req, res) => {
  try {
    const { id, dataId } = req.params
    const { signType, signatureUrl } = req.body
    const openid = req.user?.openid || ''

    if (!openid) {
      return res.status(401).json({
        success: false,
        message: '未登录或登录已失效'
      })
    }

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ?',
      [id]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在'
      })
    }

    if (!(queryPage.enable_sign === 1 || queryPage.enable_sign === true)) {
      return res.status(400).json({
        success: false,
        message: '未开启签收功能'
      })
    }

    const dataRow = await queryOne(
      'SELECT * FROM query_data WHERE id = ? AND query_page_id = ?',
      [dataId, id]
    )

    if (!dataRow) {
      return res.status(404).json({
        success: false,
        message: '数据不存在'
      })
    }

    const existingSign = await queryOne(
      'SELECT * FROM signatures WHERE query_page_id = ? AND query_data_id = ?',
      [id, dataId]
    )

    if (existingSign) {
      return res.status(400).json({
        success: false,
        message: '已签收，请勿重复签收'
      })
    }

    try {
      await insert('signatures', {
        query_page_id: id,
        query_data_id: dataId,
        openid,
        sign_type: signType || 'button',
        signature_url: signatureUrl || ''
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: '已签收，请勿重复签收'
        })
      }
      throw error
    }

    res.json({
      success: true,
      message: '签收成功'
    })
  } catch (error) {
    console.error('签收失败:', error)
    res.status(500).json({
      success: false,
      message: '签收失败'
    })
  }
}

module.exports = {
  queryData,
  modifyData,
  signData
}
