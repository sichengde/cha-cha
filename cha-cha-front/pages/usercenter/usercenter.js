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
  },

  onShareButtonTap: function() {},

  onShareAppMessage: function() {
    return {
      title: '查查助手 - 轻量化信息查询工具',
      path: '/pages/index/index'
    }
  }
})
