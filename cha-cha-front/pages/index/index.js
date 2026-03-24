var app = getApp()
var queryApi = require('../../utils/api').queryApi
var jielongApi = require('../../utils/api').jielongApi
var fileApi = require('../../utils/api').fileApi
var util = require('../../utils/util')
var formatBeijingDateTime = util.formatBeijingDateTime
var getStatusBarHeight = util.getStatusBarHeight

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    recentItems: [],
    itemPage: 1,
    hasMoreItems: true,
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
        that.setData({ recentItems: [], itemPage: 1, hasMoreItems: true })
        that.loadRecentItems()
      }
    }).catch(function() {
      that.setData({
        isLoggedIn: false,
        userInfo: null,
        loading: false
      })
    })
  },

  loadRecentItems: function() {
    var that = this
    if (!this.data.hasMoreItems) return
    this.setData({ loading: true })

    var page = this.data.itemPage
    var pageSize = 10
    var queryPromise = queryApi.getMyList({ status: '', page: page, pageSize: pageSize })
    var jielongCreatedPromise = jielongApi.getMyList({ page: page, pageSize: pageSize })
    var jielongJoinedPromise = jielongApi.getMyList({ type: 'joined', page: page, pageSize: pageSize })

    Promise.all([queryPromise, jielongCreatedPromise, jielongJoinedPromise]).then(function(results) {
      var items = []
      var queryTotal = 0
      var jielongTotal = 0
      if (results[0] && results[0].success) {
        queryTotal = results[0].data.total || 0
        ;(results[0].data.list || []).forEach(function(item) {
          items.push(Object.assign({}, item, {
            _type: 'query',
            _name: item.name || '查询',
            _key: 'q_' + item.id,
            _sortTime: new Date(item.created_at || item.create_time || 0).getTime(),
            displayCreatedAt: formatBeijingDateTime(item.created_at || item.create_time) || '刚刚'
          }))
        })
      }
      // 合并创建的和参与的接龙，去重
      var jielongMap = {}
      var allJielongs = []
      ;[results[1], results[2]].forEach(function(r) {
        if (r && r.success) {
          ;(r.data.list || []).forEach(function(item) {
            if (!jielongMap[item.id]) {
              jielongMap[item.id] = true
              allJielongs.push(item)
            }
          })
          var t = r.data.total || 0
          if (t > jielongTotal) jielongTotal = t
        }
      })
      allJielongs.forEach(function(item) {
        items.push(Object.assign({}, item, {
          _type: 'jielong',
          _name: item.title || '接龙',
          _key: 'j_' + item.id,
          _sortTime: new Date(item.created_at || item.create_time || 0).getTime(),
          displayCreatedAt: formatBeijingDateTime(item.created_at || item.create_time) || '刚刚'
        }))
      })
      items.sort(function(a, b) { return b._sortTime - a._sortTime })

      var existing = page === 1 ? [] : that.data.recentItems
      var merged = existing.concat(items)
      var loadedCount = page * pageSize
      var hasMore = loadedCount < queryTotal || loadedCount < jielongTotal

      that.setData({
        recentItems: merged,
        loading: false,
        hasMoreItems: hasMore
      })
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  onReachBottom: function() {
    if (this.data.hasMoreItems && !this.data.loading) {
      this.setData({ itemPage: this.data.itemPage + 1 })
      this.loadRecentItems()
    }
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
    
    wx.showActionSheet({
      itemList: ['从聊天记录选择', '从本地文件选择'],
      success: function(res) {
        if (res.tapIndex === 0) {
          that.chooseFromChat()
        } else if (res.tapIndex === 1) {
          that.chooseFromLocal()
        }
      }
    })
  },

  chooseFromChat: function() {
    var that = this
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

  chooseFromLocal: function() {
    var that = this
    wx.showModal({
      title: '上传本地文件',
      content: '微信小程序暂不支持直接访问手机文件，请先将Excel文件通过微信电脑版或手机文件管理器发送到「文件传输助手」，然后在下一步中选择该文件。',
      confirmText: '去选择',
      success: function(res) {
        if (res.confirm) {
          that.chooseFromChat()
        }
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
            previewRows: data.previewRows || [],
            allRows: data.allRows || []
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

  goToItem: function(e) {
    var id = e.currentTarget.dataset.id
    var type = e.currentTarget.dataset.type
    if (type === 'jielong') {
      wx.navigateTo({ url: '/pages/jielong/detail/detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/manage/manage?id=' + id })
    }
  },

  goToJielong: function() {
    wx.navigateTo({
      url: '/pages/jielong/create/create'
    })
  }
})
