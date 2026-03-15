var api = require('./utils/api')
var userApi = api.userApi

App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    baseUrl: 'http://192.168.1.14:3000',
    querySettings: null,
    loginPromise: null
  },

  onLaunch: function() {
    this.autoLogin()
  },

  autoLogin: function() {
    var that = this
    var userInfo = wx.getStorageSync('userInfo')
    var token = wx.getStorageSync('token')
    
    if (userInfo && token) {
      this.globalData.userInfo = userInfo
      this.globalData.isLoggedIn = true
      return
    }
    
    this.doLogin()
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
            var openid = 'wx_' + res.code + '_' + Date.now()
            
            userApi.login({
              openid: openid,
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
