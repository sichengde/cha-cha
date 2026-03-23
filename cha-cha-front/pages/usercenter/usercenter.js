var util = require('../../utils/util')
var api = require('../../utils/api')
var userApi = api.userApi
var getStatusBarHeight = util.getStatusBarHeight

Page({
  data: {
    statusBarHeight: 44,
    userInfo: {}
  },

  onLoad: function() {
    this.setData({ statusBarHeight: getStatusBarHeight() })
  },

  onShow: function() {
    this.loadUserInfo()
  },

  loadUserInfo: function() {
    var that = this
    userApi.getInfo().then(function(res) {
      if (res.success) {
        that.setData({ userInfo: res.data })
      }
    }).catch(function() {})
  },

  onChooseAvatar: function(e) {
    var that = this
    var tempFilePath = e.detail.avatarUrl
    if (!tempFilePath) return
    // 先显示临时头像
    var userInfo = this.data.userInfo
    userInfo.avatar_url = tempFilePath
    this.setData({ userInfo: userInfo })
    // 上传到服务器
    userApi.uploadAvatar(tempFilePath).then(function(res) {
      if (res.success) {
        var avatarUrl = api.BASE_URL + res.data.path
        return userApi.updateInfo({ avatar_url: avatarUrl })
      }
    }).then(function(result) {
      if (result && result.success) {
        that.setData({ userInfo: result.data })
        wx.showToast({ title: '头像已更新', icon: 'success' })
      }
    }).catch(function() {
      wx.showToast({ title: '头像上传失败', icon: 'none' })
    })
  },

  onNicknameChange: function(e) {
    var that = this
    var nickname = e.detail.value
    if (!nickname) return
    var userInfo = this.data.userInfo
    userInfo.nickname = nickname
    this.setData({ userInfo: userInfo })
    userApi.updateInfo({ nickname: nickname }).then(function(result) {
      if (result.success) {
        that.setData({ userInfo: result.data })
        wx.showToast({ title: '昵称已更新', icon: 'success' })
      }
    })
  },

  goToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  onShareButtonTap: function() {},

  onShareAppMessage: function() {
    return {
      title: '班班通丨线上收集 - 轻量化信息查询工具',
      path: '/pages/index/index'
    }
  }
})
