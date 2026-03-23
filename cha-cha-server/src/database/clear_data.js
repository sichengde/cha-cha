const mysql = require('mysql2/promise')
const { readEnvBoolean } = require('../config/env')
const { getDbConfig } = require('../config/dbConfig')

async function clearData() {
  if (!readEnvBoolean('ALLOW_CLEAR_DATA', false)) {
    console.error('已拒绝执行清库脚本：请先设置 ALLOW_CLEAR_DATA=true')
    process.exit(1)
  }

  const connection = await mysql.createConnection(getDbConfig())

  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0')
    await connection.execute('DELETE FROM jielong_member')
    await connection.execute('DELETE FROM jielong')
    await connection.execute('DELETE FROM export_records')
    await connection.execute('DELETE FROM data_modifications')
    await connection.execute('DELETE FROM signatures')
    await connection.execute('DELETE FROM query_records')
    await connection.execute('DELETE FROM query_data')
    await connection.execute('DELETE FROM query_headers')
    await connection.execute('DELETE FROM query_pages')
    await connection.execute('DELETE FROM users')
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1')

    console.log('已清空所有数据')
  } catch (error) {
    console.error('清空数据失败:', error)
  } finally {
    await connection.end()
  }
}

clearData()
