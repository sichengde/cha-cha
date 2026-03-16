const { query, queryOne } = require('../config/database')

const getStatistics = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ? AND user_id = ?',
      [id, userId]
    )

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

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const recentQueriesFormatted = recentQueries.map(q => {
      const data = JSON.parse(q.data)
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
    const { page = 1, pageSize = 20 } = req.query

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const allData = await query(
      `SELECT qd.*, 
              (SELECT COUNT(*) FROM query_records qr WHERE qr.query_data_id = qd.id) as query_count,
              (SELECT COUNT(*) FROM signatures s WHERE s.query_data_id = qd.id) as sign_count
       FROM query_data qd 
       WHERE qd.query_page_id = ?
       ORDER BY qd.row_index 
       LIMIT ? OFFSET ?`,
      [id, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)]
    )

    const totalResult = await queryOne(
      'SELECT COUNT(*) as total FROM query_data WHERE query_page_id = ?',
      [id]
    )

    const formattedData = allData.map(row => {
      const data = JSON.parse(row.data)
      const result = {}
      headers.forEach(h => {
        result[h.column_name] = data[h.column_index]
      })
      result._queried = row.query_count > 0
      result._signed = row.sign_count > 0
      return result
    })

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
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

const getUnqueriedList = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page = 1, pageSize = 20 } = req.query

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const unqueriedData = await query(
      `SELECT qd.* 
       FROM query_data qd 
       LEFT JOIN query_records qr ON qd.id = qr.query_data_id 
       WHERE qd.query_page_id = ? AND qr.id IS NULL 
       ORDER BY qd.row_index 
       LIMIT ? OFFSET ?`,
      [id, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)]
    )

    const totalResult = await queryOne(
      `SELECT COUNT(*) as total 
       FROM query_data qd 
       LEFT JOIN query_records qr ON qd.id = qr.query_data_id 
       WHERE qd.query_page_id = ? AND qr.id IS NULL`,
      [id]
    )

    const formattedData = unqueriedData.map(row => {
      const data = JSON.parse(row.data)
      const result = {}
      headers.forEach(h => {
        result[h.column_name] = data[h.column_index]
      })
      return result
    })

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
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

const getUnsignedList = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { page = 1, pageSize = 20 } = req.query

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const unsignedData = await query(
      `SELECT qd.* 
       FROM query_data qd 
       LEFT JOIN signatures s ON qd.id = s.query_data_id 
       WHERE qd.query_page_id = ? AND s.id IS NULL 
       ORDER BY qd.row_index 
       LIMIT ? OFFSET ?`,
      [id, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)]
    )

    const totalResult = await queryOne(
      `SELECT COUNT(*) as total 
       FROM query_data qd 
       LEFT JOIN signatures s ON qd.id = s.query_data_id 
       WHERE qd.query_page_id = ? AND s.id IS NULL`,
      [id]
    )

    const formattedData = unsignedData.map(row => {
      const data = JSON.parse(row.data)
      const result = {}
      headers.forEach(h => {
        result[h.column_name] = data[h.column_index]
      })
      return result
    })

    res.json({
      success: true,
      data: {
        list: formattedData,
        total: totalResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
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
  getUnqueriedList,
  getUnsignedList
}
