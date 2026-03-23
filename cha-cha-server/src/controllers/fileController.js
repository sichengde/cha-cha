const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')
const { v4: uuidv4 } = require('uuid')
const { query, queryOne, insert } = require('../config/database')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uploadDir = path.join(__dirname, '../../uploads')
const exportDir = path.join(__dirname, '../../exports')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true })
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
      fs.unlinkSync(filePath)
      return res.status(400).json({
        success: false,
        message: '表格数据不足'
      })
    }

    const allRows = jsonData
    const headerRowIndex = findHeaderRow(jsonData, worksheet)
    const headers = jsonData[headerRowIndex]
    const data = jsonData.slice(headerRowIndex + 1).filter(row => row.some(cell => cell !== undefined && cell !== ''))

    const fileId = uuidv4()
    const ext = path.extname(req.file.originalname)
    const newFileName = `${fileId}${ext}`
    const newFilePath = path.join(uploadDir, newFileName)
    
    fs.renameSync(filePath, newFilePath)

    res.json({
      success: true,
      data: {
        fileId: fileId,
        fileName: req.file.originalname,
        headers,
        headerRowIndex,
        rowCount: data.length,
        previewRows: data.slice(0, 15)
      }
    })
  } catch (error) {
    console.error('上传Excel失败:', error)
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
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

const readFileData = (fileId, headerRowIndex) => {
  if (!UUID_REGEX.test(fileId)) {
    throw new Error('文件ID格式无效')
  }

  const files = fs.readdirSync(uploadDir)
  const targetFile = files.find(f => f.startsWith(fileId + '.'))
  
  if (!targetFile) {
    throw new Error('文件不存在')
  }
  
  const filePath = path.join(uploadDir, targetFile)
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
  
  if (headerRowIndex === undefined || headerRowIndex === null) {
    headerRowIndex = findHeaderRow(jsonData, worksheet)
  }
  
  const headers = jsonData[headerRowIndex]
  const data = jsonData.slice(headerRowIndex + 1).filter(row => row.some(cell => cell !== undefined && cell !== ''))
  
  return { headers, data }
}

const deleteTempFile = (req, res) => {
  try {
    const { fileId } = req.params
    
    if (!fileId || !UUID_REGEX.test(fileId)) {
      return res.status(400).json({
        success: false,
        message: '缺少或无效的文件ID'
      })
    }
    
    const files = fs.readdirSync(uploadDir)
    const targetFile = files.find(f => f.startsWith(fileId + '.'))
    
    if (targetFile) {
      const filePath = path.join(uploadDir, targetFile)
      fs.unlinkSync(filePath)
    }
    
    res.json({
      success: true,
      message: '文件已删除'
    })
  } catch (error) {
    console.error('删除临时文件失败:', error)
    res.status(500).json({
      success: false,
      message: '删除文件失败'
    })
  }
}

// ========== 异步导出任务管理 ==========
const exportTasks = new Map()

// 定期清理已完成/失败的过期任务（30分钟）
setInterval(() => {
  const now = Date.now()
  for (const [taskId, task] of exportTasks) {
    if (task.status !== 'processing' && now - task.updatedAt > 30 * 60 * 1000) {
      exportTasks.delete(taskId)
    }
  }
}, 5 * 60 * 1000)

// 后台生成 XLSX（分批查询数据，避免一次性加载过多）
const generateExportFile = async (taskId, queryPageId, userId, queryPageName) => {
  const task = exportTasks.get(taskId)
  try {
    task.status = 'processing'
    task.progress = 5
    task.updatedAt = Date.now()

    const headers = await query(
      'SELECT * FROM query_headers WHERE query_page_id = ? ORDER BY column_index',
      [queryPageId]
    )

    // 先获取总行数
    const countResult = await queryOne(
      'SELECT COUNT(*) as total FROM query_data WHERE query_page_id = ?',
      [queryPageId]
    )
    const totalRows = countResult.total
    task.progress = 10
    task.updatedAt = Date.now()

    // 分批查询数据行
    const BATCH_SIZE = 2000
    const allDataRows = []
    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      const batch = await query(
        'SELECT * FROM query_data WHERE query_page_id = ? ORDER BY row_index LIMIT ? OFFSET ?',
        [queryPageId, BATCH_SIZE, offset]
      )
      allDataRows.push(...batch)
      // 数据查询占 10%-50% 的进度
      task.progress = 10 + Math.floor((offset + batch.length) / Math.max(totalRows, 1) * 40)
      task.updatedAt = Date.now()
    }

    task.progress = 50
    task.updatedAt = Date.now()

    const queryRecords = await query(
      'SELECT query_data_id, COUNT(*) as count FROM query_records WHERE query_page_id = ? GROUP BY query_data_id',
      [queryPageId]
    )

    const signatures = await query(
      'SELECT query_data_id, sign_type, signed_at FROM signatures WHERE query_page_id = ?',
      [queryPageId]
    )

    task.progress = 60
    task.updatedAt = Date.now()

    const recordMap = {}
    queryRecords.forEach(r => { recordMap[r.query_data_id] = r.count })

    const signMap = {}
    signatures.forEach(s => { signMap[s.query_data_id] = s })

    // 构建 XLSX
    const headerRow = headers.map(h => h.column_name)
    headerRow.push('查询次数', '查询状态', '签收状态', '签收时间')
    const sheetData = [headerRow]

    allDataRows.forEach((row, i) => {
      const data = JSON.parse(row.data)
      const rowData = headers.map(h => data[h.column_index] || '')
      rowData.push(
        recordMap[row.id] || 0,
        recordMap[row.id] ? '已查询' : '未查询',
        signMap[row.id] ? '已签收' : '未签收',
        signMap[row.id] ? signMap[row.id].signed_at : ''
      )
      sheetData.push(rowData)

      // XLSX 构建占 60%-90% 的进度，每 1000 行更新一次
      if ((i + 1) % 1000 === 0 || i === allDataRows.length - 1) {
        task.progress = 60 + Math.floor((i + 1) / allDataRows.length * 30)
        task.updatedAt = Date.now()
      }
    })

    task.progress = 90
    task.updatedAt = Date.now()

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, '数据')

    const fileName = `${queryPageName}_数据导出_${Date.now()}.xlsx`
    const exportPath = path.join(exportDir, fileName)
    XLSX.writeFile(workbook, exportPath)

    await insert('export_records', {
      user_id: userId,
      query_page_id: queryPageId,
      file_name: fileName,
      file_path: exportPath,
      export_type: 'data'
    })

    task.status = 'completed'
    task.progress = 100
    task.fileName = fileName
    task.filePath = exportPath
    task.updatedAt = Date.now()
  } catch (error) {
    console.error('导出任务失败:', error)
    task.status = 'failed'
    task.error = '导出数据失败，请重试'
    task.updatedAt = Date.now()
  }
}

// POST /export/:id  —— 发起导出任务
const startExport = async (req, res) => {
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

    const taskId = uuidv4()
    exportTasks.set(taskId, {
      status: 'processing',
      progress: 0,
      userId,
      queryPageId: id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    // 在后台执行，不 await
    generateExportFile(taskId, id, userId, queryPage.name)

    res.json({
      success: true,
      data: { taskId }
    })
  } catch (error) {
    console.error('发起导出失败:', error)
    res.status(500).json({
      success: false,
      message: '发起导出失败'
    })
  }
}

// GET /export-status/:taskId  —— 查询导出进度
const getExportStatus = (req, res) => {
  const { taskId } = req.params
  const userId = req.user.id

  if (!taskId || !UUID_REGEX.test(taskId)) {
    return res.status(400).json({ success: false, message: '无效的任务ID' })
  }

  const task = exportTasks.get(taskId)
  if (!task || task.userId !== userId) {
    return res.status(404).json({ success: false, message: '任务不存在' })
  }

  const result = { status: task.status, progress: task.progress }
  if (task.status === 'completed') {
    result.fileName = task.fileName
  } else if (task.status === 'failed') {
    result.error = task.error
  }

  res.json({ success: true, data: result })
}

// GET /export-download/:taskId  —— 下载已完成的导出文件
const downloadExport = (req, res) => {
  const { taskId } = req.params
  const userId = req.user.id

  if (!taskId || !UUID_REGEX.test(taskId)) {
    return res.status(400).json({ success: false, message: '无效的任务ID' })
  }

  const task = exportTasks.get(taskId)
  if (!task || task.userId !== userId) {
    return res.status(404).json({ success: false, message: '任务不存在' })
  }

  if (task.status !== 'completed') {
    return res.status(400).json({ success: false, message: '文件尚未准备好' })
  }

  if (!fs.existsSync(task.filePath)) {
    return res.status(404).json({ success: false, message: '文件已过期，请重新导出' })
  }

  res.download(task.filePath, task.fileName, (err) => {
    if (err) {
      console.error('下载文件失败:', err)
    }
  })
}

const startTempFileCleaner = () => {
  const CLEAN_INTERVAL = 10 * 60 * 1000
  const UPLOAD_EXPIRE_TIME = 60 * 60 * 1000
  const EXPORT_EXPIRE_TIME = 24 * 60 * 60 * 1000

  const cleanDir = (dir, expireTime) => {
    if (!fs.existsSync(dir)) return 0
    const files = fs.readdirSync(dir)
    const now = Date.now()
    let cleanedCount = 0

    files.forEach(file => {
      const filePath = path.join(dir, file)
      try {
        const stats = fs.statSync(filePath)
        if (now - stats.mtimeMs > expireTime) {
          fs.unlinkSync(filePath)
          cleanedCount++
        }
      } catch (e) {}
    })

    return cleanedCount
  }

  const cleanExpiredFiles = () => {
    try {
      const uploadCleaned = cleanDir(uploadDir, UPLOAD_EXPIRE_TIME)
      const exportCleaned = cleanDir(exportDir, EXPORT_EXPIRE_TIME)

      if (uploadCleaned > 0 || exportCleaned > 0) {
        console.log(`[临时文件清理] 已清理 ${uploadCleaned} 个上传文件，${exportCleaned} 个导出文件`)
      }
    } catch (error) {
      console.error('[临时文件清理] 清理失败:', error.message)
    }
  }

  cleanExpiredFiles()
  setInterval(cleanExpiredFiles, CLEAN_INTERVAL)
  console.log('[临时文件清理] 定时清理任务已启动，上传文件1小时过期，导出文件24小时过期')
}

module.exports = {
  uploadExcel,
  startExport,
  getExportStatus,
  downloadExport,
  readFileData,
  deleteTempFile,
  startTempFileCleaner
}
