const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')
const { readEnvInt } = require('./config/env')

const userRoutes = require('./routes/userRoutes')
const queryRoutes = require('./routes/queryRoutes')
const dataRoutes = require('./routes/dataRoutes')
const fileRoutes = require('./routes/fileRoutes')
const statsRoutes = require('./routes/statsRoutes')

const { testConnection } = require('./config/database')
const { startTempFileCleaner } = require('./controllers/fileController')

const app = express()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Openid']
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/chacha/api/', function(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
})

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: '请求过于频繁，请稍后再试' }
})
app.use('/chacha/api/', limiter)

app.use('/chacha/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/chacha/', function(req, res) {
  res.json({
    success: true,
    message: '小丽表格 API 服务',
    version: '1.0.0',
    endpoints: {
      users: '/chacha/api/users',
      queries: '/chacha/api/queries',
      data: '/chacha/api/data',
      files: '/chacha/api/files',
      stats: '/chacha/api/stats'
    }
  })
})

app.use('/chacha/api/users', userRoutes)
app.use('/chacha/api/queries', queryRoutes)
app.use('/chacha/api/data', dataRoutes)
app.use('/chacha/api/files', fileRoutes)
app.use('/chacha/api/stats', statsRoutes)

app.use(function(err, req, res, next) {
  console.error('Error:', err)

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'JSON格式错误' })
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: '文件大小不能超过5MB' })
  }

  if (err.message === '只支持Excel文件') {
    return res.status(400).json({ success: false, message: err.message })
  }

  res.status(500).json({ success: false, message: '服务器内部错误' })
})

app.use(function(req, res) {
  res.status(404).json({ success: false, message: '接口不存在' })
})

const PORT = readEnvInt('PORT', 3000)

async function startServer() {
  try {
    const dbConnected = await testConnection()
    if (!dbConnected) {
      console.error('数据库连接失败，请检查配置')
      process.exit(1)
    }

    startTempFileCleaner()

    app.listen(PORT, '0.0.0.0', function() {
      console.log('服务器运行在端口 ' + PORT)
      console.log('访问 http://localhost:' + PORT + ' 查看API文档')
    })
  } catch (error) {
    console.error('启动服务器失败:', error)
    process.exit(1)
  }
}

startServer()
