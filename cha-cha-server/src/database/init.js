const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { getDbConfig, getDbName, getDbServerConfig } = require('../config/dbConfig')

const ensureUniqueIndexes = async (connection, dbName) => {
  const indexConfigs = [
    {
      table: 'query_records',
      indexName: 'uk_query_record_user',
      alterSQL: 'ALTER TABLE query_records ADD UNIQUE KEY uk_query_record_user (query_page_id, query_data_id, openid)'
    },
    {
      table: 'signatures',
      indexName: 'uk_signature_page_data',
      alterSQL: 'ALTER TABLE signatures ADD UNIQUE KEY uk_signature_page_data (query_page_id, query_data_id)'
    },
    {
      table: 'query_data',
      indexName: 'idx_query_page_row',
      alterSQL: 'ALTER TABLE query_data ADD INDEX idx_query_page_row (query_page_id, row_index)'
    }
  ]

  for (const config of indexConfigs) {
    const [existing] = await connection.query(
      `SELECT 1
       FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = ? AND index_name = ?
       LIMIT 1`,
      [dbName, config.table, config.indexName]
    )

    if (existing.length > 0) {
      continue
    }

    try {
      await connection.query(config.alterSQL)
      console.log(`已创建唯一索引: ${config.indexName}`)
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`跳过索引 ${config.indexName}: 现有数据存在重复记录，请先清理重复数据`)
      } else if (error.code !== 'ER_DUP_KEYNAME') {
        throw error
      }
    }
  }
}

const initDatabase = async () => {
  const dbConfig = getDbConfig()
  const dbName = getDbName()

  console.log('开始初始化数据库...')
  console.log(`连接到: ${dbConfig.host}:${dbConfig.port}`)
  console.log(`数据库: ${dbName}`)
  console.log(`用户: ${dbConfig.user}`)
  
  let connection
  try {
    connection = await mysql.createConnection(
      getDbServerConfig({
        multipleStatements: true
      })
    )
    
    console.log('数据库连接成功!')
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` 
                           CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log('数据库创建/确认成功!')
    
    await connection.query(`USE \`${dbName}\``)
    
    const sqlPath = path.join(__dirname, 'schema.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    const statements = sql.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement)
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error('执行SQL失败:', error.message)
          }
        }
      }
    }

    await ensureUniqueIndexes(connection, dbName)
    
    await connection.end()
    console.log('数据库初始化完成!')
    process.exit(0)
  } catch (error) {
    console.error('数据库初始化失败:', error.message)
    if (connection) {
      await connection.end().catch(() => {})
    }
    process.exit(1)
  }
}

initDatabase()
