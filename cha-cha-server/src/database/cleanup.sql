-- 数据库清理脚本：删除未使用的字段

-- 1. users 表：删除 unionid 字段（未使用）
ALTER TABLE users DROP COLUMN IF EXISTS unionid;

-- 2. query_pages 表：删除未使用的字段
ALTER TABLE query_pages DROP COLUMN IF EXISTS cover_url;
ALTER TABLE query_pages DROP COLUMN IF EXISTS settings;
ALTER TABLE query_pages DROP COLUMN IF EXISTS query_time_limit;

-- 3. query_data 表：删除 image_url 字段（未使用）
ALTER TABLE query_data DROP COLUMN IF EXISTS image_url;

-- 4. query_records 表：删除未使用的字段
ALTER TABLE query_records DROP COLUMN IF EXISTS user_id;
ALTER TABLE query_records DROP COLUMN IF EXISTS nickname;

-- 5. signatures 表：删除未使用的字段
ALTER TABLE signatures DROP COLUMN IF EXISTS user_id;
ALTER TABLE signatures DROP COLUMN IF EXISTS nickname;

SELECT 'Cleanup completed!' as status;
