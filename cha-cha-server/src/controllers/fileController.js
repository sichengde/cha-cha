const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')
const { query, queryOne, insert } = require('../config/database')

const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      })
    }

    const filePath = req.file.path
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    if (jsonData.length < 2) {
      return res.status(400).json({
        success: false,
        message: '表格数据不足'
      })
    }

    const allRows = jsonData
    const headerRowIndex = findHeaderRow(jsonData, worksheet)
    const headers = jsonData[headerRowIndex]
    const data = jsonData.slice(headerRowIndex + 1).filter(row => row.some(cell => cell !== undefined && cell !== ''))

    res.json({
      success: true,
      data: {
        headers,
        data,
        allRows,
        headerRowIndex,
        rowCount: data.length,
        previewRows: data.slice(0, 5)
      }
    })
  } catch (error) {
    console.error('上传Excel失败:', error)
    res.status(500).json({
      success: false,
      message: '解析Excel失败'
    })
  }
}

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

const exportData = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const queryPage = await queryOne(
      'SELECT * FROM query_pages WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (!queryPage) {
      return res.status(404).json({
        success: false,
        message: '查询页面不存在或无权限'
      })
    }

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [id]
    )

    const dataRows = await query(
      'SELECT * FROM query_data WHERE query_page_id = ? ORDER BY row_index',
      [id]
    )

    const queryRecords = await query(
      'SELECT query_data_id, COUNT(*) as count FROM query_records WHERE query_page_id = ? GROUP BY query_data_id',
      [id]
    )

    const signatures = await query(
      'SELECT query_data_id, sign_type, signed_at FROM signatures WHERE query_page_id = ?',
      [id]
    )

    const recordMap = {}
    queryRecords.forEach(r => {
      recordMap[r.query_data_id] = r.count
    })

    const signMap = {}
    signatures.forEach(s => {
      signMap[s.query_data_id] = s
    })

    const workbook = XLSX.utils.book_new()
    
    const headerRow = headers.map(h => h.column_name)
    headerRow.push('查询次数', '查询状态', '签收状态', '签收时间')
    
    const sheetData = [headerRow]

    dataRows.forEach(row => {
      const data = JSON.parse(row.data)
      const rowData = headers.map(h => data[h.column_index] || '')
      rowData.push(
        recordMap[row.id] || 0,
        recordMap[row.id] ? '已查询' : '未查询',
        signMap[row.id] ? '已签收' : '未签收',
        signMap[row.id] ? signMap[row.id].signed_at : ''
      )
      sheetData.push(rowData)
    })

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, '数据')

    const fileName = `${queryPage.name}_数据导出_${Date.now()}.xlsx`
    const exportPath = path.join(uploadDir, fileName)
    XLSX.writeFile(workbook, exportPath)

    await insert('export_records', {
      user_id: userId,
      query_page_id: id,
      file_name: fileName,
      file_path: exportPath,
      export_type: 'data'
    })

    res.download(exportPath, fileName, (err) => {
      if (err) {
        console.error('下载文件失败:', err)
      }
    })
  } catch (error) {
    console.error('导出数据失败:', error)
    res.status(500).json({
      success: false,
      message: '导出数据失败'
    })
  }
}

module.exports = {
  uploadExcel,
  exportData
}
