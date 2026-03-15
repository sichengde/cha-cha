const { query, queryOne, insert, update } = require('../config/database')

const queryData = async (req, res) => {
  try {
    const { id } = req.params
    const conditions = req.body.conditions || {}

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

    if (queryPage.end_time && new Date(queryPage.end_time) < new Date()) {
      return res.status(400).json({
        success: false,
        message: '查询已过期'
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
      const value = conditions[header.column_name]
      if (value === undefined || value === '') {
        return res.status(400).json({
          success: false,
          message: `请输入${header.column_name}`
        })
      }
      sql += ` AND JSON_EXTRACT(data, '$.${header.column_index}') = ?`
      params.push(value)
    }

    const dataRow = await queryOne(sql, params)

    if (!dataRow) {
      return res.status(404).json({
        success: false,
        message: '未找到匹配的数据，请检查查询条件'
      })
    }

    const openid = req.headers['x-openid'] || req.user?.openid
    if (openid) {
      const existingRecord = await queryOne(
        'SELECT * FROM query_records WHERE query_page_id = ? AND query_data_id = ? AND openid = ?',
        [id, dataRow.id, openid]
      )

      if (existingRecord) {
        await update(
          'query_records',
          { query_count: existingRecord.query_count + 1, query_time: new Date() },
          'id = ?',
          [existingRecord.id]
        )
      } else {
        await insert('query_records', {
          query_page_id: id,
          query_data_id: dataRow.id,
          openid,
          query_count: 1
        })
      }
    }

    const allHeaders = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const data = JSON.parse(dataRow.data)
    const resultData = allHeaders.map(h => ({
      label: h.column_name,
      value: data[h.column_index],
      is_modifiable: h.is_modifiable === 1,
      is_hidden: h.is_hidden === 1
    })).filter(item => !item.is_hidden)

    const settings = JSON.parse(queryPage.settings || '{}')

    res.json({
      success: true,
      data: {
        queryDataId: dataRow.id,
        resultData,
        allowModify: settings.allowModify || false,
        enableSign: settings.enableSign || false,
        signType: settings.signType || 'button',
        signed: false
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
    const openid = req.headers['x-openid'] || req.user?.openid

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

    const settings = JSON.parse(queryPage.settings || '{}')
    if (!settings.allowModify) {
      return res.status(400).json({
        success: false,
        message: '不允许修改数据'
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

    const modifiableHeaders = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? AND is_modifiable = 1',
      [id]
    )

    const modifiableColumns = modifiableHeaders.map(h => h.column_name)

    const currentData = JSON.parse(dataRow.data)
    const originalData = JSON.parse(dataRow.original_data)

    for (const mod of modifications) {
      if (!modifiableColumns.includes(mod.column)) {
        continue
      }

      const header = modifiableHeaders.find(h => h.column_name === mod.column)
      if (header) {
        const oldValue = currentData[header.column_index]
        currentData[header.column_index] = mod.newValue

        await insert('data_modifications', {
          query_data_id: dataId,
          column_name: mod.column,
          old_value: oldValue,
          new_value: mod.newValue,
          modified_by: openid
        })
      }
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
    const openid = req.headers['x-openid'] || req.user?.openid

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

    const settings = JSON.parse(queryPage.settings || '{}')
    if (!settings.enableSign) {
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

    await insert('signatures', {
      query_page_id: id,
      query_data_id: dataId,
      openid,
      sign_type: signType || 'button',
      signature_url: signatureUrl || ''
    })

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
