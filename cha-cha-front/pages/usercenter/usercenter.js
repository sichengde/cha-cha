var util = require('../../utils/util')
var getStatusBarHeight = util.getStatusBarHeight

Page({
  data: {
    statusBarHeight: 44
  },

  onLoad: function() {
    this.setData({ statusBarHeight: getStatusBarHeight() })
  },

  goToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  onShareButtonTap: function() {},

  onShareAppMessage: function() {
    return {
      title: '班班通丨线上收集 - 轻量化信息查询工具',
      path: '/pages/index/index'
    }
  }
})
