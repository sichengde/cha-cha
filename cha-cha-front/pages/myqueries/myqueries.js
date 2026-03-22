var app = getApp()
var queryApi = require('../../utils/api').queryApi
var util = require('../../utils/util')
var getStatusText = util.getStatusText
var getStatusClass = util.getStatusClass
var formatBeijingDateTime = util.formatBeijingDateTime
var getQueryPath = util.getQueryPath
var openShareMenu = util.showQueryShareActionSheet
var showQrPreviewFromTempFile = util.showQrPreviewFromTempFile
var hideQrPreviewState = util.hideQrPreview

Page({
  data: {
    statusBarHeight: 44,
    searchText: '',
    currentTab: 'all',
    queryList: [],
    filteredQueries: [],
    loading: false,
    page: 1,
    pageSize: 10,
    total: 0,
    showShareGuide: false,
    shareQueryId: '',
    shareQueryName: '',
    showQrPreview: false,
    qrPreviewPath: ''
  },

  onLoad: function() {
    var systemSetting = wx.getSystemSetting()
    this.setData({
      statusBarHeight: systemSetting.statusBarHeight || 44
    })
  },

  onShow: function() {
    this.loadQueries()
  },

  loadQueries: function() {
    var that = this
    if (!app.globalData.isLoggedIn) {
      app.ensureLogin().then(function() {
        that.loadQueries()
      }).catch(function() {
        that.setData({
          queryList: [],
          filteredQueries: [],
          loading: false
        })
      })
      return
    }

    this.setData({ loading: true })

    var status = this.data.currentTab === 'all' ? '' : this.data.currentTab
    
    queryApi.getMyList({
      status: status,
      page: this.data.page,
      pageSize: this.data.pageSize
    }).then(function(data) {
      if (data.success) {
        var processedList = data.data.list.map(function(query) {
          var totalCount = Number(query.total_count || query.data_count || 0)
          var queryCount = Number(query.query_count || query.queryCount || 0)
          var signedCount = Number(query.sign_count || query.signedCount || 0)
          if (isNaN(totalCount)) totalCount = 0
          if (isNaN(queryCount)) queryCount = 0
          if (isNaN(signedCount)) signedCount = 0
          var unqueriedCount = totalCount - queryCount
          if (unqueriedCount < 0) unqueriedCount = 0

          return Object.assign({}, query, {
            statusText: getStatusText(query.status),
            statusClass: getStatusClass(query.status).replace('tag-', ''),
            totalCount: totalCount,
            queryCount: queryCount,
            unqueriedCount: unqueriedCount,
            signedCount: signedCount,
            createTime: formatBeijingDateTime(query.created_at || query.create_time) || '--'
          })
        })

        that.setData({
          queryList: processedList,
          filteredQueries: processedList,
          total: data.data.total,
          loading: false
        })
        that.filterQueries()
      } else {
        wx.showToast({
          title: data.message || '加载失败',
          icon: 'none'
        })
        that.setData({ loading: false })
      }
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  onSearch: function(e) {
    this.setData({ searchText: e.detail.value })
    this.filterQueries()
  },

  switchTab: function(e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab, page: 1 })
    this.loadQueries()
  },

  filterQueries: function() {
    var queryList = this.data.queryList
    var searchText = this.data.searchText
    var filtered = queryList.slice()

    if (searchText) {
      filtered = filtered.filter(function(q) {
        return (q.name || '').toLowerCase().indexOf(searchText.toLowerCase()) !== -1
      })
    }

    this.setData({ filteredQueries: filtered })
  },

  goToManage: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/manage/manage?id=' + id
    })
  },

  goToCreate: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  shareQuery: function(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name || ''
    
    openShareMenu(function() {
      that.openShareGuide(id, name)
    }, function() {
      that.generateQueryQrCode(id)
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

  generateQueryQrCode: function(queryId) {
    var that = this
    queryApi.downloadQrCode(queryId).then(function(tempFilePath) {
      showQrPreviewFromTempFile(that, tempFilePath)
    }).catch(function() {})
  },

  hideQrPreview: function() {
    hideQrPreviewState(this)
  },

  onShareButtonTap: function() {
    this.hideShareGuide()
  },

  editQuery: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/create/settings/settings?editId=' + id
    })
  },

  deleteQuery: function(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      success: function(res) {
        if (res.confirm) {
          queryApi.delete(id).then(function(data) {
            if (data.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              that.loadQueries()
            } else {
              wx.showToast({
                title: data.message || '删除失败',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  },

  onShareAppMessage: function() {
    var queryId = this.data.shareQueryId
    if (queryId) {
      return {
        title: this.data.shareQueryName || '小丽表格',
        path: getQueryPath(queryId)
      }
    }

    return {
      title: '小丽表格 - 轻量化信息查询工具',
      path: '/pages/index/index'
    }
  }
})
