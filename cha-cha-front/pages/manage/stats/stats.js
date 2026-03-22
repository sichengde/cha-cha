var app = getApp()
var api = require('../../../utils/api')
var statsApi = api.statsApi
var queryApi = api.queryApi

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
    var systemSetting = wx.getSystemSetting()
    this.setData({
      statusBarHeight: systemSetting.statusBarHeight || 44
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

    Promise.all([
      statsApi.get(queryId),
      queryApi.getDetail(queryId)
    ]).then(function(results) {
      var statsData = results[0]
      var queryData = results[1]

      if (statsData.success) {
        var summary = statsData.data.summary
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

      if (queryData.success) {
        that.setData({
          queryInfo: queryData.data
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
      case 'all':
        apiCall = statsApi.getAll(queryId, { page: 1, pageSize: 100 })
        break
      case 'queried':
        apiCall = statsApi.getQueried(queryId, { page: 1, pageSize: 100 })
        break
      case 'unqueried':
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
            var keys = Object.keys(row).filter(function(key) {
              return key.charAt(0) !== '_'
            })
            var nameKey = keys[0]
            var idKey = keys[1] || keys[0]

            return {
              name: row[nameKey] || '用户' + (index + 1),
              id: row[idKey] || 'ID' + (index + 1),
              queried: !!row._queried,
              signed: !!row._signed,
              queryTime: row._queryTime || '',
              modified: false
            }
          })
        })
      } else {
        that.setData({ filteredDetails: [] })
      }
    }).catch(function() {
      that.setData({ filteredDetails: [] })
    })
  },

  switchTab: function(e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    this.loadFilteredDetails()
  }
})
