var app = getApp()
var queryApi = require('../../utils/api').queryApi
var fileApi = require('../../utils/api').fileApi
var util = require('../../utils/util')
var formatBeijingDateTime = util.formatBeijingDateTime
var getStatusBarHeight = util.getStatusBarHeight

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    recentQueries: [],
    statusBarHeight: 44,
    loading: false,
    uploading: false,
    uploadProgress: 0,
    uploadComplete: false,
    uploadFileName: ''
  },

  onLoad: function() {
    this.setData({ statusBarHeight: getStatusBarHeight() })
  },

  onShow: function() {
    this.refreshData()
  },

  refreshData: function() {
    var that = this
    
    app.ensureLogin().then(function() {
      var isLoggedIn = app.globalData.isLoggedIn
      var userInfo = app.globalData.userInfo

      that.setData({
        isLoggedIn: isLoggedIn,
        userInfo: userInfo
      })

      if (isLoggedIn) {
        that.loadRecentQueries()
      }
    }).catch(function() {
      that.setData({
        isLoggedIn: false,
        userInfo: null,
        loading: false
      })
    })
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
        var recentQueries = (data.data.list || []).map(function(item) {
          return Object.assign({}, item, {
            displayCreatedAt: formatBeijingDateTime(item.created_at || item.create_time) || '刚刚'
          })
        })
        that.setData({
          recentQueries: recentQueries,
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

    this.setData({
      uploading: true,
      uploadComplete: false,
      uploadProgress: 0,
      uploadFileName: file.name
    })

    fileApi.upload(file.path, function(progressInfo) {
      that.setData({
        uploadProgress: progressInfo.progress
      })
    }).then(function(res) {
      that.setData({
        uploading: false,
        uploadComplete: true
      })

      setTimeout(function() {
        that.setData({
          uploadComplete: false
        })

        if (res.success) {
          var data = res.data
          app.globalData.uploadedFile = {
            fileId: data.fileId,
            name: file.name || data.fileName || '',
            size: that.formatFileSize(file.size),
            headers: data.headers,
            headerRowIndex: data.headerRowIndex || 0,
            rowCount: data.rowCount,
            previewRows: data.previewRows || []
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
      }, 500)
    }).catch(function(err) {
      that.setData({
        uploading: false,
        uploadComplete: false
      })
      wx.showToast({
        title: err.message || '上传失败',
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
