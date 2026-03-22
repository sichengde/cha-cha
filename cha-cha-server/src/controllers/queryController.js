const { v4: uuidv4 } = require('uuid')
const { query, queryOne, remove, transaction } = require('../config/database')
const {
  getQueryMiniProgramPath,
  generateQueryUrlLink,
  generateQueryQrCodeBuffer
} = require('../services/wechatService')
const { readFileData } = require('./fileController')

function toMySQLDateTime(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1'
}

const createQueryPage = async (req, res) => {
  try {
    const userId = req.user.id
    const { name, description, allow_modify, enable_sign, require_nickname, query_limit, headers, file_id, header_row_index, start_time, end_time } = req.body

    if (!name || !Array.isArray(headers) || headers.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      })
    }

    if (!file_id) {
      return res.status(400).json({
        success: false,
        message: '缺少文件ID'
      })
    }

    let fileData
    try {
      fileData = readFileData(file_id, header_row_index)
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: '文件不存在或已过期，请重新上传'
      })
    }

    const { data } = fileData

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: '文件数据为空'
      })
    }

    const startTime = toMySQLDateTime(start_time)
    const endTime = toMySQLDateTime(end_time)
    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({
        success: false,
        message: '结束时间必须晚于开始时间'
      })
    }

    const queryLimit = Math.max(parseInt(query_limit, 10) || 0, 0)
    const queryPageId = uuidv4()

    await transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO query_pages
          (id, user_id, name, description, status, allow_modify, enable_sign, require_nickname, query_limit, start_time, end_time)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
        [
          queryPageId,
          userId,
          name,
          description || '',
          toBoolean(allow_modify),
          toBoolean(enable_sign),
          toBoolean(require_nickname),
          queryLimit,
          startTime,
          endTime
        ]
      )

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i] || {}
        const columnName = (header.column_name || '').toString().trim()
        if (!columnName) {
          throw new Error(`第${i + 1}列表头名称不能为空`)
        }

        const columnIndex = Number.isInteger(header.column_index) ? header.column_index : i
        await conn.execute(
          `INSERT INTO query_headers
            (query_page_id, column_index, column_name, is_condition, is_modifiable, is_hidden)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            queryPageId,
            columnIndex,
            columnName,
            toBoolean(header.is_condition),
            toBoolean(header.is_modifiable),
            toBoolean(header.is_hidden)
          ]
        )
      }

      const batchSize = 500
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize)
        const values = []
        const placeholders = []
        
        for (let j = 0; j < batch.length; j++) {
          const row = Array.isArray(batch[j]) ? batch[j] : []
          const rowIndex = i + j
          const jsonStr = JSON.stringify(row)
          placeholders.push('(?, ?, ?, ?)')
          values.push(queryPageId, rowIndex, jsonStr, jsonStr)
        }
        
        if (placeholders.length > 0) {
          const sql = `INSERT INTO query_data (query_page_id, row_index, data, original_data) VALUES ${placeholders.join(', ')}`
          await conn.execute(sql, values)
        }
      }
    })

    res.json({
      success: true,
      data: {
        id: queryPageId,
        message: '创建成功'
      }
    })
  } catch (error) {
    console.error('创建查询页面失败:', error)
    res.status(500).json({
      success: false,
      message: '创建查询页面失败'
    })
  }
}

const getQueryPage = async (req, res) => {
  try {
    const { id } = req.params

    const queryPage = await queryOne(
      `SELECT qp.*, 
              (SELECT COUNT(*) FROM query_records qr WHERE qr.query_page_id = qp.id) as query_count,
              (SELECT COUNT(*) FROM signatures s WHERE s.query_page_id = qp.id) as sign_count
       FROM query_pages qp WHERE qp.id = ?`,
      [id]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在'
      })
    }

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const conditions = headers
      .filter(h => h.is_condition === 1 || h.is_condition === true)
      .map(h => h.column_index)

    const dataCount = await queryOne(
      'SELECT COUNT(*) as count FROM query_data WHERE query_page_id = ?',
      [id]
    )

    queryPage.settings = {
      allowModify: queryPage.allow_modify,
      enableSign: queryPage.enable_sign,
      requireNickname: queryPage.require_nickname,
      queryLimit: queryPage.query_limit,
      conditions: conditions
    }

    queryPage.headers = headers
    queryPage.data_count = dataCount.count

    res.json({
      success: true,
      data: queryPage
    })
  } catch (error) {
    console.error('获取查询页面失败:', error)
    res.status(500).json({
      success: false,
      message: '获取查询页面失败'
    })
  }
}

const getMyQueryPages = async (req, res) => {
  try {
    const userId = req.user.id
    const { status, page = 1, pageSize = 10 } = req.query

    let sql = `SELECT qp.*, 
                (SELECT COUNT(*) FROM query_records qr WHERE qr.query_page_id = qp.id) as query_count,
                (SELECT COUNT(*) FROM signatures s WHERE s.query_page_id = qp.id) as sign_count,
                (SELECT COUNT(*) FROM query_data qd WHERE qd.query_page_id = qp.id) as total_count
         FROM query_pages qp WHERE qp.user_id = ?`
    const params = [userId]

    if (status && status !== 'all') {
      sql += ' AND qp.status = ?'
      params.push(status)
    }

    sql += ' ORDER BY qp.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))

    const queryPages = await query(sql, params)

    for (const page of queryPages) {
      page.settings = {
        allowModify: page.allow_modify,
        enableSign: page.enable_sign,
        requireNickname: page.require_nickname,
        queryLimit: page.query_limit
      }
    }

    const totalResult = await queryOne(
      `SELECT COUNT(*) as total FROM query_pages WHERE user_id = ?${status && status !== 'all' ? ' AND status = ?' : ''}`,
      status && status !== 'all' ? [userId, status] : [userId]
    )

    res.json({
      success: true,
      data: {
        list: queryPages,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取我的查询页面失败:', error)
    res.status(500).json({
      success: false,
      message: '获取我的查询页面失败'
    })
  }
}

const updateQueryPage = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const {
      name,
      description,
      status,
      allow_modify,
      enable_sign,
      require_nickname,
      query_limit,
      start_time,
      end_time,
      headers
    } = req.body

    const existingPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!existingPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (allow_modify !== undefined) updateData.allow_modify = toBoolean(allow_modify)
    if (enable_sign !== undefined) updateData.enable_sign = toBoolean(enable_sign)
    if (require_nickname !== undefined) updateData.require_nickname = toBoolean(require_nickname)
    if (query_limit !== undefined) updateData.query_limit = Math.max(parseInt(query_limit, 10) || 0, 0)
    if (Object.prototype.hasOwnProperty.call(req.body, 'start_time')) updateData.start_time = toMySQLDateTime(start_time)
    if (Object.prototype.hasOwnProperty.call(req.body, 'end_time')) updateData.end_time = toMySQLDateTime(end_time)

    const finalStartTime = Object.prototype.hasOwnProperty.call(updateData, 'start_time')
      ? updateData.start_time
      : existingPage.start_time
    const finalEndTime = Object.prototype.hasOwnProperty.call(updateData, 'end_time')
      ? updateData.end_time
      : existingPage.end_time

    if (finalStartTime && finalEndTime && new Date(finalStartTime) >= new Date(finalEndTime)) {
      return res.status(400).json({
        success: false,
        message: '结束时间必须晚于开始时间'
      })
    }

    const hasHeadersUpdate = Array.isArray(headers) && headers.length > 0
    if (Object.keys(updateData).length === 0 && !hasHeadersUpdate) {
      return res.status(400).json({
        success: false,
        message: '没有可更新的内容'
      })
    }

    await transaction(async (conn) => {
      if (Object.keys(updateData).length > 0) {
        const fields = Object.keys(updateData)
        const values = fields.map((field) => updateData[field])
        const setSql = fields.map((field) => `${field} = ?`).join(', ')
        await conn.execute(
          `UPDATE query_pages SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
          values.concat([id, userId])
        )
      }

      if (hasHeadersUpdate) {
        const [existingHeaders] = await conn.execute(
          'SELECT * FROM query_headers WHERE query_page_id = ?',
          [id]
        )

        const existingByIndex = {}
        existingHeaders.forEach((header) => {
          existingByIndex[header.column_index] = header
        })

        for (let i = 0; i < headers.length; i++) {
          const incoming = headers[i] || {}
          const columnIndex = Number.isInteger(incoming.column_index) ? incoming.column_index : i
          const existHeader = existingByIndex[columnIndex]
          const columnName = (incoming.column_name || (existHeader && existHeader.column_name) || '').toString().trim()

          if (!columnName) {
            throw new Error(`第${i + 1}列表头名称不能为空`)
          }

          const isCondition = incoming.is_condition !== undefined
            ? toBoolean(incoming.is_condition)
            : (existHeader ? toBoolean(existHeader.is_condition) : false)
          const isModifiable = incoming.is_modifiable !== undefined
            ? toBoolean(incoming.is_modifiable)
            : (existHeader ? toBoolean(existHeader.is_modifiable) : false)
          const isHidden = incoming.is_hidden !== undefined
            ? toBoolean(incoming.is_hidden)
            : (existHeader ? toBoolean(existHeader.is_hidden) : false)

          if (existHeader) {
            await conn.execute(
              `UPDATE query_headers
                  SET column_name = ?, is_condition = ?, is_modifiable = ?, is_hidden = ?
                WHERE id = ?`,
              [columnName, isCondition, isModifiable, isHidden, existHeader.id]
            )
          } else {
            await conn.execute(
              `INSERT INTO query_headers
                (query_page_id, column_index, column_name, is_condition, is_modifiable, is_hidden)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [id, columnIndex, columnName, isCondition, isModifiable, isHidden]
            )
          }
        }
      }
    })

    res.json({
      success: true,
      message: '更新成功'
    })
  } catch (error) {
    console.error('更新查询页面失败:', error)
    res.status(500).json({
      success: false,
      message: '更新查询页面失败'
    })
  }
}

const deleteQueryPage = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const existingPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!existingPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    await remove('query_pages', 'id = ?', [id])

    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('删除查询页面失败:', error)
    res.status(500).json({
      success: false,
      message: '删除查询页面失败'
    })
  }
}

const getQueryShareInfo = async (req, res) => {
  try {
    const { id } = req.params
    const queryPage = await queryOne(
      'SELECT id, name FROM query_pages WHERE id = ?',
      [id]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在'
      })
    }

    const miniProgramPath = getQueryMiniProgramPath(id)
    let urlLink = ''
    let fallbackMessage = ''
    try {
      urlLink = await generateQueryUrlLink(id)
    } catch (error) {
      fallbackMessage = error.message || '生成小程序链接失败'
    }

    res.json({
      success: true,
      data: {
        id: queryPage.id,
        name: queryPage.name || '',
        path: miniProgramPath,
        url_link: urlLink,
        copy_link: urlLink || miniProgramPath,
        fallback_message: fallbackMessage
      }
    })
  } catch (error) {
    console.error('获取查询分享信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取分享信息失败'
    })
  }
}

const getQueryQrCode = async (req, res) => {
  try {
    const { id } = req.params
    const queryPage = await queryOne(
      'SELECT id FROM query_pages WHERE id = ?',
      [id]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在'
      })
    }

    const qrCodeBuffer = await generateQueryQrCodeBuffer(id)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    res.send(qrCodeBuffer)
  } catch (error) {
    console.error('生成查询二维码失败:', error)
    const message = error.message || '生成二维码失败'
    const statusCode = error.code === 'WECHAT_CONFIG_MISSING' ? 400 : 500
    res.status(statusCode).json({
      success: false,
      message: message
    })
  }
}

module.exports = {
  createQueryPage,
  getQueryPage,
  getMyQueryPages,
  updateQueryPage,
  deleteQueryPage,
  getQueryShareInfo,
  getQueryQrCode
}
