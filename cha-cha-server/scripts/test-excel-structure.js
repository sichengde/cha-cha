const XLSX = require('xlsx')

const filePath = 'd:\\code\\mini-program\\0416--项目房源合同情况统计表.xlsx'
const workbook = XLSX.readFile(filePath)
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]

console.log('=== 工作表信息 ===')
console.log('工作表名称:', sheetName)
console.log('范围:', sheet['!ref'])

console.log('\n=== 合并单元格信息 ===')
const merges = sheet['!merges'] || []
console.log('合并单元格数量:', merges.length)
merges.forEach((merge, index) => {
  console.log(`合并区域 ${index + 1}:`, merge)
  const startCell = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })
  const cell = sheet[startCell]
  console.log(`  起始单元格: ${startCell}, 值:`, cell ? cell.v : 'null')
})

console.log('\n=== 前10行数据 ===')
const range = XLSX.utils.decode_range(sheet['!ref'])
for (let row = range.s.r; row <= Math.min(range.s.r + 9, range.e.r); row++) {
  const rowData = []
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
    const cell = sheet[cellAddress]
    rowData.push(cell ? cell.v : null)
  }
  console.log(`第${row + 1}行:`, rowData)
}
