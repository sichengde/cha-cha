const http = require('http')
const { readEnvInt, readEnvString } = require('../src/config/env')

const queryId = 'c3ba3163-7536-4928-b912-5dcf2d768eb5'

const options = {
  hostname: readEnvString('TEST_API_HOST', '127.0.0.1'),
  port: readEnvInt('TEST_API_PORT', 3000),
  path: '/api/queries/' + queryId,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
}

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(data)
      console.log('API返回成功:')
      console.log('success:', result.success)
      console.log('data.name:', result.data.name)
      console.log('data.settings:', result.data.settings)
      console.log('data.headers.length:', result.data.headers ? result.data.headers.length : 0)
      if (result.data.headers && result.data.headers.length > 0) {
        console.log('第一个header:', result.data.headers[0])
      }
    } else {
      console.error('API返回失败:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('请求失败:', error.message)
})

req.end()
