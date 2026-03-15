var app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    headers: []
  },

  onLoad: function(options) {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })
    this.initHeaders()
  },

  initHeaders: function() {
    var uploadedFile = app.globalData.uploadedFile
    if (uploadedFile && uploadedFile.headers) {
      var headers = uploadedFile.headers.map(function(name, index) {
        return {
          name: name,
          index: index,
          selected: false
        }
      })
      this.setData({ headers: headers })
    }
  },

  goBack: function() {
    wx.navigateBack()
  },

  reselectHeader: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  toggleCondition: function(e) {
    var index = e.currentTarget.dataset.index
    var headers = this.data.headers
    headers[index].selected = !headers[index].selected
    this.setData({ headers: headers })
  },

  goToSettings: function() {
    var selectedHeaders = this.data.headers.filter(function(h) { return h.selected })
    if (selectedHeaders.length === 0) {
      wx.showToast({
        title: '请至少选择一个查询条件',
        icon: 'none'
      })
      return
    }

    app.globalData.selectedHeaders = selectedHeaders
    wx.navigateTo({
      url: '/pages/create/settings/settings'
    })
  }
})
