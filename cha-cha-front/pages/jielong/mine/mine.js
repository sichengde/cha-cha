var app = getApp()
var jielongApi = require('../../../utils/api').jielongApi
var util = require('../../../utils/util')
var formatBeijingDateTime = util.formatBeijingDateTime
var getStatusBarHeight = util.getStatusBarHeight

Page({
  data: {
    statusBarHeight: 44,
    currentTab: 'created',
    list: [],
    loading: false,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true
  },

  onLoad: function() {
    this.setData({ statusBarHeight: getStatusBarHeight() })
  },

  onShow: function() {
    this.setData({ page: 1, list: [], hasMore: true })
    this.loadList()
  },

  switchTab: function(e) {
    var tab = e.currentTarget.dataset.tab
    if (tab === this.data.currentTab) return
    this.setData({ currentTab: tab, page: 1, list: [], hasMore: true })
    this.loadList()
  },

  loadList: function() {
    var that = this
    if (this.data.loading) return

    this.setData({ loading: true })

    jielongApi.getMyList({
      type: this.data.currentTab,
      page: this.data.page,
      pageSize: this.data.pageSize
    }).then(function(data) {
      if (data.success) {
        var newList = (data.data.list || []).map(function(item) {
          return Object.assign({}, item, {
            statusText: item.status === 'open' ? '进行中' : '已结束',
            displayTime: formatBeijingDateTime(item.created_at) || '--'
          })
        })
        that.setData({
          list: that.data.page === 1 ? newList : that.data.list.concat(newList),
          total: data.data.total,
          hasMore: that.data.list.length + newList.length < data.data.total,
          loading: false
        })
      } else {
        wx.showToast({ title: data.message || '加载失败', icon: 'none' })
        that.setData({ loading: false })
      }
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  onReachBottom: function() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadList()
  },

  goToDetail: function(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/jielong/detail/detail?id=' + id })
  },

  goToCreate: function() {
    wx.navigateTo({ url: '/pages/jielong/create/create' })
  }
})
