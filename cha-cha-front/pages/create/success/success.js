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

  onShareAppMessage: function() {
    var queryId = this.data.queryId || app.globalData.createdQueryId
    return {
      title: '来查查',
      path: '/pages/query/query?id=' + queryId
    }
  },

  closeModal: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
