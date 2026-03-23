var app = getApp()
var api = require('../../../utils/api')
var jielongApi = api.jielongApi
var util = require('../../../utils/util')
var getStatusBarHeight = util.getStatusBarHeight
var goBack = util.goBack

Page({
  data: {
    statusBarHeight: 44,
    title: '',
    description: '',
    deadline: '',
    deadlineDisplay: '',
    maxCount: '',
    needRemark: false,
    remarkHint: '',
    fields: [],
    submitting: false
  },

  onLoad: function() {
    this.setData({ statusBarHeight: getStatusBarHeight() })
  },

  goBack: goBack,

  onTitleInput: function(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput: function(e) {
    this.setData({ description: e.detail.value })
  },

  onDeadlinePick: function(e) {
    var value = e.detail.value
    this.setData({
      deadline: value,
      deadlineDisplay: value.replace('T', ' ')
    })
  },

  clearDeadline: function() {
    this.setData({ deadline: '', deadlineDisplay: '' })
  },

  onMaxCountInput: function(e) {
    this.setData({ maxCount: e.detail.value })
  },

  onRemarkSwitch: function(e) {
    this.setData({
      needRemark: e.detail.value,
      remarkHint: e.detail.value ? this.data.remarkHint : ''
    })
  },

  onRemarkHintInput: function(e) {
    this.setData({ remarkHint: e.detail.value })
  },

  addField: function() {
    var fields = this.data.fields
    if (fields.length >= 10) {
      wx.showToast({ title: '最多10个字段', icon: 'none' })
      return
    }
    fields.push({ name: '', required: true })
    this.setData({ fields: fields })
  },

  onFieldNameInput: function(e) {
    var idx = e.currentTarget.dataset.idx
    var fields = this.data.fields
    fields[idx].name = e.detail.value
    this.setData({ fields: fields })
  },

  onFieldRequiredSwitch: function(e) {
    var idx = e.currentTarget.dataset.idx
    var fields = this.data.fields
    fields[idx].required = e.detail.value
    this.setData({ fields: fields })
  },

  removeField: function(e) {
    var idx = e.currentTarget.dataset.idx
    var fields = this.data.fields
    fields.splice(idx, 1)
    this.setData({ fields: fields })
  },

  submitCreate: function() {
    var that = this
    var data = this.data

    if (!data.title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (data.title.length > 30) {
      wx.showToast({ title: '标题最多30字', icon: 'none' })
      return
    }
    if (data.needRemark && !data.remarkHint.trim()) {
      wx.showToast({ title: '请输入备注提示语', icon: 'none' })
      return
    }

    // 验证自定义字段
    var validFields = []
    for (var i = 0; i < data.fields.length; i++) {
      var f = data.fields[i]
      if (!f.name.trim()) {
        wx.showToast({ title: '请输入第' + (i + 1) + '个字段的名称', icon: 'none' })
        return
      }
      validFields.push({ name: f.name.trim(), required: f.required })
    }

    this.setData({ submitting: true })

    var params = {
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      deadline: data.deadline || undefined,
      max_count: data.maxCount ? parseInt(data.maxCount) : undefined,
      need_remark: data.needRemark,
      remark_hint: data.needRemark ? data.remarkHint.trim() : undefined,
      fields: validFields.length > 0 ? validFields : undefined
    }

    jielongApi.create(params).then(function(res) {
      that.setData({ submitting: false })
      if (res.success) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(function() {
          wx.redirectTo({
            url: '/pages/jielong/detail/detail?id=' + res.data.id
          })
        }, 800)
      }
    }).catch(function() {
      that.setData({ submitting: false })
    })
  }
})
