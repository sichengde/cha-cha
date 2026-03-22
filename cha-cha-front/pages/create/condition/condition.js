var app = getApp()
var fileApi = require('../../../utils/api').fileApi

Page({
  data: {
    statusBarHeight: 44,
    headers: [],
    editId: ''
  },

  onLoad: function(options) {
    var systemSetting = wx.getSystemSetting()
    this.setData({
      statusBarHeight: systemSetting.statusBarHeight || 44,
      editId: options && options.editId ? options.editId : ''
    })
    this.initHeaders()
  },

  initHeaders: function() {
    var uploadedFile = app.globalData.uploadedFile
    var selectedHeaders = app.globalData.selectedHeaders || []
    var selectedNames = {}
    selectedHeaders.forEach(function(header) {
      selectedNames[header.name] = true
    })

    if (uploadedFile && uploadedFile.headers) {
      var headers = uploadedFile.headers.map(function(name, index) {
        return {
          name: name,
          index: index,
          selected: !!selectedNames[name]
        }
      })
      this.setData({ headers: headers })
    }
  },

  goBack: function() {
    var globalUploadedFile = app.globalData.uploadedFile
    if (globalUploadedFile && globalUploadedFile.fileId) {
      fileApi.deleteTemp(globalUploadedFile.fileId).catch(function() {})
    }
    wx.navigateBack()
  },

  reselectHeader: function() {
    wx.navigateBack({
      delta: 1
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

    if (this.data.editId) {
      wx.navigateBack({
        delta: 1
      })
      return
    }

    wx.navigateTo({
      url: '/pages/create/settings/settings'
    })
  }
})
