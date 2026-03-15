const mysql = require('mysql2/promise')
require('dotenv').config()

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cha_cha'
  })

  try {
    console.log('开始执行数据库迁移...')

    const columns = [
      { name: 'allow_modify', sql: "ADD COLUMN allow_modify BOOLEAN DEFAULT FALSE COMMENT '是否允许修改信息'" },
      { name: 'enable_sign', sql: "ADD COLUMN enable_sign BOOLEAN DEFAULT FALSE COMMENT '是否开启签收'" },
      { name: 'require_nickname', sql: "ADD COLUMN require_nickname BOOLEAN DEFAULT FALSE COMMENT '查询时是否需授权昵称'" },
      { name: 'query_limit', sql: "ADD COLUMN query_limit INT DEFAULT 0 COMMENT '查询次数限制，0表示不限制'" },
      { name: 'query_time_limit', sql: "ADD COLUMN query_time_limit TIMESTAMP NULL COMMENT '查询时间限制，NULL表示不限制'" },
      { name: 'start_time', sql: "ADD COLUMN start_time TIMESTAMP NULL COMMENT '开始时间'" },
      { name: 'end_time', sql: "ADD COLUMN end_time TIMESTAMP NULL COMMENT '结束时间'" }
    ]

    for (const column of columns) {
      try {
        await connection.query(`ALTER TABLE query_pages ${column.sql}`)
        console.log(`✓ 添加字段 ${column.name} 成功`)
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`- 字段 ${column.name} 已存在，跳过`)
        } else {
          throw error
        }
      }
    }

    console.log('迁移执行成功！')
  } catch (error) {
    console.error('迁移执行失败:', error.message)
  } finally {
    await connection.end()
  }
}

runMigration()
