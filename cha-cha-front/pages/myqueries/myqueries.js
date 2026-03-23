var app = getApp()
var queryApi = require('../../utils/api').queryApi
var jielongApi = require('../../utils/api').jielongApi
var util = require('../../utils/util')
var getStatusText = util.getStatusText
var getStatusClass = util.getStatusClass
var formatBeijingDateTime = util.formatBeijingDateTime
var getQueryPath = util.getQueryPath
var showQrPreviewFromTempFile = util.showQrPreviewFromTempFile
var hideQrPreviewState = util.hideQrPreview
var getStatusBarHeight = util.getStatusBarHeight

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
    hasMore: true,
    showShareGuide: false,
    shareQueryId: '',
    shareQueryName: '',
    shareType: 'query',
    shareJielongId: '',
    shareJielongName: '',
    showQrPreview: false,
    qrPreviewPath: ''
  },

  onLoad: function() {
    this.setData({ statusBarHeight: getStatusBarHeight() })
  },

  onShow: function() {
    this.setData({ queryList: [], filteredQueries: [], page: 1, hasMore: true })
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

    var currentTab = this.data.currentTab
    var status = currentTab === 'all' ? '' : currentTab
    var page = this.data.page
    var pageSize = this.data.pageSize

    var queryPromise = queryApi.getMyList({ status: status, page: page, pageSize: pageSize, keyword: this.data.searchText || undefined })
    var jielongStatus = currentTab === 'all' ? undefined : (currentTab === 'active' ? 'open' : 'closed')
    var jielongParams = { page: page, pageSize: pageSize, keyword: this.data.searchText || undefined }
    if (jielongStatus) jielongParams.status = jielongStatus
    var jielongPromise = jielongApi.getMyList(jielongParams)
    var jielongJoinedParams = { type: 'joined', page: page, pageSize: pageSize, keyword: this.data.searchText || undefined }
    if (jielongStatus) jielongJoinedParams.status = jielongStatus
    var jielongJoinedPromise = jielongApi.getMyList(jielongJoinedParams)

    Promise.all([queryPromise, jielongPromise, jielongJoinedPromise]).then(function(results) {
      var items = []
      var queryTotal = 0
      var jielongTotal = 0
      if (results[0] && results[0].success) {
        queryTotal = results[0].data.total || 0
        results[0].data.list.forEach(function(query) {
          var totalCount = Number(query.total_count || query.data_count || 0)
          var queryCount = Number(query.query_count || query.queryCount || 0)
          var signedCount = Number(query.sign_count || query.signedCount || 0)
          if (isNaN(totalCount)) totalCount = 0
          if (isNaN(queryCount)) queryCount = 0
          if (isNaN(signedCount)) signedCount = 0
          var unqueriedCount = totalCount - queryCount
          if (unqueriedCount < 0) unqueriedCount = 0

          items.push(Object.assign({}, query, {
            _type: 'query',
            _key: 'q_' + query.id,
            statusText: getStatusText(query.status),
            statusClass: getStatusClass(query.status).replace('tag-', ''),
            totalCount: totalCount,
            queryCount: queryCount,
            unqueriedCount: unqueriedCount,
            signedCount: signedCount,
            createTime: formatBeijingDateTime(query.created_at || query.create_time) || '--'
          }))
        })
      }
      // 合并创建的和参与的接龙，去重
      var jielongMap = {}
      ;[results[1], results[2]].forEach(function(r) {
        if (r && r.success) {
          var t = r.data.total || 0
          if (t > jielongTotal) jielongTotal = t
          ;(r.data.list || []).forEach(function(item) {
            if (!jielongMap[item.id]) {
              jielongMap[item.id] = true
              var jielongStatus = item.status === 'open' ? 'active' : 'ended'
              items.push(Object.assign({}, item, {
                _type: 'jielong',
                _key: 'j_' + item.id,
                name: item.title,
                statusText: item.status === 'open' ? '进行中' : '已结束',
                statusClass: jielongStatus,
                memberCount: item.member_count || 0,
                createTime: formatBeijingDateTime(item.created_at || item.create_time) || '--'
              }))
            }
          })
        }
      })
      items.sort(function(a, b) {
        return new Date(b.created_at || b.create_time || 0) - new Date(a.created_at || a.create_time || 0)
      })

      var existing = page === 1 ? [] : that.data.queryList
      var merged = existing.concat(items)
      var loadedCount = page * pageSize
      var hasMore = loadedCount < queryTotal || loadedCount < jielongTotal

      that.setData({
        queryList: merged,
        filteredQueries: merged,
        total: merged.length,
        loading: false,
        hasMore: hasMore
      })
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  onSearchInput: function(e) {
    this.setData({ searchText: e.detail.value })
  },

  onSearchConfirm: function() {
    this.setData({ page: 1, queryList: [], filteredQueries: [], hasMore: true })
    this.loadQueries()
  },

  switchTab: function(e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab, page: 1, queryList: [], filteredQueries: [], hasMore: true })
    this.loadQueries()
  },

  goToManage: function(e) {
    var id = e.currentTarget.dataset.id
    var type = e.currentTarget.dataset.type
    if (type === 'jielong') {
      wx.navigateTo({ url: '/pages/jielong/detail/detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/manage/manage?id=' + id })
    }
  },

  goToCreate: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 })
      this.loadQueries()
    }
  },

  shareQuery: function(e) {
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name || ''
    this.openShareGuide(id, name)
  },

  openShareGuide: function(queryId, queryName) {
    this.setData({
      showShareGuide: true,
      shareQueryId: queryId,
      shareQueryName: queryName || '',
      shareType: 'query',
      shareJielongId: '',
      shareJielongName: ''
    })
  },

  shareJielong: function(e) {
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name || ''
    this.setData({
      showShareGuide: true,
      shareType: 'jielong',
      shareJielongId: id,
      shareJielongName: name,
      shareQueryId: '',
      shareQueryName: ''
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

  onGenerateQrCode: function() {
    var shareType = this.data.shareType
    this.hideShareGuide()
    if (shareType === 'jielong' && this.data.shareJielongId) {
      this.generateJielongQrCode(this.data.shareJielongId)
    } else if (this.data.shareQueryId) {
      this.generateQueryQrCode(this.data.shareQueryId)
    }
  },

  generateJielongQrCode: function(jielongId) {
    var that = this
    jielongApi.downloadQrCode(jielongId).then(function(tempFilePath) {
      showQrPreviewFromTempFile(that, tempFilePath)
    }).catch(function() {})
  },

  preventTap: function() {},

  onShareAppMessage: function() {
    if (this.data.shareType === 'jielong' && this.data.shareJielongId) {
      return {
        title: this.data.shareJielongName || '接龙活动',
        path: '/pages/jielong/join/join?id=' + this.data.shareJielongId
      }
    }
    var queryId = this.data.shareQueryId
    var queryName = this.data.shareQueryName
    if (queryId) {
      return {
        title: queryName || '查询',
        path: getQueryPath(queryId)
      }
    }
    return { title: '班班通' }
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
  }
})
