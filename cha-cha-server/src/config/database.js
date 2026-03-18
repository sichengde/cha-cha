const { readEnvBoolean } = require('./env')
const { getDbConfig } = require('./dbConfig')

const USE_MEMORY_DB = readEnvBoolean('USE_MEMORY_DB', false)

if (USE_MEMORY_DB) {
  const memoryDb = require('./database.memory')
  module.exports = memoryDb
} else {
  const mysql = require('mysql2/promise')

  const pool = mysql.createPool({
    ...getDbConfig(),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+08:00',
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000
  })

  const query = async (sql, params = []) => {
    try {
      const [rows] = await pool.execute(sql, params)
      return rows
    } catch (error) {
      console.error('SQL执行错误:', error)
      console.error('SQL:', sql)
      console.error('参数:', params)
      throw error
    }
  }

  const queryOne = async (sql, params = []) => {
    const rows = await query(sql, params)
    return rows[0] || null
  }

  const insert = async (table, data) => {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const placeholders = keys.map(() => '?').join(', ')
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
    const result = await query(sql, values)
    return result.insertId
  }

  const update = async (table, data, where, whereParams = []) => {
    const sets = Object.keys(data).map(key => `${key} = ?`).join(', ')
    const values = Object.values(data).concat(whereParams)
    const sql = `UPDATE ${table} SET ${sets} WHERE ${where}`
    const result = await query(sql, values)
    return result.affectedRows
  }

  const remove = async (table, where, whereParams = []) => {
    const sql = `DELETE FROM ${table} WHERE ${where}`
    const result = await query(sql, whereParams)
    return result.affectedRows
  }

  const transaction = async (callback) => {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const result = await callback(conn)
      await conn.commit()
      return result
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  }

  const testConnection = async () => {
    try {
      const conn = await pool.getConnection()
      console.log('数据库连接成功')
      conn.release()
      return true
    } catch (error) {
      console.error('数据库连接失败:', error.message)
      return false
    }
  }

  module.exports = {
    pool,
    query,
    queryOne,
    insert,
    update,
    remove,
    transaction,
    testConnection
  }
}
