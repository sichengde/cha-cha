const fs = require('fs')
const path = require('path')

const requiredFiles = [
  path.join(__dirname, '../app.js'),
  path.join(__dirname, '../routes/queryRoutes.js'),
  path.join(__dirname, '../controllers/queryController.js'),
  path.join(__dirname, '../database/schema.sql')
]

const missingFiles = requiredFiles.filter((filePath) => !fs.existsSync(filePath))

if (missingFiles.length > 0) {
  console.error('基础检查失败，缺失文件:')
  missingFiles.forEach((filePath) => console.error(' - ' + filePath))
  process.exit(1)
}

console.log('基础检查通过：核心文件存在')
