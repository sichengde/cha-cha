var app = getApp()

Page({
  data: {
    statusBarHeight: 44
  },

  onLoad: function() {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })
  },

  goToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  }
})
