const mysql = require('mysql2/promise')
const { getDbConfig, getDbName, getDbServerConfig } = require('../config/dbConfig')

// 建表 SQL — 与数据库实际结构保持一致，修改完后重新执行 npm run init-db 即可
const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY COMMENT '用户ID',
    openid VARCHAR(100) UNIQUE COMMENT '微信openid',
    nickname VARCHAR(100) COMMENT '昵称',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    phone VARCHAR(20) COMMENT '手机号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_openid (openid)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表'`,

  `CREATE TABLE IF NOT EXISTS query_pages (
    id VARCHAR(36) PRIMARY KEY COMMENT '查询页面ID',
    user_id VARCHAR(36) NOT NULL COMMENT '创建用户ID',
    name VARCHAR(200) NOT NULL COMMENT '查询名称',
    description TEXT COMMENT '查询描述',
    status ENUM('pending', 'active', 'ended') DEFAULT 'active' COMMENT '状态：待发布/进行中/已结束',
    allow_modify BOOLEAN DEFAULT FALSE COMMENT '是否允许修改信息',
    enable_sign BOOLEAN DEFAULT FALSE COMMENT '是否开启签收',
    require_nickname BOOLEAN DEFAULT FALSE COMMENT '查询时是否需授权昵称',
    query_limit INT DEFAULT 0 COMMENT '查询次数限制，0表示不限制',
    start_time TIMESTAMP NULL COMMENT '开始时间',
    end_time TIMESTAMP NULL COMMENT '结束时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询页面表'`,

  `CREATE TABLE IF NOT EXISTS query_data (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '数据ID',
    query_page_id VARCHAR(36) NOT NULL COMMENT '所属查询页面ID',
    row_index INT NOT NULL COMMENT '行索引',
    data JSON NOT NULL COMMENT '当前数据(JSON格式)',
    original_data JSON COMMENT '原始数据(JSON格式)',
    is_modified BOOLEAN DEFAULT FALSE COMMENT '是否已修改',
    modified_at TIMESTAMP NULL COMMENT '最后修改时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_query_page_id (query_page_id),
    INDEX idx_query_page_row (query_page_id, row_index),
    FOREIGN KEY (query_page_id) REFERENCES query_pages(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询数据表'`,

  `CREATE TABLE IF NOT EXISTS query_headers (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '表头ID',
    query_page_id VARCHAR(36) NOT NULL COMMENT '所属查询页面ID',
    column_index INT NOT NULL COMMENT '列索引',
    column_name VARCHAR(100) NOT NULL COMMENT '列名称',
    is_condition BOOLEAN DEFAULT FALSE COMMENT '是否为查询条件',
    is_modifiable BOOLEAN DEFAULT FALSE COMMENT '是否允许修改',
    is_hidden BOOLEAN DEFAULT FALSE COMMENT '是否隐藏',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_query_page_id (query_page_id),
    FOREIGN KEY (query_page_id) REFERENCES query_pages(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询表头配置表'`,

  `CREATE TABLE IF NOT EXISTS query_records (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '查询记录ID',
    query_page_id VARCHAR(36) NOT NULL COMMENT '所属查询页面ID',
    query_data_id INT NOT NULL COMMENT '查询的数据ID',
    openid VARCHAR(100) COMMENT '查询用户openid',
    query_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '查询时间',
    query_count INT DEFAULT 1 COMMENT '查询次数',
    INDEX idx_query_page_id (query_page_id),
    INDEX idx_query_data_id (query_data_id),
    INDEX idx_openid (openid),
    UNIQUE KEY uk_query_record_user (query_page_id, query_data_id, openid),
    FOREIGN KEY (query_page_id) REFERENCES query_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (query_data_id) REFERENCES query_data(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询记录表'`,

  `CREATE TABLE IF NOT EXISTS signatures (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '签收记录ID',
    query_page_id VARCHAR(36) NOT NULL COMMENT '所属查询页面ID',
    query_data_id INT NOT NULL COMMENT '签收的数据ID',
    openid VARCHAR(100) COMMENT '签收用户openid',
    sign_type ENUM('signature', 'button') DEFAULT 'button' COMMENT '签收方式：手写签名/按钮确认',
    signature_url VARCHAR(500) COMMENT '签名图片URL',
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '签收时间',
    INDEX idx_query_page_id (query_page_id),
    INDEX idx_query_data_id (query_data_id),
    UNIQUE KEY uk_signature_page_data (query_page_id, query_data_id),
    FOREIGN KEY (query_page_id) REFERENCES query_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (query_data_id) REFERENCES query_data(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='签收记录表'`,

  `CREATE TABLE IF NOT EXISTS data_modifications (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '修改记录ID',
    query_data_id INT NOT NULL COMMENT '被修改的数据ID',
    column_name VARCHAR(100) NOT NULL COMMENT '修改的列名',
    old_value TEXT COMMENT '修改前的值',
    new_value TEXT COMMENT '修改后的值',
    modified_by VARCHAR(36) COMMENT '修改人openid',
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '修改时间',
    INDEX idx_query_data_id (query_data_id),
    FOREIGN KEY (query_data_id) REFERENCES query_data(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据修改记录表'`,

  `CREATE TABLE IF NOT EXISTS export_records (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '导出记录ID',
    user_id VARCHAR(36) NOT NULL COMMENT '导出用户ID',
    query_page_id VARCHAR(36) COMMENT '导出的查询页面ID',
    file_name VARCHAR(200) COMMENT '导出文件名',
    file_path VARCHAR(500) COMMENT '导出文件路径',
    export_type ENUM('data', 'signature') DEFAULT 'data' COMMENT '导出类型：数据导出/签名导出',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '导出时间',
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='导出记录表'`,

  `CREATE TABLE IF NOT EXISTS jielong (
    id VARCHAR(36) PRIMARY KEY COMMENT '接龙唯一ID',
    title VARCHAR(60) NOT NULL COMMENT '接龙标题',
    description VARCHAR(400) COMMENT '活动描述',
    creator_id VARCHAR(36) NOT NULL COMMENT '发起人用户ID',
    deadline TIMESTAMP NULL COMMENT '截止时间',
    max_count INT NULL COMMENT '人数上限',
    need_remark BOOLEAN DEFAULT FALSE COMMENT '是否收集备注',
    remark_hint VARCHAR(100) COMMENT '备注提示语',
    fields TEXT COMMENT '自定义字段JSON数组',
    status ENUM('open', 'closed') DEFAULT 'open' COMMENT '状态：进行中/已关闭',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_creator_id (creator_id),
    INDEX idx_status (status),
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='接龙表'`,

  `CREATE TABLE IF NOT EXISTS jielong_member (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '记录唯一ID',
    jielong_id VARCHAR(36) NOT NULL COMMENT '关联接龙ID',
    user_id VARCHAR(36) NOT NULL COMMENT '参与者用户ID',
    nickname VARCHAR(100) COMMENT '参与者昵称',
    avatar VARCHAR(500) COMMENT '头像URL',
    remark VARCHAR(200) COMMENT '备注内容',
    field_values TEXT COMMENT '自定义字段填JSON',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '报名时间',
    is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否被发起人删除',
    INDEX idx_jielong_id (jielong_id),
    INDEX idx_user_id (user_id),
    UNIQUE KEY uk_jielong_user (jielong_id, user_id),
    FOREIGN KEY (jielong_id) REFERENCES jielong(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='接龙报名记录表'`
]

// 对于已存在的库，确保索引/约束完整（幂等操作，可重复执行）
const ensureIndexes = async (connection, dbName) => {
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
    },
    {
      table: 'jielong_member',
      indexName: 'uk_jielong_user',
      alterSQL: 'ALTER TABLE jielong_member ADD UNIQUE KEY uk_jielong_user (jielong_id, user_id)'
    }
  ]

  for (const config of indexConfigs) {
    const [existing] = await connection.query(
      `SELECT 1 FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1`,
      [dbName, config.table, config.indexName]
    )

    if (existing.length > 0) continue

    try {
      await connection.query(config.alterSQL)
      console.log(`已创建索引: ${config.indexName}`)
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`跳过索引 ${config.indexName}: 现有数据存在重复记录，请先清理重复数据`)
      } else if (error.code !== 'ER_DUP_KEYNAME') {
        throw error
      }
    }
  }

  // 确保新增列存在（兼容已有数据库）
  const columnConfigs = [
    { table: 'jielong', column: 'fields', alterSQL: "ALTER TABLE jielong ADD COLUMN fields TEXT COMMENT '自定义字段JSON数组' AFTER remark_hint" },
    { table: 'jielong_member', column: 'field_values', alterSQL: "ALTER TABLE jielong_member ADD COLUMN field_values TEXT COMMENT '自定义字段填写JSON' AFTER remark" }
  ]

  for (const config of columnConfigs) {
    const [existing] = await connection.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1`,
      [dbName, config.table, config.column]
    )
    if (existing.length > 0) continue
    try {
      await connection.query(config.alterSQL)
      console.log(`已添加列: ${config.table}.${config.column}`)
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error
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
    connection = await mysql.createConnection(getDbServerConfig())

    console.log('数据库连接成功!')

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    console.log('数据库创建/确认成功!')

    await connection.query(`USE \`${dbName}\``)

    for (const statement of SCHEMA_SQL) {
      try {
        await connection.query(statement)
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error('执行建表SQL失败:', error.message)
        }
      }
    }

    await ensureIndexes(connection, dbName)

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

