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

  const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/

  const escapeIdentifier = (name) => {
    if (!VALID_IDENTIFIER.test(name)) {
      throw new Error('非法的标识符: ' + name)
    }
    return '`' + name + '`'
  }

  const query = async (sql, params = []) => {
    try {
      const [rows] = await pool.execute(sql, params)
      return rows
    } catch (error) {
      console.error('SQL执行错误:', error.message)
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
    const escapedTable = escapeIdentifier(table)
    const escapedKeys = keys.map(k => escapeIdentifier(k)).join(', ')
    const sql = `INSERT INTO ${escapedTable} (${escapedKeys}) VALUES (${placeholders})`
    const result = await query(sql, values)
    return result.insertId
  }

  const update = async (table, data, where, whereParams = []) => {
    const sets = Object.keys(data).map(key => `${escapeIdentifier(key)} = ?`).join(', ')
    const values = Object.values(data).concat(whereParams)
    const escapedTable = escapeIdentifier(table)
    const sql = `UPDATE ${escapedTable} SET ${sets} WHERE ${where}`
    const result = await query(sql, values)
    return result.affectedRows
  }

  const remove = async (table, where, whereParams = []) => {
    const escapedTable = escapeIdentifier(table)
    const sql = `DELETE FROM ${escapedTable} WHERE ${where}`
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
