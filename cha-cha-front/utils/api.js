var util = require('./util')
var BASE_URL = 'https://wx.sygdsoft.com'
var REQUEST_PREFIX = '/chacha'

function request(options) {
  var url = options.url
  var method = options.method || 'GET'
  var data = options.data || {}
  var header = options.header || {}

  return new Promise(function(resolve, reject) {
    var token = wx.getStorageSync('token')
    var defaultHeader = { 'Content-Type': 'application/json' }
    if (token) defaultHeader['Authorization'] = 'Bearer ' + token

    util.showLoading()

    var requestUrl = BASE_URL + REQUEST_PREFIX + url
    var requestData = data

    if (method === 'GET' && Object.keys(data).length > 0) {
      var queryParams = Object.keys(data)
        .map(function(key) { return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]) })
        .join('&')
      requestUrl += (requestUrl.indexOf('?') !== -1 ? '&' : '?') + queryParams
      requestData = {}
    }

    wx.request({
      url: requestUrl,
      method: method,
      data: requestData,
      header: Object.assign({}, defaultHeader, header),
      success: function(res) {
        util.hideLoading()
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('token')
          wx.navigateTo({ url: '/pages/login/login' })
          reject(new Error('登录已过期'))
        } else {
          util.showToast(res.data.message || '请求失败')
          reject(new Error(res.data.message || '请求失败'))
        }
      },
      fail: function(err) {
        util.hideLoading()
        util.showToast('网络错误，请重试')
        reject(err)
      }
    })
  })
}

function uploadFile(filePath) {
  return new Promise(function(resolve, reject) {
    var token = wx.getStorageSync('token')
    util.showLoading('上传中...')

    wx.uploadFile({
      url: BASE_URL + REQUEST_PREFIX + '/api/files/upload',
      filePath: filePath,
      name: 'file',
      formData: {},
      header: { 'Authorization': 'Bearer ' + token },
      success: function(res) {
        util.hideLoading()
        if (res.statusCode === 200) {
          resolve(JSON.parse(res.data))
        } else {
          util.showToast('上传失败')
          reject(new Error('上传失败'))
        }
      },
      fail: function(err) {
        util.hideLoading()
        util.showToast('上传失败')
        reject(err)
      }
    })
  })
}

function downloadFile(url) {
  return new Promise(function(resolve, reject) {
    var token = wx.getStorageSync('token')
    util.showLoading('下载中...')

    wx.downloadFile({
      url: BASE_URL + REQUEST_PREFIX + url,
      header: { 'Authorization': 'Bearer ' + token },
      success: function(res) {
        util.hideLoading()
        if (res.statusCode === 200) {
          resolve(res.tempFilePath)
        } else {
          var message = '下载失败'
          try {
            if (res.tempFilePath) {
              var fs = wx.getFileSystemManager()
              var content = fs.readFileSync(res.tempFilePath, 'utf8')
              if (content) {
                var parsed = JSON.parse(content)
                if (parsed && parsed.message) {
                  message = parsed.message
                }
              }
            }
          } catch (e) {}

          util.showToast(message)
          reject(new Error(message))
        }
      },
      fail: function(err) {
        util.hideLoading()
        util.showToast('下载失败')
        reject(err)
      }
    })
  })
}

var userApi = {
  login: function(data) { return request({ url: '/api/users/login', method: 'POST', data: data }) },
  getInfo: function() { return request({ url: '/api/users/info' }) },
  updateInfo: function(data) { return request({ url: '/api/users/info', method: 'PUT', data: data }) }
}

var queryApi = {
  create: function(data) { return request({ url: '/api/queries', method: 'POST', data: data }) },
  getMyList: function(params) { return request({ url: '/api/queries/my', data: params }) },
  getDetail: function(id) { return request({ url: '/api/queries/' + id }) },
  getShareInfo: function(id) { return request({ url: '/api/queries/' + id + '/share' }) },
  downloadQrCode: function(id) { return downloadFile('/api/queries/' + id + '/qrcode') },
  update: function(id, data) { return request({ url: '/api/queries/' + id, method: 'PUT', data: data }) },
  delete: function(id) { return request({ url: '/api/queries/' + id, method: 'DELETE' }) }
}

var dataApi = {
  query: function(id, conditions) {
    return request({ url: '/api/data/' + id + '/query', method: 'POST', data: { conditions: conditions } })
  },
  modify: function(id, dataId, modifications) {
    return request({ url: '/api/data/' + id + '/data/' + dataId, method: 'PUT', data: { modifications: modifications } })
  },
  sign: function(id, dataId, data) {
    return request({ url: '/api/data/' + id + '/data/' + dataId + '/sign', method: 'POST', data: data })
  }
}

var statsApi = {
  get: function(id) { return request({ url: '/api/stats/' + id }) },
  getAll: function(id, params) { return request({ url: '/api/stats/' + id + '/all', data: params }) },
  getQueried: function(id, params) { return request({ url: '/api/stats/' + id + '/queried', data: params }) },
  getUnqueried: function(id, params) { return request({ url: '/api/stats/' + id + '/unqueried', data: params }) },
  getSigned: function(id, params) { return request({ url: '/api/stats/' + id + '/signed', data: params }) },
  getUnsigned: function(id, params) { return request({ url: '/api/stats/' + id + '/unsigned', data: params }) }
}

var fileApi = {
  upload: uploadFile,
  exportData: function(id) { return downloadFile('/api/files/export/' + id) }
}

module.exports = {
  request: request,
  userApi: userApi,
  queryApi: queryApi,
  dataApi: dataApi,
  statsApi: statsApi,
  fileApi: fileApi,
  BASE_URL: BASE_URL
}
