var app = getApp()
var api = require('../../utils/api')
var queryApi = api.queryApi
var statsApi = api.statsApi
var fileApi = api.fileApi

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
    total: 0
  },

  onLoad: function(options) {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })

    if (options.id) {
      this.setData({ queryId: options.id })
      this.loadQueryInfo(options.id)
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
      case 'queried':
        apiCall = statsApi.getAll(queryId, { page: page, pageSize: pageSize })
        break
      case 'unqueried':
        apiCall = statsApi.getUnqueried(queryId, { page: page, pageSize: pageSize })
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
        var newRows = data.data.list.map(function(row) {
          return {
            data: Object.values(row),
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
    var queryId = this.data.queryId
    wx.showLoading({ title: '导出中...' })
    
    fileApi.exportData(queryId).then(function() {
      wx.hideLoading()
      wx.showToast({ title: '导出成功', icon: 'success' })
    }).catch(function() {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    })
  },

  exportSignatures: function() {
    var queryId = this.data.queryId
    var settings = this.data.queryInfo.settings || {}
    
    if (!settings.enableSign) {
      wx.showToast({ title: '未开启签收功能', icon: 'none' })
      return
    }

    wx.showLoading({ title: '导出中...' })
    
    fileApi.exportSignatures(queryId).then(function() {
      wx.hideLoading()
      wx.showToast({ title: '导出成功', icon: 'success' })
    }).catch(function() {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    })
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
    return {
      title: this.data.queryInfo.name,
      path: '/pages/query/query?id=' + this.data.queryId
    }
  }
})
