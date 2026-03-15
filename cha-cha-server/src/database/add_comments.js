require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const addComments = async () => {
  console.log('开始添加表和字段注释...')
  console.log(`连接到: ${process.env.DB_HOST}:${process.env.DB_PORT}`)
  
  let connection
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cha_cha',
      multipleStatements: true
    })
    
    console.log('数据库连接成功!')
    
    await connection.query(`USE \`${process.env.DB_NAME || 'cha_cha'}\``)
    
    const sqlPath = path.join(__dirname, 'add_comments.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    const statements = sql.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement)
        } catch (error) {
          console.error('执行SQL失败:', error.message.substring(0, 100))
        }
      }
    }
    
    await connection.end()
    console.log('注释添加完成!')
    process.exit(0)
  } catch (error) {
    console.error('添加注释失败:', error.message)
    if (connection) {
      await connection.end().catch(() => {})
    }
    process.exit(1)
  }
}

addComments()
