const XLSX = require('xlsx')

const findHeaderRow = (rows, worksheet) => {
  const merges = worksheet['!merges'] || []
  
  const isMergedTitleRow = (rowIndex) => {
    for (const merge of merges) {
      if (merge.s.r === rowIndex && merge.e.r === rowIndex) {
        const colSpan = merge.e.c - merge.s.c + 1
        if (colSpan >= 3) {
          return true
        }
      }
    }
    return false
  }

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (isMergedTitleRow(i)) {
      console.log(`第${i + 1}行是合并单元格标题，跳过`)
      continue
    }
    
    const row = rows[i]
    if (!row || row.length === 0) continue
    
    const nonEmptyCells = row.filter(cell => cell !== undefined && cell !== '' && cell !== null)
    const nonEmptyCount = nonEmptyCells.length
    
    if (nonEmptyCount < 3) continue
    
    const nextNonEmptyRows = []
    for (let j = i + 1; j < rows.length && nextNonEmptyRows.length < 3; j++) {
      const nextRow = rows[j]
      if (nextRow && nextRow.some(cell => cell !== undefined && cell !== '' && cell !== null)) {
        nextNonEmptyRows.push(nextRow)
      }
    }
    
    if (nextNonEmptyRows.length === 0) continue
    
    const avgNonEmptyInNextRows = nextNonEmptyRows.reduce((sum, nextRow) => {
      const count = nextRow ? nextRow.filter(cell => cell !== undefined && cell !== '' && cell !== null).length : 0
      return sum + count
    }, 0) / nextNonEmptyRows.length
    
    const hasConsistentColumns = avgNonEmptyInNextRows >= nonEmptyCount * 0.8
    
    if (!hasConsistentColumns) continue
    
    let hasNumericData = false
    let hasDateData = false
    for (let j = 0; j < nextNonEmptyRows.length; j++) {
      const nextRow = nextNonEmptyRows[j]
      if (!nextRow) continue
      for (let k = 0; k < Math.min(nextRow.length, row.length); k++) {
        const cell = nextRow[k]
        if (typeof cell === 'number') {
          hasNumericData = true
        }
        if (typeof cell === 'string' && /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(cell)) {
          hasDateData = true
        }
      }
    }
    
    const headerCells = nonEmptyCells
    const avgLength = headerCells.reduce((sum, cell) => sum + String(cell).length, 0) / headerCells.length
    const isReasonableLength = avgLength < 15
    
    const hasLongTitle = headerCells.some(cell => String(cell).length > 20)
    
    const isSingleCell = nonEmptyCount === 1 && row.length === 1
    
    if (!hasLongTitle && !isSingleCell && hasConsistentColumns && (hasNumericData || hasDateData || isReasonableLength)) {
      return i
    }
  }
  
  return 0
}

const filePath = 'd:\\code\\mini-program\\0416--项目房源合同情况统计表.xlsx'
const workbook = XLSX.readFile(filePath)
const sheetName = workbook.SheetNames[0]
const worksheet = workbook.Sheets[sheetName]
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

console.log('=== 测试表头识别 ===')
const headerRowIndex = findHeaderRow(jsonData, worksheet)
console.log('\n最终识别结果:')
console.log('表头行索引:', headerRowIndex)
console.log('表头内容:', jsonData[headerRowIndex])
