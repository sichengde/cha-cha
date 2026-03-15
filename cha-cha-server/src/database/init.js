require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const initDatabase = async () => {
  console.log('开始初始化数据库...')
  console.log(`连接到: ${process.env.DB_HOST}:${process.env.DB_PORT}`)
  console.log(`数据库: ${process.env.DB_NAME}`)
  console.log(`用户: ${process.env.DB_USER}`)
  
  let connection
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    })
    
    console.log('数据库连接成功!')
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'cha_cha'}\` 
                           CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log('数据库创建/确认成功!')
    
    await connection.query(`USE \`${process.env.DB_NAME || 'cha_cha'}\``)
    
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
