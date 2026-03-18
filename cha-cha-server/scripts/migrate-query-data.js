const mysql = require('mysql2/promise')
const { getDbConfig } = require('../src/config/dbConfig')

async function runMigration() {
  const connection = await mysql.createConnection(getDbConfig())

  try {
    console.log('开始执行数据库迁移...')

    const columns = [
      { name: 'image_url', sql: "ADD COLUMN image_url VARCHAR(500) COMMENT '关联图片URL'" }
    ]

    for (const column of columns) {
      try {
        await connection.query(`ALTER TABLE query_data ${column.sql}`)
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
