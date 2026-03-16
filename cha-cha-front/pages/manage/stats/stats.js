var app = getApp()
var api = require('../../../utils/api')
var statsApi = api.statsApi

Page({
  data: {
    statusBarHeight: 44,
    queryId: '',
    queryInfo: {},
    stats: {
      total: 0,
      queried: 0,
      unqueried: 0,
      signed: 0,
      queryRate: 0,
      signRate: 0
    },
    currentTab: 'all',
    filteredDetails: [],
    loading: false
  },

  onLoad: function(options) {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })

    if (options.id) {
      this.setData({ queryId: options.id })
      this.loadStats(options.id)
    }
  },

  goBack: function() {
    wx.navigateBack()
  },

  loadStats: function(queryId) {
    var that = this
    this.setData({ loading: true })

    statsApi.get(queryId).then(function(data) {
      if (data.success) {
        var summary = data.data.summary
        that.setData({
          stats: {
            total: summary.totalData,
            queried: summary.queriedData,
            unqueried: summary.unqueriedData,
            signed: summary.signedData,
            queryRate: summary.queryRate,
            signRate: summary.signRate
          }
        })
      }
      that.setData({ loading: false })
      that.loadFilteredDetails()
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  loadFilteredDetails: function() {
    var that = this
    var queryId = this.data.queryId
    var currentTab = this.data.currentTab
    
    var apiCall
    switch (currentTab) {
      case 'unqueried':
        apiCall = statsApi.getUnqueried(queryId, { page: 1, pageSize: 100 })
        break
      case 'queried':
        apiCall = statsApi.getUnqueried(queryId, { page: 1, pageSize: 100 })
        break
      default:
        this.setData({ filteredDetails: [] })
        return
    }

    apiCall.then(function(data) {
      if (data.success) {
        that.setData({
          filteredDetails: data.data.list.map(function(row, index) {
            var keys = Object.keys(row)
            return {
              name: row[keys[0]] || '用户' + (index + 1),
              id: row[keys[1]] || 'ID' + (index + 1),
              queried: currentTab === 'queried',
              signed: false,
              queryTime: '',
              modified: false
            }
          })
        })
      }
    })
  },

  switchTab: function(e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    this.loadFilteredDetails()
  }
})
