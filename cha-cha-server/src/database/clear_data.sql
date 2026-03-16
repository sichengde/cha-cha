-- 清空所有历史数据
DELETE FROM signatures;
DELETE FROM query_records;
DELETE FROM query_data;
DELETE FROM query_headers;
DELETE FROM query_pages;
DELETE FROM users;

SELECT '已清空所有数据' as status;
