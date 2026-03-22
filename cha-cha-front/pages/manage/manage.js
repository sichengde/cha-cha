var app = getApp()
var api = require('../../utils/api')
var queryApi = api.queryApi
var statsApi = api.statsApi
var fileApi = api.fileApi
var util = require('../../utils/util')
var getQueryPath = util.getQueryPath
var openShareMenu = util.showQueryShareActionSheet
var showQrPreviewFromTempFile = util.showQrPreviewFromTempFile
var hideQrPreviewState = util.hideQrPreview

Page({
  data: {
    statusBarHeight: 44,
    queryId: '',
    queryInfo: {
      name: '',
      description: '',
      status: 'active',
      settings: {}
    },
    stats: {
      total: 0,
      queried: 0,
      unqueried: 0,
      signed: 0,
      queryRate: 0
    },
    tableHeaders: [],
    filteredRows: [],
    filterText: '全部',
    currentFilter: 'all',
    loading: false,
    page: 1,
    pageSize: 50,
    hasMore: true,
    total: 0,
    showShareGuide: false,
    shareQueryId: '',
    shareQueryName: '',
    showQrPreview: false,
    qrPreviewPath: ''
  },

  onLoad: function(options) {
    var systemSetting = wx.getSystemSetting()
    this.setData({
      statusBarHeight: systemSetting.statusBarHeight || 44
    })

    if (options.id) {
      this.setData({ queryId: options.id })
      this.loadQueryInfo(options.id)
    }
  },

  onShow: function() {
    if (this.data.queryId && this.data.queryInfo && this.data.queryInfo.id) {
      this.loadQueryInfo(this.data.queryId)
    }
  },

  goBack: function() {
    wx.navigateBack()
  },

  loadQueryInfo: function(queryId) {
    var that = this
    this.setData({ loading: true })

    Promise.all([
      queryApi.getDetail(queryId),
      statsApi.get(queryId)
    ]).then(function(results) {
      var queryData = results[0]
      var statsData = results[1]

      if (queryData.success) {
        var queryInfo = queryData.data
        var headers = queryInfo.headers || []
        
        that.setData({
          queryInfo: queryInfo,
          tableHeaders: headers.map(function(h) { return h.column_name })
        })
      }

      if (statsData.success) {
        var summary = statsData.data.summary
        that.setData({
          stats: {
            total: summary.totalData,
            queried: summary.queriedData,
            unqueried: summary.unqueriedData,
            signed: summary.signedData,
            queryRate: summary.queryRate
          }
        })
      }

      that.setData({ loading: false })
      that.loadFilteredRows()
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  loadFilteredRows: function(loadMore) {
    var that = this
    var queryId = this.data.queryId
    var currentFilter = this.data.currentFilter
    var page = loadMore ? this.data.page + 1 : 1
    var pageSize = this.data.pageSize
    
    if (this.data.loading) return
    if (loadMore && !this.data.hasMore) return
    
    this.setData({ loading: true })
    
    var apiCall
    switch (currentFilter) {
      case 'all':
        apiCall = statsApi.getAll(queryId, { page: page, pageSize: pageSize })
        break
      case 'queried':
        apiCall = statsApi.getQueried(queryId, { page: page, pageSize: pageSize })
        break
      case 'unqueried':
        apiCall = statsApi.getUnqueried(queryId, { page: page, pageSize: pageSize })
        break
      case 'signed':
        apiCall = statsApi.getSigned(queryId, { page: page, pageSize: pageSize })
        break
      case 'unsigned':
        apiCall = statsApi.getUnsigned(queryId, { page: page, pageSize: pageSize })
        break
      default:
        this.setData({ filteredRows: [], loading: false })
        return
    }

    apiCall.then(function(data) {
      if (data.success) {
        var tableHeaders = that.data.tableHeaders
        var newRows = data.data.list.map(function(row) {
          return {
            data: tableHeaders.map(function(header) {
              var value = row[header]
              return value === undefined || value === null ? '' : value
            }),
            queried: row._queried,
            signed: row._signed
          }
        })
        
        var allRows = loadMore ? that.data.filteredRows.concat(newRows) : newRows
        
        that.setData({
          filteredRows: allRows,
          page: page,
          total: data.data.total,
          hasMore: allRows.length < data.data.total,
          loading: false
        })
      } else {
        that.setData({ loading: false })
      }
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  loadMore: function() {
    this.loadFilteredRows(true)
  },

  goToStats: function() {
    wx.navigateTo({
      url: '/pages/manage/stats/stats?id=' + this.data.queryId
    })
  },

  exportData: function() {
    var that = this
    var queryId = this.data.queryId
    wx.showLoading({ title: '导出中...' })
    
    fileApi.exportData(queryId).then(function(tempFilePath) {
      wx.hideLoading()
      that.handleExportedFile(tempFilePath)
    }).catch(function() {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    })
  },

  shareQuery: function() {
    var that = this
    var queryId = this.data.queryId
    var queryName = (this.data.queryInfo && this.data.queryInfo.name) || ''

    if (!queryId) {
      wx.showToast({ title: '查询不存在', icon: 'none' })
      return
    }

    openShareMenu(function() {
      that.openShareGuide(queryId, queryName)
    }, function() {
      that.generateQueryQrCode(queryId)
    })
  },

  openShareGuide: function(queryId, queryName) {
    this.setData({
      showShareGuide: true,
      shareQueryId: queryId,
      shareQueryName: queryName || ''
    })
  },

  hideShareGuide: function() {
    this.setData({ showShareGuide: false })
  },

  onShareButtonTap: function() {
    this.hideShareGuide()
  },

  generateQueryQrCode: function(queryId) {
    var that = this
    queryApi.downloadQrCode(queryId).then(function(tempFilePath) {
      showQrPreviewFromTempFile(that, tempFilePath)
    }).catch(function() {})
  },

  hideQrPreview: function() {
    hideQrPreviewState(this)
  },

  handleExportedFile: function(tempFilePath) {
    var that = this
    if (!tempFilePath) {
      wx.showToast({ title: '导出文件为空', icon: 'none' })
      return
    }

    wx.saveFile({
      tempFilePath: tempFilePath,
      success: function(res) {
        that.showExportActionSheet(res.savedFilePath || tempFilePath)
      },
      fail: function() {
        that.showExportActionSheet(tempFilePath)
      }
    })
  },

  showExportActionSheet: function(filePath) {
    var that = this
    wx.showActionSheet({
      itemList: ['直接打开', '转发给微信好友'],
      success: function(res) {
        if (res.tapIndex === 0) {
          that.openExportFile(filePath, false)
        } else if (res.tapIndex === 1) {
          that.shareExportFile(filePath)
        }
      }
    })
  },

  openExportFile: function(filePath, fromShareGuide) {
    wx.openDocument({
      filePath: filePath,
      fileType: 'xlsx',
      showMenu: true,
      success: function() {
        if (fromShareGuide) {
          wx.showToast({ title: '请在右上角菜单转发', icon: 'none' })
        }
      },
      fail: function() {
        wx.showToast({ title: '打开文件失败', icon: 'none' })
      }
    })
  },

  shareExportFile: function(filePath) {
    var that = this
    if (typeof wx.shareFileMessage === 'function') {
      wx.shareFileMessage({
        filePath: filePath,
        fileName: (this.data.queryInfo.name || '查询数据') + '.xlsx',
        success: function() {
          wx.showToast({ title: '转发成功', icon: 'success' })
        },
        fail: function() {
          that.openExportFile(filePath, true)
        }
      })
      return
    }

    that.openExportFile(filePath, true)
  },

  showFilter: function() {
    var that = this
    wx.showActionSheet({
      itemList: ['全部', '已查询', '未查询', '已签收', '未签收'],
      success: function(res) {
        var filters = ['all', 'queried', 'unqueried', 'signed', 'unsigned']
        var texts = ['全部', '已查询', '未查询', '已签收', '未签收']
        that.setData({
          currentFilter: filters[res.tapIndex],
          filterText: texts[res.tapIndex],
          page: 1,
          hasMore: true
        })
        that.loadFilteredRows()
      }
    })
  },

  toggleStatus: function(e) {
    var that = this
    var newStatus = e.detail.value ? 'active' : 'ended'
    
    queryApi.update(this.data.queryId, { status: newStatus }).then(function(data) {
      if (data.success) {
        that.setData({
          'queryInfo.status': newStatus
        })
        wx.showToast({
          title: newStatus === 'active' ? '已开启' : '已关闭',
          icon: 'success'
        })
      }
    })
  },

  editQuery: function() {
    wx.navigateTo({
      url: '/pages/create/settings/settings?editId=' + this.data.queryId
    })
  },

  deleteQuery: function() {
    var that = this
    wx.showModal({
      title: '确认删除',
      content: '删除后数据将无法恢复，确定要删除吗？',
      confirmColor: '#ff4d4f',
      success: function(res) {
        if (res.confirm) {
          queryApi.delete(that.data.queryId).then(function(data) {
            if (data.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              
              setTimeout(function() {
                wx.navigateBack()
              }, 1500)
            } else {
              wx.showToast({ title: data.message || '删除失败', icon: 'none' })
            }
          })
        }
      }
    })
  },

  onShareAppMessage: function() {
    var queryId = this.data.shareQueryId || this.data.queryId
    var title = this.data.shareQueryName || (this.data.queryInfo && this.data.queryInfo.name) || '小丽表格'
    return {
      title: title,
      path: queryId ? getQueryPath(queryId) : '/pages/index/index'
    }
  }
})
