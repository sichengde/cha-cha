const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { getDbConfig, getDbName } = require('../config/dbConfig')

const addComments = async () => {
  const dbConfig = getDbConfig()
  const dbName = getDbName()

  console.log('开始添加表和字段注释...')
  console.log(`连接到: ${dbConfig.host}:${dbConfig.port}`)
  
  let connection
  try {
    connection = await mysql.createConnection({
      ...dbConfig,
      multipleStatements: true
    })
    
    console.log('数据库连接成功!')
    
    await connection.query(`USE \`${dbName}\``)
    
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
