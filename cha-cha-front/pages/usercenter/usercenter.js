Page({
  data: {
    statusBarHeight: 44
  },

  onLoad: function() {
    var systemSetting = wx.getSystemSetting()
    this.setData({
      statusBarHeight: systemSetting.statusBarHeight || 44
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
      title: '小丽表格 - 轻量化信息查询工具',
      path: '/pages/index/index'
    }
  }
})
