var api = require('./utils/api')
var userApi = api.userApi
var BASE_URL = api.BASE_URL

App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    baseUrl: BASE_URL,
    querySettings: null,
    loginPromise: null,
    shareSuccess: false
  },

  onLaunch: function() {
    this.doLogin()
  },

  onShow: function(options) {
    if (options && options.shareTickets && options.shareTickets.length > 0) {
      this.globalData.shareSuccess = true
    }
  },

  autoLogin: function() {
    return this.doLogin()
  },

  doLogin: function() {
    var that = this
    
    if (this.globalData.loginPromise) {
      return this.globalData.loginPromise
    }
    
    this.globalData.loginPromise = new Promise(function(resolve, reject) {
      wx.login({
        success: function(res) {
          if (res.code) {
            userApi.login({
              login_code: res.code,
              nickname: '微信用户',
              avatar_url: ''
            }).then(function(data) {
              if (data.success) {
                var userInfo = data.data.userInfo
                var token = data.data.token
                
                that.globalData.userInfo = userInfo
                that.globalData.isLoggedIn = true
                wx.setStorageSync('userInfo', userInfo)
                wx.setStorageSync('token', token)
                
                that.globalData.loginPromise = null
                resolve(data)
              } else {
                console.error('登录失败:', data.message)
                that.globalData.loginPromise = null
                reject(new Error(data.message || '登录失败'))
              }
            }).catch(function(err) {
              console.error('登录请求失败:', err)
              that.globalData.loginPromise = null
              reject(err)
            })
          } else {
            console.error('wx.login失败:', res.errMsg)
            that.globalData.loginPromise = null
            reject(new Error(res.errMsg || '微信登录失败'))
          }
        },
        fail: function(err) {
          console.error('wx.login调用失败:', err)
          that.globalData.loginPromise = null
          reject(err)
        }
      })
    })
    
    return this.globalData.loginPromise
  },

  ensureLogin: function() {
    var that = this
    if (this.globalData.isLoggedIn) {
      return Promise.resolve()
    }
    return this.doLogin()
  },

  logout: function() {
    this.globalData.userInfo = null
    this.globalData.isLoggedIn = false
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('token')
    this.doLogin()
  },

  setQuerySettings: function(settings) {
    this.globalData.querySettings = settings
  },

  getQuerySettings: function() {
    return this.globalData.querySettings
  }
})
