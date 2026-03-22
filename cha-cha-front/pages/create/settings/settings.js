var app = getApp()
var api = require('../../../utils/api')
var fileApi = require('../../../utils/api').fileApi
var util = require('../../../utils/util')
var getQueryPath = util.getQueryPath
var showQrPreviewFromTempFile = util.showQrPreviewFromTempFile
var hideQrPreviewState = util.hideQrPreview

function formatDateTime(date) {
  if (!date) return ''
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var day = date.getDate()
  var hour = date.getHours()
  var minute = date.getMinutes()

  return year + '-' +
    (month < 10 ? '0' + month : month) + '-' +
    (day < 10 ? '0' + day : day) + ' ' +
    (hour < 10 ? '0' + hour : hour) + ':' +
    (minute < 10 ? '0' + minute : minute)
}

function formatDateTimeNoYear(date) {
  if (!date) return ''
  var month = date.getMonth() + 1
  var day = date.getDate()
  var hour = date.getHours()
  var minute = date.getMinutes()

  return (month < 10 ? '0' + month : month) + '-' +
    (day < 10 ? '0' + day : day) + ' ' +
    (hour < 10 ? '0' + hour : hour) + ':' +
    (minute < 10 ? '0' + minute : minute)
}

function toPickerValue(date) {
  if (!date) return [0, 0, 0, 0, 0]

  var now = new Date()
  var yearOffset = date.getFullYear() - now.getFullYear()
  if (yearOffset < 0) yearOffset = 0
  if (yearOffset > 10) yearOffset = 10

  return [
    yearOffset,
    date.getMonth(),
    date.getDate() - 1,
    date.getHours(),
    date.getMinutes()
  ]
}

function parseServerTime(timeString) {
  if (!timeString) return null
  if (timeString instanceof Date) return timeString

  var normalized = String(timeString).replace(' ', 'T')
  var date = new Date(normalized)
  if (isNaN(date.getTime())) return null
  return date
}

function toBool(value) {
  return value === true || value === 1 || value === '1'
}

Page({
  data: {
    statusBarHeight: 44,
    uploadedFile: null,
    queryHeaders: [],
    name: '',
    description: '',
    conditionText: '请选择',
    selectedHeaders: [],
    modifiableColumns: [],
    modifiableText: '未选择',
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
    showQrPreview: false,
    qrPreviewPath: '',
    createdQueryId: null,
    isSharing: false,
    isEditMode: false,
    editQueryId: '',
    pageTitle: '创建查询',
    saveButtonText: '保存，并去转发'
  },

  onLoad: function(options) {
    var systemSetting = wx.getSystemSetting()
    this.setData({
      statusBarHeight: systemSetting.statusBarHeight || 44
    })
    this.initDateTimePicker()
    wx.updateShareMenu({ withShareTicket: true })

    if (options && options.editId) {
      this.setData({
        isEditMode: true,
        editQueryId: options.editId,
        pageTitle: '编辑查询',
        saveButtonText: '保存修改'
      })
      this.loadEditQuery(options.editId)
      return
    }

    this.initData()
  },

  onShow: function() {
    if (this.data.isSharing) {
      this.setData({ isSharing: false })
      if (this.data.showShareModal) {
        this.hideShareModal()
        return
      }
    }
    
    if (this.data.isEditMode) return
    var selectedHeaders = app.globalData.selectedHeaders
    if (Array.isArray(selectedHeaders) && selectedHeaders.length > 0) {
      this.setData({ selectedHeaders: selectedHeaders })
      this.updateConditionText()
      this.syncModifiableColumns(true)
    }
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
    for (var h = 0; h < 24; h++) {
      hours.push((h < 10 ? '0' + h : h) + '时')
    }
    for (var m = 0; m < 60; m++) {
      minutes.push((m < 10 ? '0' + m : m) + '分')
    }

    this.setData({
      dateTimeArray: [years, months, days, hours, minutes]
    })
  },

  getDefaultTimeRange: function() {
    var start = new Date()
    var end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    return { start: start, end: end }
  },

  ensureDefaultTimeRange: function(force) {
    var startTime = this.data.startTime
    var endTime = this.data.endTime
    var hasStartTime = startTime instanceof Date && !isNaN(startTime.getTime())
    var hasEndTime = endTime instanceof Date && !isNaN(endTime.getTime())

    if (!force && hasStartTime && hasEndTime) {
      return
    }

    var range = this.getDefaultTimeRange()
    this.setData({
      startTime: range.start,
      endTime: range.end,
      startTimeText: formatDateTime(range.start),
      endTimeText: formatDateTime(range.end),
      startTimeValue: toPickerValue(range.start),
      endTimeValue: toPickerValue(range.end)
    })
  },

  initData: function() {
    if (this.data.isEditMode) return

    var uploadedFile = app.globalData.uploadedFile
    var selectedHeaders = app.globalData.selectedHeaders || []

    if (uploadedFile) {
      var fileInfo = {
        name: uploadedFile.name || '',
        headers: uploadedFile.headers || [],
        headerRowIndex: uploadedFile.headerRowIndex,
        rowCount: uploadedFile.rowCount
      }
      this.setData({
        uploadedFile: fileInfo,
        queryHeaders: uploadedFile.headers || [],
        name: this.data.name || uploadedFile.name || '',
        selectedHeaders: selectedHeaders
      })
      this.updateConditionText()
      this.syncModifiableColumns(true)
    }
  },

  loadEditQuery: function(editId) {
    var that = this
    wx.showLoading({ title: '加载中...' })

    api.queryApi.getDetail(editId).then(function(res) {
      wx.hideLoading()

      if (!res.success || !res.data) {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
        return
      }

      var queryInfo = res.data
      var headers = (queryInfo.headers || []).slice().sort(function(a, b) {
        return a.column_index - b.column_index
      })

      var queryHeaders = headers.map(function(h) { return h.column_name })
      var selectedHeaders = headers
        .filter(function(h) { return toBool(h.is_condition) })
        .map(function(h) {
          return {
            name: h.column_name,
            index: h.column_index,
            selected: true
          }
        })

      var hasAnyModifiable = headers.some(function(h) {
        return toBool(h.is_modifiable)
      })
      var shouldDefaultAllModifiable = !hasAnyModifiable && (toBool(queryInfo.allow_modify) || toBool((queryInfo.settings || {}).allowModify))
      var conditionMap = {}
      selectedHeaders.forEach(function(h) {
        conditionMap[h.name] = true
      })
      var modifiableColumns = headers
        .filter(function(h) {
          return !conditionMap[h.column_name]
        })
        .map(function(h) {
          return {
            name: h.column_name,
            index: h.column_index,
            selected: hasAnyModifiable ? toBool(h.is_modifiable) : shouldDefaultAllModifiable
          }
        })

      var startTime = parseServerTime(queryInfo.start_time)
      var endTime = parseServerTime(queryInfo.end_time)
      var timeLimitText = (startTime && endTime)
        ? (formatDateTimeNoYear(startTime) + ' 至 ' + formatDateTimeNoYear(endTime))
        : '不限制'

      var settings = queryInfo.settings || {}

      that.setData({
        uploadedFile: {
          name: queryInfo.name || '',
          headers: queryHeaders,
          rows: []
        },
        queryHeaders: queryHeaders,
        name: queryInfo.name || '',
        description: queryInfo.description || '',
        selectedHeaders: selectedHeaders,
        modifiableColumns: modifiableColumns,
        allowModify: modifiableColumns.some(function(col) { return col.selected }),
        enableSign: toBool(queryInfo.enable_sign) || toBool(settings.enableSign),
        requireNickname: toBool(queryInfo.require_nickname) || toBool(settings.requireNickname),
        startTime: startTime,
        endTime: endTime,
        startTimeText: startTime ? formatDateTime(startTime) : '',
        endTimeText: endTime ? formatDateTime(endTime) : '',
        startTimeValue: toPickerValue(startTime),
        endTimeValue: toPickerValue(endTime),
        timeLimitText: timeLimitText
      })

      app.globalData.uploadedFile = that.data.uploadedFile
      app.globalData.selectedHeaders = selectedHeaders

      that.updateConditionText()
      that.updateModifiableText(modifiableColumns)
    }).catch(function() {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  updateModifiableText: function(columns) {
    var list = columns || this.data.modifiableColumns || []
    var selectedNames = list.filter(function(item) {
      return !!item.selected
    }).map(function(item) {
      return item.name
    })

    if (list.length === 0) {
      this.setData({ modifiableText: '无可修改字段' })
      return
    }

    if (selectedNames.length === 0) {
      this.setData({ modifiableText: '不允许修改' })
      return
    }

    this.setData({ modifiableText: selectedNames.join('+') })
  },

  syncModifiableColumns: function(preserveExisting) {
    var headerNames = this.data.queryHeaders.length > 0
      ? this.data.queryHeaders
      : ((this.data.uploadedFile && this.data.uploadedFile.headers) || [])

    var selectedConditionMap = {}
    ;(this.data.selectedHeaders || []).forEach(function(item) {
      selectedConditionMap[item.name] = true
    })

    var currentMap = {}
    ;(this.data.modifiableColumns || []).forEach(function(item) {
      currentMap[item.name] = !!item.selected
    })

    var modifiableColumns = []
    for (var i = 0; i < headerNames.length; i++) {
      var name = headerNames[i]
      if (selectedConditionMap[name]) {
        continue
      }
      modifiableColumns.push({
        name: name,
        index: i,
        selected: preserveExisting ? !!currentMap[name] : false
      })
    }

    var hasSelected = modifiableColumns.some(function(col) { return col.selected })
    var nextAllowModify = this.data.allowModify || hasSelected

    this.setData({
      modifiableColumns: modifiableColumns,
      allowModify: nextAllowModify
    })
    this.updateModifiableText(modifiableColumns)
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
    var globalUploadedFile = app.globalData.uploadedFile
    if (globalUploadedFile && globalUploadedFile.fileId) {
      fileApi.deleteTemp(globalUploadedFile.fileId).catch(function() {})
    }
    wx.navigateBack()
  },

  onNameInput: function(e) {
    this.setData({ name: e.detail.value })
  },

  onDescInput: function(e) {
    this.setData({ description: e.detail.value })
  },

  goToCondition: function() {
    app.globalData.selectedHeaders = this.data.selectedHeaders || []

    if (this.data.isEditMode) {
      wx.navigateTo({
        url: '/pages/create/condition/condition?editId=' + this.data.editQueryId
      })
      return
    }

    wx.navigateBack()
  },

  toggleAllowModify: function(e) {
    var enabled = !!e.detail.value
    if (!enabled) {
      this.setData({ allowModify: false })
      return
    }

    this.syncModifiableColumns(true)
    this.setData({ allowModify: true })
  },

  toggleModifiableColumn: function(e) {
    var index = e.currentTarget.dataset.index
    var columns = (this.data.modifiableColumns || []).slice()
    if (!columns[index]) return

    columns[index].selected = !columns[index].selected
    this.setData({
      modifiableColumns: columns,
      allowModify: true
    })
    this.updateModifiableText(columns)
  },

  toggleEnableSign: function(e) {
    this.setData({ enableSign: e.detail.value })
  },

  toggleRequireNickname: function(e) {
    this.setData({ requireNickname: e.detail.value })
  },

  showTimeLimitModal: function() {
    this.ensureDefaultTimeRange(false)
    this.setData({ showTimeModal: true })
  },

  hideTimeLimitModal: function() {
    this.setData({ showTimeModal: false })
  },

  onStartTimeChange: function(e) {
    var value = e.detail.value
    var date = new Date()
    var year = date.getFullYear() + parseInt(value[0], 10)
    var month = parseInt(value[1], 10) + 1
    var day = parseInt(value[2], 10) + 1
    var hour = parseInt(value[3], 10)
    var minute = parseInt(value[4], 10)

    var startTime = new Date(year, month - 1, day, hour, minute)

    this.setData({
      startTimeValue: value,
      startTimeText: formatDateTime(startTime),
      startTime: startTime
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
    var year = date.getFullYear() + parseInt(value[0], 10)
    var month = parseInt(value[1], 10) + 1
    var day = parseInt(value[2], 10) + 1
    var hour = parseInt(value[3], 10)
    var minute = parseInt(value[4], 10)

    var endTime = new Date(year, month - 1, day, hour, minute)

    this.setData({
      endTimeValue: value,
      endTimeText: formatDateTime(endTime),
      endTime: endTime
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

    var timeLimitText = formatDateTimeNoYear(this.data.startTime) + ' 至 ' + formatDateTimeNoYear(this.data.endTime)

    this.setData({
      showTimeModal: false,
      timeLimitText: timeLimitText
    })
  },

  buildQueryHeaders: function(includeExtra) {
    var headerNames = this.data.queryHeaders.length > 0
      ? this.data.queryHeaders
      : ((this.data.uploadedFile && this.data.uploadedFile.headers) || [])

    var selectedMap = {}
    this.data.selectedHeaders.forEach(function(h) {
      selectedMap[h.name] = true
    })
    var modifiableMap = {}
    ;(this.data.modifiableColumns || []).forEach(function(item) {
      if (item && item.name) {
        modifiableMap[item.name] = !!item.selected
      }
    })

    var allowModify = !!this.data.allowModify

    return headerNames.map(function(name, index) {
      var isCondition = !!selectedMap[name]
      var header = {
        column_name: name,
        column_index: index,
        is_condition: isCondition,
        is_modifiable: allowModify && !isCondition && !!modifiableMap[name]
      }

      if (includeExtra) {
        header.is_hidden = false
      }

      return header
    })
  },

  saveAndShare: function() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入查询名称', icon: 'none' })
      return
    }

    if (this.data.selectedHeaders.length === 0) {
      wx.showToast({ title: '请选择查询条件', icon: 'none' })
      return
    }

    if (this.data.allowModify) {
      var selectedCount = (this.data.modifiableColumns || []).filter(function(col) {
        return !!col.selected
      }).length
      if (selectedCount === 0) {
        wx.showToast({ title: '请至少选择一个可修改字段', icon: 'none' })
        return
      }
    }

    if (this.data.isEditMode) {
      this.updateQuery()
      return
    }

    this.createQuery()
  },

  createQuery: function() {
    var that = this
    var globalUploadedFile = app.globalData.uploadedFile
    var uploadedFile = this.data.uploadedFile || {}

    if (!uploadedFile.headers || uploadedFile.headers.length === 0 || !globalUploadedFile || !globalUploadedFile.fileId) {
      wx.showToast({ title: '缺少文件数据，请重新上传', icon: 'none' })
      return
    }

    wx.showLoading({ title: '创建中...' })

    var queryData = {
      name: this.data.name,
      description: this.data.description,
      allow_modify: this.data.allowModify && (this.data.modifiableColumns || []).some(function(col) { return col.selected }),
      enable_sign: this.data.enableSign,
      require_nickname: this.data.requireNickname,
      query_limit: 0,
      headers: this.buildQueryHeaders(true),
      file_id: globalUploadedFile.fileId,
      header_row_index: globalUploadedFile.headerRowIndex
    }

    if (this.data.timeLimitText !== '不限制' && this.data.startTime && this.data.endTime) {
      queryData.start_time = this.data.startTime.toISOString()
      queryData.end_time = this.data.endTime.toISOString()
    }

    api.queryApi.create(queryData).then(function(res) {
      if (res.success) {
        if (globalUploadedFile && globalUploadedFile.fileId) {
          fileApi.deleteTemp(globalUploadedFile.fileId).catch(function() {})
        }
        app.globalData.createdQueryId = res.data.id
        that.setData({
          showShareModal: true,
          createdQueryId: res.data.id
        })
      } else {
        if (globalUploadedFile && globalUploadedFile.fileId) {
          fileApi.deleteTemp(globalUploadedFile.fileId).catch(function() {})
        }
        wx.showToast({ title: res.message || '创建失败', icon: 'none' })
      }
    }).catch(function() {
      if (globalUploadedFile && globalUploadedFile.fileId) {
        fileApi.deleteTemp(globalUploadedFile.fileId).catch(function() {})
      }
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    }).finally(function() {
      wx.hideLoading()
    })
  },

  updateQuery: function() {
    var that = this
    wx.showLoading({ title: '保存中...' })

    var payload = {
      name: this.data.name,
      description: this.data.description,
      allow_modify: this.data.allowModify && (this.data.modifiableColumns || []).some(function(col) { return col.selected }),
      enable_sign: this.data.enableSign,
      require_nickname: this.data.requireNickname,
      headers: this.buildQueryHeaders(false)
    }

    if (this.data.timeLimitText !== '不限制' && this.data.startTime && this.data.endTime) {
      payload.start_time = this.data.startTime.toISOString()
      payload.end_time = this.data.endTime.toISOString()
    } else {
      payload.start_time = null
      payload.end_time = null
    }

    api.queryApi.update(this.data.editQueryId, payload).then(function(res) {
      wx.hideLoading()
      if (res.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(function() {
          var pages = getCurrentPages()
          if (pages.length > 1) {
            wx.navigateBack({ delta: 1 })
          } else {
            wx.redirectTo({ url: '/pages/manage/manage?id=' + that.data.editQueryId })
          }
        }, 800)
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
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

  onShareTap: function() {
    this.setData({ isSharing: true })
  },

  generateCreatedQueryQrCode: function() {
    var that = this
    var queryId = this.data.createdQueryId
    if (!queryId) {
      wx.showToast({ title: '查询不存在', icon: 'none' })
      return
    }

    api.queryApi.downloadQrCode(queryId).then(function(tempFilePath) {
      showQrPreviewFromTempFile(that, tempFilePath)
    }).catch(function() {})
  },

  hideQrPreview: function() {
    hideQrPreviewState(this)
  },

  previewQrImage: function() {
    var path = this.data.qrPreviewPath
    if (!path) return
    wx.previewImage({
      current: path,
      urls: [path]
    })
  },

  onShareModalTap: function() {},

  onShareModalMaskTap: function() {
    this.hideShareModal()
  },

  onQrModalTap: function() {},

  onQrModalMaskTap: function() {
    this.hideQrPreview()
  },

  onShareAppMessage: function() {
    var queryId = this.data.createdQueryId || app.globalData.createdQueryId
    var path = queryId ? getQueryPath(queryId) : '/pages/index/index'
    return {
      title: this.data.name || '小丽表格',
      path: path
    }
  }
})
