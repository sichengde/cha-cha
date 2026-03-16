const mysql = require('mysql2/promise');

async function clearData() {
  const connection = await mysql.createConnection({
    host: 'sygdsoft.com',
    port: 3306,
    user: 'hotel',
    password: 'q123',
    database: 'cha_cha'
  });

  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DELETE FROM signatures');
    await connection.execute('DELETE FROM query_records');
    await connection.execute('DELETE FROM query_data');
    await connection.execute('DELETE FROM query_headers');
    await connection.execute('DELETE FROM query_pages');
    await connection.execute('DELETE FROM users');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('已清空所有数据');
  } catch (error) {
    console.error('清空数据失败:', error);
  } finally {
    await connection.end();
  }
}

clearData();
