var app = getApp()
var queryApi = require('../../utils/api').queryApi
var util = require('../../utils/util')
var getStatusText = util.getStatusText
var getStatusClass = util.getStatusClass

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
    total: 0
  },

  onLoad: function() {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
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
          return Object.assign({}, query, {
            statusText: getStatusText(query.status),
            statusClass: getStatusClass(query.status).replace('tag-', ''),
            totalCount: query.data_count || 0
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
        return q.name.toLowerCase().indexOf(searchText.toLowerCase()) !== -1
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
    var id = e.currentTarget.dataset.id
    
    wx.showActionSheet({
      itemList: ['转发给好友', '生成二维码', '复制链接'],
      success: function(res) {
        if (res.tapIndex === 0) {
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
          })
        } else if (res.tapIndex === 1) {
          wx.showToast({
            title: '二维码已保存',
            icon: 'success'
          })
        } else if (res.tapIndex === 2) {
          wx.setClipboardData({
            data: 'pages/query/query?id=' + id,
            success: function() {
              wx.showToast({
                title: '链接已复制',
                icon: 'success'
              })
            }
          })
        }
      }
    })
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
    return {
      title: '查查助手 - 轻量化信息查询工具',
      path: '/pages/index/index'
    }
  }
})
