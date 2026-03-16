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
    wx.navigateTo({
      url: '/pages/about/agreement'
    })
  },

  goToPrivacy: function() {
    wx.navigateTo({
      url: '/pages/about/privacy'
    })
  }
})
