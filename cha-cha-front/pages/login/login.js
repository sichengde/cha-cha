var app = getApp()

Page({
  data: {
    loading: true
  },

  onLoad: function() {
    this.checkAndRedirect()
  },

  onShow: function() {
    this.checkAndRedirect()
  },

  checkAndRedirect: function() {
    var that = this
    if (app.globalData.isLoggedIn) {
      this.redirectToHome()
      return
    }
    
    this.setData({ loading: true })
    
    setTimeout(function() {
      if (app.globalData.isLoggedIn) {
        that.redirectToHome()
      } else {
        that.setData({ loading: false })
      }
    }, 1500)
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
