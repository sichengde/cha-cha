var app = getApp()

Page({
  data: {
    loading: true
  },

  onLoad: function() {
    this.doLogin()
  },

  onShow: function() {
    if (app.globalData.isLoggedIn) {
      this.redirectToHome()
    }
  },

  doLogin: function() {
    var that = this
    this.setData({ loading: true })
    
    app.ensureLogin().then(function() {
      if (app.globalData.isLoggedIn) {
        that.redirectToHome()
      } else {
        that.setData({ loading: false })
      }
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  redirectToHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  goToAgreement: function() {
    wx.showModal({
      title: '用户协议',
      content: '感谢您使用班班通丨线上收集。使用本服务即表示您同意遵守相关条款和规定。',
      showCancel: false
    })
  },

  goToPrivacy: function() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私保护。您的数据将被安全存储，不会泄露给第三方。',
      showCancel: false
    })
  }
})
