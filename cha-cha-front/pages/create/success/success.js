var app = getApp()

Page({
  data: {
    queryId: null
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({ queryId: options.id })
    }
  },

  onShow: function() {
    if (this.data.queryId) {
      wx.switchTab({
        url: '/pages/index/index'
      })
    }
  },

  closeModal: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
