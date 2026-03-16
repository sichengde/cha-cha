-- 优化后的数据库结构
-- 删除了未使用的字段

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY COMMENT '用户ID',
  openid VARCHAR(100) UNIQUE COMMENT '微信openid',
  nickname VARCHAR(100) COMMENT '昵称',
  avatar_url VARCHAR(500) COMMENT '头像URL',
  phone VARCHAR(20) COMMENT '手机号',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS query_pages (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询页面表';

CREATE TABLE IF NOT EXISTS query_data (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '数据ID',
  query_page_id VARCHAR(36) NOT NULL COMMENT '所属查询页面ID',
  row_index INT NOT NULL COMMENT '行索引',
  data JSON NOT NULL COMMENT '当前数据(JSON格式)',
  original_data JSON COMMENT '原始数据(JSON格式)',
  is_modified BOOLEAN DEFAULT FALSE COMMENT '是否已修改',
  modified_at TIMESTAMP NULL COMMENT '最后修改时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_query_page_id (query_page_id),
  FOREIGN KEY (query_page_id) REFERENCES query_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询数据表';

CREATE TABLE IF NOT EXISTS query_headers (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询表头配置表';

CREATE TABLE IF NOT EXISTS query_records (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '查询记录ID',
  query_page_id VARCHAR(36) NOT NULL COMMENT '所属查询页面ID',
  query_data_id INT NOT NULL COMMENT '查询的数据ID',
  openid VARCHAR(100) COMMENT '查询用户openid',
  query_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '查询时间',
  query_count INT DEFAULT 1 COMMENT '查询次数',
  INDEX idx_query_page_id (query_page_id),
  INDEX idx_query_data_id (query_data_id),
  INDEX idx_openid (openid),
  FOREIGN KEY (query_page_id) REFERENCES query_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (query_data_id) REFERENCES query_data(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='查询记录表';

CREATE TABLE IF NOT EXISTS signatures (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '签收记录ID',
  query_page_id VARCHAR(36) NOT NULL COMMENT '所属查询页面ID',
  query_data_id INT NOT NULL COMMENT '签收的数据ID',
  openid VARCHAR(100) COMMENT '签收用户openid',
  sign_type ENUM('signature', 'button') DEFAULT 'button' COMMENT '签收方式：手写签名/按钮确认',
  signature_url VARCHAR(500) COMMENT '签名图片URL',
  signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '签收时间',
  INDEX idx_query_page_id (query_page_id),
  INDEX idx_query_data_id (query_data_id),
  FOREIGN KEY (query_page_id) REFERENCES query_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (query_data_id) REFERENCES query_data(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='签收记录表';

CREATE TABLE IF NOT EXISTS data_modifications (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '修改记录ID',
  query_data_id INT NOT NULL COMMENT '被修改的数据ID',
  column_name VARCHAR(100) NOT NULL COMMENT '修改的列名',
  old_value TEXT COMMENT '修改前的值',
  new_value TEXT COMMENT '修改后的值',
  modified_by VARCHAR(36) COMMENT '修改人openid',
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '修改时间',
  INDEX idx_query_data_id (query_data_id),
  FOREIGN KEY (query_data_id) REFERENCES query_data(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据修改记录表';

CREATE TABLE IF NOT EXISTS export_records (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '导出记录ID',
  user_id VARCHAR(36) NOT NULL COMMENT '导出用户ID',
  query_page_id VARCHAR(36) COMMENT '导出的查询页面ID',
  file_name VARCHAR(200) COMMENT '导出文件名',
  file_path VARCHAR(500) COMMENT '导出文件路径',
  export_type ENUM('data', 'signature') DEFAULT 'data' COMMENT '导出类型：数据导出/签收记录导出',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '导出时间',
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='导出记录表';
