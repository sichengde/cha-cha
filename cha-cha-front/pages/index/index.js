var app = getApp()
var queryApi = require('../../utils/api').queryApi
var fileApi = require('../../utils/api').fileApi

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    recentQueries: [],
    statusBarHeight: 44,
    loading: false
  },

  onLoad: function() {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })
  },

  onShow: function() {
    this.refreshData()
  },

  refreshData: function() {
    var that = this
    var isLoggedIn = app.globalData.isLoggedIn
    var userInfo = app.globalData.userInfo

    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    })

    if (isLoggedIn) {
      this.loadRecentQueries()
    }
  },

  loadRecentQueries: function() {
    var that = this
    this.setData({ loading: true })

    queryApi.getMyList({
      status: '',
      page: 1,
      pageSize: 5
    }).then(function(data) {
      if (data.success) {
        that.setData({
          recentQueries: data.data.list || [],
          loading: false
        })
      } else {
        that.setData({ loading: false })
      }
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  goToLogin: function() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  goToCreate: function() {
    var that = this
    if (!app.globalData.isLoggedIn) {
      this.goToLogin()
      return
    }
    
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xls', 'xlsx'],
      success: function(res) {
        var file = res.tempFiles[0]
        that.processFile(file)
      },
      fail: function(err) {
        console.log('选择文件取消或失败', err)
      }
    })
  },

  processFile: function(file) {
    var that = this
    
    fileApi.upload(file.path).then(function(res) {
      if (res.success) {
        var data = res.data
        app.globalData.uploadedFile = {
          name: file.name,
          size: that.formatFileSize(file.size),
          path: file.path,
          headers: data.headers,
          rows: data.data,
          allRows: data.allRows,
          headerRowIndex: 0,
          rowCount: data.rowCount
        }

        wx.navigateTo({
          url: '/pages/create/preview/preview'
        })
      } else {
        wx.showToast({
          title: res.message || '解析失败',
          icon: 'none'
        })
      }
    }).catch(function(err) {
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      })
    })
  },

  formatFileSize: function(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  },

  goToManage: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/manage/manage?id=' + id
    })
  }
})
