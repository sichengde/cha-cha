var app = getApp()
var api = require('../../../utils/api')

Page({
  data: {
    statusBarHeight: 44,
    uploadedFile: null,
    name: '',
    description: '',
    conditionText: '请选择',
    selectedHeaders: [],
    allowModify: false,
    enableSign: false,
    requireNickname: false,
    showTimeModal: false,
    timeLimitText: '不限制',
    startTime: null,
    endTime: null,
    startTimeText: '',
    endTimeText: '',
    startTimeValue: [0, 0, 0, 0, 0],
    endTimeValue: [0, 0, 0, 0, 0],
    dateTimeArray: [],
    showShareModal: false,
    createdQueryId: null
  },

  onLoad: function() {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })
    this.initDateTimePicker()
    this.initData()
  },

  onShow: function() {
    this.initData()
  },

  initDateTimePicker: function() {
    var date = new Date()
    var years = []
    var months = []
    var days = []
    var hours = []
    var minutes = []
    
    for (var i = date.getFullYear(); i <= date.getFullYear() + 10; i++) {
      years.push(i + '年')
    }
    for (var i = 1; i <= 12; i++) {
      months.push(i + '月')
    }
    for (var i = 1; i <= 31; i++) {
      days.push(i + '日')
    }
    for (var i = 0; i < 24; i++) {
      hours.push((i < 10 ? '0' + i : i) + '时')
    }
    for (var i = 0; i < 60; i++) {
      minutes.push((i < 10 ? '0' + i : i) + '分')
    }
    
    this.setData({
      dateTimeArray: [years, months, days, hours, minutes]
    })
  },

  initData: function() {
    var uploadedFile = app.globalData.uploadedFile
    var selectedHeaders = app.globalData.selectedHeaders || []
    
    if (uploadedFile) {
      this.setData({
        uploadedFile: uploadedFile,
        name: uploadedFile.name || '',
        selectedHeaders: selectedHeaders
      })
      this.updateConditionText()
    }
  },

  updateConditionText: function() {
    var selectedHeaders = this.data.selectedHeaders
    if (selectedHeaders.length > 0) {
      var names = selectedHeaders.map(function(h) { return h.name })
      this.setData({ conditionText: names.join('+') })
    } else {
      this.setData({ conditionText: '请选择' })
    }
  },

  goBack: function() {
    wx.navigateBack()
  },

  onNameInput: function(e) {
    this.setData({ name: e.detail.value })
  },

  onDescInput: function(e) {
    this.setData({ description: e.detail.value })
  },

  goToCondition: function() {
    wx.navigateBack()
  },

  toggleAllowModify: function(e) {
    this.setData({ allowModify: e.detail.value })
  },

  toggleEnableSign: function(e) {
    this.setData({ enableSign: e.detail.value })
  },

  toggleRequireNickname: function(e) {
    this.setData({ requireNickname: e.detail.value })
  },

  showTimeLimitModal: function() {
    this.setData({ showTimeModal: true })
  },

  hideTimeLimitModal: function() {
    this.setData({ showTimeModal: false })
  },

  onStartTimeChange: function(e) {
    var value = e.detail.value
    var date = new Date()
    var year = date.getFullYear() + parseInt(value[0])
    var month = parseInt(value[1]) + 1
    var day = parseInt(value[2]) + 1
    var hour = parseInt(value[3])
    var minute = parseInt(value[4])
    
    var timeText = year + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day) + ' ' + (hour < 10 ? '0' + hour : hour) + ':' + (minute < 10 ? '0' + minute : minute)
    
    this.setData({
      startTimeValue: value,
      startTimeText: timeText,
      startTime: new Date(year, month - 1, day, hour, minute)
    })
  },

  onStartTimeColumnChange: function(e) {
    var column = e.detail.column
    var value = e.detail.value
    var startTimeValue = this.data.startTimeValue.slice()
    startTimeValue[column] = value
    this.setData({ startTimeValue: startTimeValue })
  },

  onEndTimeChange: function(e) {
    var value = e.detail.value
    var date = new Date()
    var year = date.getFullYear() + parseInt(value[0])
    var month = parseInt(value[1]) + 1
    var day = parseInt(value[2]) + 1
    var hour = parseInt(value[3])
    var minute = parseInt(value[4])
    
    var timeText = year + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day) + ' ' + (hour < 10 ? '0' + hour : hour) + ':' + (minute < 10 ? '0' + minute : minute)
    
    this.setData({
      endTimeValue: value,
      endTimeText: timeText,
      endTime: new Date(year, month - 1, day, hour, minute)
    })
  },

  onEndTimeColumnChange: function(e) {
    var column = e.detail.column
    var value = e.detail.value
    var endTimeValue = this.data.endTimeValue.slice()
    endTimeValue[column] = value
    this.setData({ endTimeValue: endTimeValue })
  },

  resetTimeLimit: function() {
    this.setData({
      showTimeModal: false,
      timeLimitText: '不限制',
      startTime: null,
      endTime: null,
      startTimeText: '',
      endTimeText: ''
    })
  },

  confirmTimeLimit: function() {
    if (!this.data.startTime || !this.data.endTime) {
      wx.showToast({
        title: '请选择开始和结束时间',
        icon: 'none'
      })
      return
    }
    
    if (this.data.startTime >= this.data.endTime) {
      wx.showToast({
        title: '结束时间必须大于开始时间',
        icon: 'none'
      })
      return
    }
    
    var timeLimitText = this.data.startTimeText + ' 至 ' + this.data.endTimeText
    
    this.setData({
      showTimeModal: false,
      timeLimitText: timeLimitText
    })
  },

  saveAndShare: function() {
    var that = this
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入查询名称', icon: 'none' })
      return
    }
    
    if (this.data.selectedHeaders.length === 0) {
      wx.showToast({ title: '请选择查询条件', icon: 'none' })
      return
    }

    wx.showLoading({ title: '创建中...' })

    var headers = this.data.uploadedFile.headers || []
    var selectedHeaderNames = this.data.selectedHeaders.map(function(h) { return h.name })

    var queryHeaders = headers.map(function(name, index) {
      return {
        column_name: name,
        column_index: index,
        is_condition: selectedHeaderNames.indexOf(name) !== -1,
        is_modifiable: false,
        is_hidden: false
      }
    })

    var queryData = {
      name: this.data.name,
      description: this.data.description,
      allow_modify: this.data.allowModify,
      enable_sign: this.data.enableSign,
      require_nickname: this.data.requireNickname,
      query_limit: 0,
      headers: queryHeaders,
      data: this.data.uploadedFile.rows || []
    }
    
    if (this.data.startTime && this.data.endTime) {
      queryData.start_time = this.data.startTime.toISOString()
      queryData.end_time = this.data.endTime.toISOString()
    }

    api.queryApi.create(queryData).then(function(res) {
      wx.hideLoading()
      if (res.success) {
        app.globalData.createdQueryId = res.data.id
        that.setData({
          showShareModal: true,
          createdQueryId: res.data.id
        })
      } else {
        wx.showToast({ title: res.message || '创建失败', icon: 'none' })
      }
    }).catch(function() {
      wx.hideLoading()
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    })
  },

  hideShareModal: function() {
    this.setData({ showShareModal: false })
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  onShareAppMessage: function() {
    var queryId = this.data.createdQueryId || app.globalData.createdQueryId
    return {
      title: this.data.name || '查查助手',
      path: '/pages/query/query?id=' + queryId
    }
  }
})
