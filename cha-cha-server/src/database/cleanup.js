require('dotenv').config()
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

const cleanup = async () => {
  console.log('连接数据库...')
  console.log(`Host: ${process.env.DB_HOST}`)
  console.log(`Database: ${process.env.DB_NAME}`)
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  })
  
  console.log('连接成功!\n')
  
  const cleanupSQL = fs.readFileSync(path.join(__dirname, 'cleanup.sql'), 'utf8')
  
  console.log('执行清理脚本...\n')
  
  const statements = cleanupSQL.split(';').filter(s => s.trim() && !s.includes('SELECT'))
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await connection.query(statement)
        const match = statement.match(/DROP COLUMN IF EXISTS (\w+)/)
        if (match) {
          console.log(`✓ 已删除字段: ${match[1]}`)
        } else if (statement.includes('ALTER TABLE')) {
          const tableMatch = statement.match(/ALTER TABLE (\w+)/)
          if (tableMatch) {
            console.log(`✓ 处理表: ${tableMatch[1]}`)
          }
        }
      } catch (error) {
        if (error.code === '1091') {
          console.log(`- 字段不存在，跳过`)
        } else {
          console.error(`✗ 错误: ${error.message}`)
        }
      }
    }
  }
  
  await connection.end()
  console.log('\n数据库清理完成!')
}

cleanup().catch(err => {
  console.error('执行失败:', err.message)
  process.exit(1)
})
