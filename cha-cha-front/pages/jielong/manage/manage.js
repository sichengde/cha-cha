var app = getApp()
var api = require('../../../utils/api')
var jielongApi = api.jielongApi
var util = require('../../../utils/util')
var formatBeijingDateTime = util.formatBeijingDateTime
var getStatusBarHeight = util.getStatusBarHeight
var goBack = util.goBack

Page({
  data: {
    statusBarHeight: 44,
    jielongId: '',
    jielong: null,
    members: [],
    memberCount: 0,
    loading: true
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getStatusBarHeight() })
    if (options.id) {
      this.setData({ jielongId: options.id })
      this.loadDetail()
    }
  },

  goBack: goBack,

  loadDetail: function() {
    var that = this
    this.setData({ loading: true })

    jielongApi.getDetail(this.data.jielongId).then(function(res) {
      if (res.success) {
        var d = res.data
        var members = d.members || []
        members.forEach(function(m) {
          m.joined_at = formatBeijingDateTime(m.joined_at)
        })
        that.setData({
          jielong: d,
          members: members,
          memberCount: d.member_count,
          loading: false
        })
      } else {
        that.setData({ loading: false })
      }
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  removeMember: function(e) {
    var that = this
    var memberId = e.currentTarget.dataset.id
    var memberName = e.currentTarget.dataset.name

    wx.showModal({
      title: '确认移除',
      content: '确定将「' + memberName + '」从名单中移除吗？此操作不可撤销。',
      confirmColor: '#e53935',
      success: function(res) {
        if (res.confirm) {
          jielongApi.removeMember(that.data.jielongId, memberId).then(function(res) {
            if (res.success) {
              wx.showToast({ title: '已移除', icon: 'success' })
              that.loadDetail()
            }
          })
        }
      }
    })
  },

  exportMembers: function() {
    var that = this
    wx.showLoading({ title: '导出中...' })

    jielongApi.exportMembers(this.data.jielongId).then(function(tempFilePath) {
      wx.hideLoading()
      if (!tempFilePath) {
        wx.showToast({ title: '导出文件为空', icon: 'none' })
        return
      }
      wx.saveFile({
        tempFilePath: tempFilePath,
        success: function(res) {
          that.showExportActions(res.savedFilePath || tempFilePath)
        },
        fail: function() {
          that.showExportActions(tempFilePath)
        }
      })
    }).catch(function() {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    })
  },

  showExportActions: function(filePath) {
    wx.showActionSheet({
      itemList: ['直接打开', '转发给微信好友'],
      success: function(res) {
        if (res.tapIndex === 0) {
          wx.openDocument({
            filePath: filePath,
            fileType: 'xlsx',
            showMenu: true
          })
        } else if (res.tapIndex === 1) {
          if (typeof wx.shareFileMessage === 'function') {
            wx.shareFileMessage({
              filePath: filePath,
              fileName: '报名名单.xlsx'
            })
          } else {
            wx.openDocument({ filePath: filePath, fileType: 'xlsx', showMenu: true })
            wx.showToast({ title: '请在右上角菜单转发', icon: 'none' })
          }
        }
      }
    })
  }
})
