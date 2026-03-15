require('dotenv').config()
const mysql = require('mysql2/promise')

const verifyComments = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  })

  console.log('\n=== 表注释 ===')
  const [tables] = await connection.query(`
    SELECT TABLE_NAME, TABLE_COMMENT 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = ?
  `, [process.env.DB_NAME])
  
  tables.forEach(t => {
    console.log(`${t.TABLE_NAME}: ${t.TABLE_COMMENT}`)
  })

  console.log('\n=== 字段注释 ===')
  const [columns] = await connection.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `, [process.env.DB_NAME])
  
  let currentTable = ''
  columns.forEach(c => {
    if (c.TABLE_NAME !== currentTable) {
      currentTable = c.TABLE_NAME
      console.log(`\n[${currentTable}]`)
    }
    if (c.COLUMN_COMMENT) {
      console.log(`  ${c.COLUMN_NAME}: ${c.COLUMN_COMMENT}`)
    }
  })

  await connection.end()
}

verifyComments().then(() => process.exit(0)).catch(e => {
  console.error(e)
  process.exit(1)
})
