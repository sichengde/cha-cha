const mysql = require('mysql2/promise')
const { getDbConfig } = require('../src/config/dbConfig')

async function testQuery() {
  const connection = await mysql.createConnection(getDbConfig())

  try {
    const [queryPages] = await connection.query('SELECT * FROM query_pages ORDER BY created_at DESC LIMIT 1')
    if (queryPages.length === 0) {
      console.log('没有查询页面')
      return
    }

    const queryPage = queryPages[0]
    console.log('查询页面:', queryPage)

    const [headers] = await connection.query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [queryPage.id]
    )
    console.log('表头:', headers)

    const conditions = headers
      .map((h, idx) => h.is_condition ? idx : -1)
      .filter(idx => idx !== -1)
    console.log('查询条件索引:', conditions)

    const result = {
      ...queryPage,
      settings: {
        allowModify: queryPage.allow_modify,
        enableSign: queryPage.enable_sign,
        requireNickname: queryPage.require_nickname,
        queryLimit: queryPage.query_limit,
        conditions: conditions
      },
      headers: headers
    }

    console.log('\n返回给前端的数据:')
    console.log('settings:', result.settings)
    console.log('headers:', result.headers)
  } catch (error) {
    console.error('错误:', error)
  } finally {
    await connection.end()
  }
}

testQuery()
