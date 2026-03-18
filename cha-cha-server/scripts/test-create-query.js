const http = require('http')
const { readEnvInt, readEnvString } = require('../src/config/env')

const testAuthToken = readEnvString('TEST_AUTH_TOKEN', '')

const testData = JSON.stringify({
  name: "0416--项目房源合同情况统计表.xlsx",
  description: "12345",
  allow_modify: true,
  enable_sign: true,
  require_nickname: true,
  query_limit: 0,
  headers: [
    {"column_name":"序号","column_index":0,"is_condition":true,"is_modifiable":false,"is_hidden":false},
    {"column_name":"企业名称","column_index":1,"is_condition":true,"is_modifiable":false,"is_hidden":false},
    {"column_name":"项目分类","column_index":2,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"项目名称","column_index":3,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"项目地址","column_index":4,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"运行类型","column_index":5,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"上传房源套数","column_index":6,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"上传房源间数","column_index":7,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"合同总数量","column_index":8,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"有效合同数量","column_index":9,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"无效合同数量","column_index":10,"is_condition":false,"is_modifiable":false,"is_hidden":false},
    {"column_name":"最新合同日期","column_index":11,"is_condition":false,"is_modifiable":false,"is_hidden":false}
  ],
  data: [
    [1,"沈阳恒驿房产经纪有限公司","改建-非住宅","万科泊寓总站路店","和平区总站路81号","市场化运营",176,176,716,158,491,45763,0.897727272727273]
  ]
})

const options = {
  hostname: readEnvString('TEST_API_HOST', '127.0.0.1'),
  port: readEnvInt('TEST_API_PORT', 3000),
  path: '/api/queries',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testData),
    'Authorization': 'Bearer ' + testAuthToken
  }
}

if (!testAuthToken) {
  console.error('请先设置 TEST_AUTH_TOKEN 再运行该脚本')
  process.exit(1)
}

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✓ 创建查询成功:', JSON.parse(data))
    } else {
      console.error('✗ 创建查询失败:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('✗ 请求失败:', error.message)
})

req.write(testData)
req.end()
