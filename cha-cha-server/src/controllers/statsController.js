const { query, queryOne } = require('../config/database')
const { parseJson } = require('../utils/json')

const getPaging = (rawPage, rawPageSize) => {
  const page = Math.max(parseInt(rawPage, 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(rawPageSize, 10) || 20, 1), 200)
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset }
}

const ensureOwner = async (queryPageId, userId) => {
  return queryOne(
    'SELECT id, allow_modify, enable_sign FROM query_pages WHERE id = ? AND user_id = ?',
    [queryPageId, userId]
  )
}

const getHeaders = async (queryPageId) => {
  return query(
    'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
    [queryPageId]
  )
}

const formatListRows = (rows, headers, getMeta) => {
  return rows.map((row) => {
    const data = parseJson(row.data, {})
    const result = {}

    headers.forEach((h) => {
      result[h.column_name] = data[h.column_index]
    })

    const meta = getMeta(row)
    result._queried = Boolean(meta.queried)
    result._signed = Boolean(meta.signed)
    result._queryTime = meta.queryTime || ''

    return result
  })
}

const getStatistics = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const queryPage = await ensureOwner(id, userId)

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const totalData = await queryOne(
      'SELECT COUNT(*) as count FROM query_data WHERE query_page_id = ?',
      [id]
    )

    const queriedData = await queryOne(
      'SELECT COUNT(DISTINCT query_data_id) as count FROM query_records WHERE query_page_id = ?',
      [id]
    )

    const signedData = await queryOne(
      'SELECT COUNT(*) as count FROM signatures WHERE query_page_id = ?',
      [id]
    )

    const totalQueries = await queryOne(
      'SELECT COUNT(*) as count FROM query_records WHERE query_page_id = ?',
      [id]
    )

    const dailyQueries = await query(
      `SELECT DATE(query_time) as date, COUNT(*) as count 
       FROM query_records 
       WHERE query_page_id = ? 
       GROUP BY DATE(query_time) 
       ORDER BY date DESC 
       LIMIT 30`,
      [id]
    )

    const hourlyQueries = await query(
      `SELECT HOUR(query_time) as hour, COUNT(*) as count 
       FROM query_records 
       WHERE query_page_id = ? 
       GROUP BY HOUR(query_time) 
       ORDER BY hour`,
      [id]
    )

    const recentQueries = await query(
      `SELECT qr.query_time, qd.data 
       FROM query_records qr 
       JOIN query_data qd ON qr.query_data_id = qd.id 
       WHERE qr.query_page_id = ? 
       ORDER BY qr.query_time DESC 
       LIMIT 20`,
      [id]
    )

    const headers = await getHeaders(id)

    const recentQueriesFormatted = recentQueries.map(q => {
      const data = parseJson(q.data, {})
      const result = {}
      headers.forEach(h => {
        result[h.column_name] = data[h.column_index]
      })
      return {
        ...result,
        query_time: q.query_time
      }
    })

    res.json({
      success: true,
      data: {
        summary: {
          totalData: totalData.count,
          queriedData: queriedData.count,
          unqueriedData: totalData.count - queriedData.count,
          signedData: signedData.count,
          unsignedData: totalData.count - signedData.count,
          totalQueries: totalQueries.count,
          queryRate: totalData.count > 0 ? ((queriedData.count / totalData.count) * 100).toFixed(1) : 0,
          signRate: totalData.count > 0 ? ((signedData.count / totalData.count) * 100).toFixed(1) : 0
        },
        dailyQueries,
        hourlyQueries,
        recentQueries: recentQueriesFormatted
      }
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    })
  }
}

const getAllDataList = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page, pageSize, offset } = getPaging(req.query.page, req.query.pageSize)

    const queryPage = await ensureOwner(id, userId)

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await getHeaders(id)

    const allData = await query(
      `SELECT qd.*, 
              (SELECT COUNT(*) FROM query_records qr WHERE qr.query_data_id = qd.id AND qr.query_page_id = qd.query_page_id) as query_count,
              (SELECT MAX(qr.query_time) FROM query_records qr WHERE qr.query_data_id = qd.id AND qr.query_page_id = qd.query_page_id) as latest_query_time,
              (SELECT COUNT(*) FROM signatures s WHERE s.query_data_id = qd.id AND s.query_page_id = qd.query_page_id) as sign_count
       FROM query_data qd 
       WHERE qd.query_page_id = ?
       ORDER BY qd.row_index 
       LIMIT ? OFFSET ?`,
      [id, pageSize, offset]
    )

    const totalResult = await queryOne(
      'SELECT COUNT(*) as total FROM query_data WHERE query_page_id = ?',
      [id]
    )

    const formattedData = formatListRows(allData, headers, (row) => ({
      queried: row.query_count > 0,
      signed: row.sign_count > 0,
      queryTime: row.latest_query_time
    }))

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('获取全部数据列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取数据列表失败'
    })
  }
}

const getQueriedList = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page, pageSize, offset } = getPaging(req.query.page, req.query.pageSize)

    const queryPage = await ensureOwner(id, userId)
    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await getHeaders(id)

    const queriedData = await query(
      `SELECT qd.*, qr.latest_query_time,
              (SELECT COUNT(*) FROM signatures s WHERE s.query_data_id = qd.id AND s.query_page_id = qd.query_page_id) as sign_count
       FROM query_data qd
       INNER JOIN (
         SELECT query_data_id, MAX(query_time) as latest_query_time
         FROM query_records
         WHERE query_page_id = ?
         GROUP BY query_data_id
       ) qr ON qd.id = qr.query_data_id
       WHERE qd.query_page_id = ?
       ORDER BY qd.row_index
       LIMIT ? OFFSET ?`,
      [id, id, pageSize, offset]
    )

    const totalResult = await queryOne(
      `SELECT COUNT(*) as total
       FROM (
         SELECT query_data_id
         FROM query_records
         WHERE query_page_id = ?
         GROUP BY query_data_id
       ) t`,
      [id]
    )

    const formattedData = formatListRows(queriedData, headers, (row) => ({
      queried: true,
      signed: row.sign_count > 0,
      queryTime: row.latest_query_time
    }))

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('获取已查询列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取已查询列表失败'
    })
  }
}

const getUnqueriedList = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page, pageSize, offset } = getPaging(req.query.page, req.query.pageSize)

    const queryPage = await ensureOwner(id, userId)

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await getHeaders(id)

    const unqueriedData = await query(
      `SELECT qd.* 
       FROM query_data qd 
       WHERE qd.query_page_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM query_records qr
           WHERE qr.query_data_id = qd.id AND qr.query_page_id = qd.query_page_id
         )
       ORDER BY qd.row_index 
       LIMIT ? OFFSET ?`,
      [id, pageSize, offset]
    )

    const totalResult = await queryOne(
      `SELECT COUNT(*) as total 
       FROM query_data qd 
       WHERE qd.query_page_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM query_records qr
           WHERE qr.query_data_id = qd.id AND qr.query_page_id = qd.query_page_id
         )`,
      [id]
    )

    const formattedData = formatListRows(unqueriedData, headers, () => ({
      queried: false,
      signed: false,
      queryTime: ''
    }))

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('获取未查询列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取未查询列表失败'
    })
  }
}

const getSignedList = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page, pageSize, offset } = getPaging(req.query.page, req.query.pageSize)

    const queryPage = await ensureOwner(id, userId)
    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await getHeaders(id)

    const signedData = await query(
      `SELECT qd.*, s.signed_at
       FROM query_data qd
       INNER JOIN signatures s
         ON qd.id = s.query_data_id
        AND s.query_page_id = qd.query_page_id
       WHERE qd.query_page_id = ?
       ORDER BY qd.row_index
       LIMIT ? OFFSET ?`,
      [id, pageSize, offset]
    )

    const totalResult = await queryOne(
      'SELECT COUNT(*) as total FROM signatures WHERE query_page_id = ?',
      [id]
    )

    const formattedData = formatListRows(signedData, headers, (row) => ({
      queried: true,
      signed: true,
      queryTime: row.signed_at
    }))

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('获取已签收列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取已签收列表失败'
    })
  }
}

const getUnsignedList = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page, pageSize, offset } = getPaging(req.query.page, req.query.pageSize)

    const queryPage = await ensureOwner(id, userId)

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await getHeaders(id)

    const unsignedData = await query(
      `SELECT qd.*,
              (SELECT COUNT(*) FROM query_records qr WHERE qr.query_data_id = qd.id AND qr.query_page_id = qd.query_page_id) as query_count,
              (SELECT MAX(qr.query_time) FROM query_records qr WHERE qr.query_data_id = qd.id AND qr.query_page_id = qd.query_page_id) as latest_query_time
       FROM query_data qd 
       WHERE qd.query_page_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM signatures s
           WHERE s.query_data_id = qd.id AND s.query_page_id = qd.query_page_id
         )
       ORDER BY qd.row_index 
       LIMIT ? OFFSET ?`,
      [id, pageSize, offset]
    )

    const totalResult = await queryOne(
      `SELECT COUNT(*) as total 
       FROM query_data qd 
       WHERE qd.query_page_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM signatures s
           WHERE s.query_data_id = qd.id AND s.query_page_id = qd.query_page_id
         )`,
      [id]
    )

    const formattedData = formatListRows(unsignedData, headers, (row) => ({
      queried: row.query_count > 0,
      signed: false,
      queryTime: row.latest_query_time
    }))

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('获取未签收列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取未签收列表失败'
    })
  }
}

module.exports = {
  getStatistics,
  getAllDataList,
  getQueriedList,
  getUnqueriedList,
  getSignedList,
  getUnsignedList
}
