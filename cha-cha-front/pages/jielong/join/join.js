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
    isCreator: false,
    isJoined: false,
    isClosed: false,
    isFull: false,
    memberCount: 0,
    loading: true,
    remarkInput: '',
    fieldValues: {},
    submitting: false,
    isDirectEntry: false
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getStatusBarHeight() })
    var pages = getCurrentPages()
    if (pages.length <= 1) {
      this.setData({ isDirectEntry: true })
    }
    var id = options.id
    if (!id && options.scene) {
      try {
        id = decodeURIComponent(options.scene)
      } catch (e) {
        id = options.scene
      }
      // 从二维码扫入的scene是去掉横杠的UUID，需要还原
      if (id && id.length === 32 && id.indexOf('-') === -1) {
        id = id.slice(0, 8) + '-' + id.slice(8, 12) + '-' + id.slice(12, 16) + '-' + id.slice(16, 20) + '-' + id.slice(20)
      }
    }
    if (id) {
      this.setData({ jielongId: id })
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
        if (d.deadline) {
          d.deadline = formatBeijingDateTime(d.deadline)
        }
        that.setData({
          jielong: d,
          isCreator: d.is_creator,
          isJoined: d.is_joined,
          isClosed: d.status === 'closed',
          isFull: !!(d.max_count && d.member_count >= d.max_count),
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

  onRemarkInput: function(e) {
    this.setData({ remarkInput: e.detail.value })
  },

  onFieldInput: function(e) {
    var name = e.currentTarget.dataset.name
    var fieldValues = this.data.fieldValues
    fieldValues[name] = e.detail.value
    this.setData({ fieldValues: fieldValues })
  },

  doSubmit: function() {
    var that = this
    var jielong = this.data.jielong
    if (!jielong) return

    if (jielong.need_remark) {
      var remark = this.data.remarkInput.trim()
      if (!remark) {
        wx.showToast({ title: jielong.remark_hint || '请填写备注', icon: 'none' })
        return
      }
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

    this.setData({ submitting: true })

    var data = {
      remark: (this.data.remarkInput || '').trim() || undefined
    }

    var fields = this.data.jielong.fields || []
    if (fields.length > 0) {
      data.field_values = this.data.fieldValues
    }

    jielongApi.join(this.data.jielongId, data).then(function(res) {
      that.setData({ submitting: false })
      if (res.success) {
        wx.showToast({ title: '接龙成功', icon: 'success' })
        setTimeout(function() {
          wx.switchTab({ url: '/pages/index/index' })
        }, 1000)
      }
    }).catch(function() {
      that.setData({ submitting: false })
    })
  },

  goToDetail: function() {
    wx.redirectTo({
      url: '/pages/jielong/detail/detail?id=' + this.data.jielongId
    })
  },

  onShareAppMessage: function() {
    var jielong = this.data.jielong
    return {
      title: jielong ? jielong.title : '接龙活动',
      path: '/pages/jielong/join/join?id=' + this.data.jielongId
    }
  }
})
