const { v4: uuidv4 } = require('uuid')
const { query, queryOne, insert, update, remove } = require('../config/database')

function toMySQLDateTime(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

const createQueryPage = async (req, res) => {
  try {
    const userId = req.user.id
    const { name, description, allow_modify, enable_sign, require_nickname, query_limit, headers, data, start_time, end_time } = req.body

    if (!name || !headers || !data) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      })
    }

    const queryPageId = uuidv4()

    await insert('query_pages', {
      id: queryPageId,
      user_id: userId,
      name,
      description: description || '',
      status: 'active',
      allow_modify: allow_modify || false,
      enable_sign: enable_sign || false,
      require_nickname: require_nickname || false,
      query_limit: query_limit || 0,
      start_time: toMySQLDateTime(start_time),
      end_time: toMySQLDateTime(end_time)
    })

    for (let i = 0; i < headers.length; i++) {
      await insert('query_headers', {
        query_page_id: queryPageId,
        column_index: headers[i].column_index || i,
        column_name: headers[i].column_name,
        is_condition: headers[i].is_condition || false,
        is_modifiable: headers[i].is_modifiable || false,
        is_hidden: headers[i].is_hidden || false
      })
    }

    for (let i = 0; i < data.length; i++) {
      await insert('query_data', {
        query_page_id: queryPageId,
        row_index: i,
        data: JSON.stringify(data[i]),
        original_data: JSON.stringify(data[i])
      })
    }

    res.json({
      success: true,
      data: {
        id: queryPageId,
        message: '创建成功'
      }
    })
  } catch (error) {
    console.error('创建查询页面失败:', error)
    console.error('错误详情:', error.message)
    console.error('错误堆栈:', error.stack)
    res.status(500).json({
      success: false,
      message: '创建查询页面失败: ' + error.message
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
      .map((h, idx) => h.is_condition ? idx : -1)
      .filter(idx => idx !== -1)

    console.log('查询条件索引:', conditions)

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
    
    console.log('返回的settings:', queryPage.settings)
    
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
    console.log('getMyQueryPages called, user:', req.user)
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

    console.log('Executing SQL:', sql)
    console.log('Params:', params)

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

    console.log('Query result:', { listCount: queryPages.length, total: totalResult.total })

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
    console.error('Error stack:', error.stack)
    res.status(500).json({
      success: false,
      message: '获取我的查询页面失败',
      error: error.message
    })
  }
}

const updateQueryPage = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { name, description, status, settings, allow_modify, enable_sign, require_nickname, query_limit } = req.body

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
    if (allow_modify !== undefined) updateData.allow_modify = allow_modify
    if (enable_sign !== undefined) updateData.enable_sign = enable_sign
    if (require_nickname !== undefined) updateData.require_nickname = require_nickname
    if (query_limit !== undefined) updateData.query_limit = query_limit

    await update(
      'query_pages',
      updateData,
      'id = ?',
      [id]
    )

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

module.exports = {
  createQueryPage,
  getQueryPage,
  getMyQueryPages,
  updateQueryPage,
  deleteQueryPage
}
