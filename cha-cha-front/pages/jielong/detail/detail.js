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
    isCreator: false,
    isJoined: false,
    isClosed: false,
    isFull: false,
    memberCount: 0,
    loading: true,
    showRemarkPopup: false,
    remarkInput: '',
    fieldValues: {},
    firstRequiredField: '',
    isDirectEntry: false
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getStatusBarHeight() })
    var pages = getCurrentPages()
    if (pages.length <= 1) {
      this.setData({ isDirectEntry: true })
    }
    if (options.id) {
      this.setData({ jielongId: options.id })
      this.loadDetail()
    }
  },

  onShow: function() {
    if (this.data.jielongId && this.data.jielong) {
      this.loadDetail()
    }
  },

  goBack: goBack,

  goHome: function() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  loadDetail: function() {
    var that = this
    this.setData({ loading: true })

    jielongApi.getDetail(this.data.jielongId).then(function(res) {
      if (res.success) {
        var d = res.data
        // 找到第一个必填字段
        var fields = d.fields || []
        var firstRequired = ''
        for (var i = 0; i < fields.length; i++) {
          if (fields[i].required) {
            firstRequired = fields[i].name
            break
          }
        }
        // 格式化截止时间
        if (d.deadline) {
          d.deadline = formatBeijingDateTime(d.deadline)
        }
        // 为每个成员计算显示名称
        var members = d.members || []
        members.forEach(function(m) {
          if (firstRequired && m.field_values && m.field_values[firstRequired]) {
            m.displayName = m.field_values[firstRequired]
          } else {
            m.displayName = m.nickname
          }
          m.joined_at = formatBeijingDateTime(m.joined_at)
        })
        that.setData({
          jielong: d,
          members: members,
          isCreator: d.is_creator,
          isJoined: d.is_joined,
          isClosed: d.status === 'closed',
          isFull: !!(d.max_count && d.member_count >= d.max_count),
          memberCount: d.member_count,
          firstRequiredField: firstRequired,
          loading: false
        })
      } else {
        that.setData({ loading: false })
      }
    }).catch(function() {
      that.setData({ loading: false })
    })
  },

  // 点击报名按钮
  onJoinTap: function() {
    var jielong = this.data.jielong
    if (!jielong) return

    var hasFields = jielong.fields && jielong.fields.length > 0
    if (jielong.need_remark || hasFields) {
      this.setData({ showRemarkPopup: true, remarkInput: '', fieldValues: {} })
    } else {
      this.doJoin('', {})
    }
  },

  onRemarkInput: function(e) {
    this.setData({ remarkInput: e.detail.value })
  },

  onFieldInput: function(e) {
    var name = e.currentTarget.dataset.name
    var fieldValues = this.data.fieldValues
    fieldValues[name] = e.detail.value
    this.setData({ fieldValues: fieldValues })
  },

  hideRemarkPopup: function() {
    this.setData({ showRemarkPopup: false })
  },

  confirmRemark: function() {
    var jielong = this.data.jielong
    var remark = this.data.remarkInput.trim()
    if (jielong.need_remark && !remark) {
      wx.showToast({ title: jielong.remark_hint || '请填写备注', icon: 'none' })
      return
    }
    // 验证自定义字段
    var fields = jielong.fields || []
    var fieldValues = this.data.fieldValues
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i]
      if (f.required && (!fieldValues[f.name] || !fieldValues[f.name].trim())) {
        wx.showToast({ title: '请填写' + f.name, icon: 'none' })
        return
      }
    }
    this.setData({ showRemarkPopup: false })
    this.doJoin(remark, fieldValues)
  },

  doJoin: function(remark, fieldValues) {
    var that = this
    var data = {
      remark: remark || undefined
    }
    var fields = this.data.jielong.fields || []
    if (fields.length > 0 && fieldValues) {
      data.field_values = fieldValues
    }
    jielongApi.join(that.data.jielongId, data).then(function(res) {
      if (res.success) {
        wx.showToast({ title: '接龙成功', icon: 'success' })
        setTimeout(function() {
          wx.switchTab({ url: '/pages/index/index' })
        }, 1000)
      }
    })
  },

  // 删除接龙（仅发起人）
  onDelete: function() {
    var that = this
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除该接龙吗？',
      confirmText: '删除',
      confirmColor: '#e53935',
      success: function(res) {
        if (res.confirm) {
          jielongApi.delete(that.data.jielongId).then(function(res) {
            if (res.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              setTimeout(function() {
                var pages = getCurrentPages()
                if (pages.length > 1) {
                  wx.navigateBack()
                } else {
                  wx.switchTab({ url: '/pages/index/index' })
                }
              }, 1200)
            }
          }).catch(function() {})
        }
      }
    })
  },

  // 取消报名
  onQuitTap: function() {
    var that = this
    wx.showModal({
      title: '提示',
      content: '确定取消接龙吗？',
      success: function(res) {
        if (res.confirm) {
          jielongApi.quit(that.data.jielongId).then(function(res) {
            if (res.success) {
              wx.showToast({ title: '已取消', icon: 'success' })
              that.loadDetail()
            }
          })
        }
      }
    })
  },

  // 发起人关闭/开启
  onToggleStatus: function() {
    var that = this
    var newStatus = this.data.isClosed ? 'open' : 'closed'
    var msg = this.data.isClosed ? '确定重新开启接龙？' : '确定关闭接龙？关闭后不可再接龙'

    wx.showModal({
      title: '提示',
      content: msg,
      success: function(res) {
        if (res.confirm) {
          jielongApi.update(that.data.jielongId, { status: newStatus }).then(function(res) {
            if (res.success) {
              wx.showToast({ title: newStatus === 'open' ? '已开启' : '已关闭', icon: 'success' })
              that.loadDetail()
            }
          })
        }
      }
    })
  },

  // 发起人管理名单
  goToManage: function() {
    wx.navigateTo({
      url: '/pages/jielong/manage/manage?id=' + this.data.jielongId
    })
  },

  // 导出Excel
  onExport: function() {
    var that = this
    jielongApi.exportMembers(this.data.jielongId).then(function(filePath) {
      wx.openDocument({
        filePath: filePath,
        showMenu: true,
        success: function() {},
        fail: function() {
          wx.showToast({ title: '无法打开文件', icon: 'none' })
        }
      })
    }).catch(function() {})
  },

  // 分享
  onShareAppMessage: function() {
    var jielong = this.data.jielong
    return {
      title: jielong ? jielong.title : '接龙活动',
      path: '/pages/jielong/join/join?id=' + this.data.jielongId
    }
  },

  preventTap: function() {}
})
