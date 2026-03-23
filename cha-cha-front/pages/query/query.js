var app = getApp()
var api = require('../../utils/api')
var queryApi = api.queryApi
var dataApi = api.dataApi
var getStatusBarHeight = require('../../utils/util').getStatusBarHeight

Page({
  data: {
    queryId: '',
    queryInfo: null,
    queryConditions: [],
    queryResult: null,
    queryError: '',
    resultData: [],
    modifiableFields: [],
    hasPendingChanges: false,
    signatureImage: '',
    loading: false,
    queryDataId: null,
    allowModify: false,
    enableSign: false,
    signType: 'button',
    signed: false,
    statusBarHeight: 44
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getStatusBarHeight() })
    
    var queryId = options.id
    if (!queryId && options.scene) {
      try {
        queryId = decodeURIComponent(options.scene)
      } catch (e) {
        queryId = options.scene
      }
      if (queryId && queryId.length === 32) {
        queryId = queryId.slice(0, 8) + '-' + queryId.slice(8, 12) + '-' + queryId.slice(12, 16) + '-' + queryId.slice(16, 20) + '-' + queryId.slice(20)
      }
    }
    
    if (queryId) {
      this.setData({ queryId: queryId })
      this.loadQueryInfo(queryId)
    }
  },

  loadQueryInfo: function(queryId) {
    var that = this
    this.setData({ loading: true })
    
    queryApi.getDetail(queryId).then(function(data) {
      console.log('查询详情返回:', data)
      if (data.success) {
        var queryInfo = data.data
        var headers = queryInfo.headers || []
        var settings = queryInfo.settings || {}
        var conditions = settings.conditions || []
        
        console.log('headers:', headers)
        console.log('settings:', settings)
        console.log('conditions:', conditions)
        
        var queryConditions = conditions.map(function(idx) {
          var matchedHeader = headers.find(function(h) {
            return h.column_index === idx
          }) || headers[idx]

          return {
            label: matchedHeader ? matchedHeader.column_name : '列' + idx,
            value: ''
          }
        })

        console.log('queryConditions:', queryConditions)

        that.setData({
          queryInfo: queryInfo,
          queryConditions: queryConditions,
          loading: false
        })
      } else {
        that.setData({
          queryError: data.message || '查询页面不存在或已过期',
          loading: false
        })
      }
    }).catch(function(err) {
      console.error('加载失败:', err)
      that.setData({
        queryError: '加载失败',
        loading: false
      })
    })
  },

  onConditionInput: function(e) {
    var index = e.currentTarget.dataset.index
    var value = e.detail.value
    var conditions = this.data.queryConditions.slice()
    conditions[index].value = value
    this.setData({ queryConditions: conditions })
  },

  doQuery: function() {
    var that = this
    var queryConditions = this.data.queryConditions
    var queryId = this.data.queryId
    var queryInfo = this.data.queryInfo
    
    for (var i = 0; i < queryConditions.length; i++) {
      if (!queryConditions[i].value.trim()) {
        wx.showToast({ title: '请填写完整查询条件', icon: 'none' })
        return
      }
    }

    this.setData({
      loading: true,
      queryError: '',
      queryResult: null,
      modifiableFields: [],
      hasPendingChanges: false
    })

    var conditions = {}
    queryConditions.forEach(function(c) {
      conditions[c.label] = c.value
    })

    dataApi.query(queryId, conditions).then(function(data) {
      if (data.success) {
        var result = data.data
        var decoratedResult = that.decorateQueryResult(result.resultData, result.allowModify, result.modifiableFields || [])
        that.setData({
          queryResult: decoratedResult,
          queryDataId: result.queryDataId,
          allowModify: result.allowModify,
          modifiableFields: result.modifiableFields || [],
          hasPendingChanges: false,
          enableSign: result.enableSign,
          signType: result.signType,
          signed: result.signed,
          loading: false
        })
      } else {
        that.setData({
          queryError: data.message || '查询失败',
          modifiableFields: [],
          hasPendingChanges: false,
          loading: false
        })
      }
    }).catch(function(err) {
      that.setData({
        queryError: err && err.message ? err.message : '查询失败',
        modifiableFields: [],
        hasPendingChanges: false,
        loading: false
      })
    })
  },

  decorateQueryResult: function(resultData, allowModify, modifiableFields) {
    var editableMap = {}
    ;(modifiableFields || []).forEach(function(field) {
      if (field && field.label) {
        editableMap[field.label] = true
      }
    })

    var hasEditableMap = Object.keys(editableMap).length > 0

    return (resultData || []).map(function(item) {
      var textValue = item && item.value !== undefined && item.value !== null ? String(item.value) : ''
      var editable = false

      if (allowModify) {
        editable = hasEditableMap ? !!editableMap[item.label] : !!item.is_modifiable
      }

      return {
        label: item.label,
        value: textValue,
        originalValue: textValue,
        editValue: textValue,
        editable: editable,
        editing: false,
        changed: false,
        modified: !!item.modified
      }
    })
  },

  onResultValueTap: function(e) {
    var index = e.currentTarget.dataset.index
    var queryResult = (this.data.queryResult || []).slice()
    var target = queryResult[index]

    if (!this.data.allowModify || !target || !target.editable) {
      return
    }

    for (var i = 0; i < queryResult.length; i++) {
      var row = Object.assign({}, queryResult[i])
      row.editing = (i === index)
      row.editValue = row.value
      queryResult[i] = row
    }

    this.setData({ queryResult: queryResult })
  },

  onInlineEditInput: function(e) {
    var index = e.currentTarget.dataset.index
    var value = e.detail.value
    var queryResult = (this.data.queryResult || []).slice()
    if (!queryResult[index]) return

    var row = Object.assign({}, queryResult[index])
    row.editValue = value
    row.value = String(value)
    row.changed = row.value !== row.originalValue
    row.modified = row.modified || row.changed
    queryResult[index] = row

    var hasPendingChanges = queryResult.some(function(item) {
      return !!(item && item.changed)
    })

    this.setData({
      queryResult: queryResult,
      hasPendingChanges: hasPendingChanges
    })
  },

  finishInlineEdit: function(e) {
    var index = e.currentTarget.dataset.index
    var queryResult = (this.data.queryResult || []).slice()
    if (!queryResult[index]) return

    var row = Object.assign({}, queryResult[index])
    var finalValue = row.editValue
    if (finalValue === undefined || finalValue === null) {
      finalValue = ''
    }
    finalValue = String(finalValue)

    row.value = finalValue
    row.editValue = finalValue
    row.editing = false
    row.changed = finalValue !== row.originalValue
    row.modified = row.modified || row.changed
    queryResult[index] = row

    var hasPendingChanges = queryResult.some(function(item) {
      return !!(item && item.changed)
    })

    this.setData({
      queryResult: queryResult,
      hasPendingChanges: hasPendingChanges
    })
  },

  applyInlineChanges: function() {
    var queryResult = (this.data.queryResult || []).map(function(item) {
      var row = Object.assign({}, item)
      if (row.changed) {
        row.originalValue = row.value
        row.modified = true
        row.changed = false
      }
      row.editing = false
      row.editValue = row.value
      return row
    })

    this.setData({
      queryResult: queryResult,
      hasPendingChanges: false
    })
  },

  saveInlineChanges: function() {
    var that = this
    var queryResult = this.data.queryResult || []
    var queryId = this.data.queryId
    var queryDataId = this.data.queryDataId

    var modifications = queryResult
      .filter(function(item) {
        return item && item.editable && item.changed
      })
      .map(function(item) {
        return {
          column: item.label,
          newValue: item.value
        }
      })

    if (modifications.length === 0) {
      wx.showToast({ title: '请先修改内容', icon: 'none' })
      return
    }

    if (!queryDataId) {
      wx.showToast({ title: '数据异常，请重新查询', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    dataApi.modify(queryId, queryDataId, modifications).then(function(data) {
      wx.hideLoading()
      if (data.success) {
        that.applyInlineChanges()
        wx.showToast({ title: '修改成功', icon: 'success' })
      } else {
        wx.showToast({ title: data.message || '修改失败', icon: 'none' })
      }
    }).catch(function() {
      wx.hideLoading()
      wx.showToast({ title: '修改失败', icon: 'none' })
    })
  },

  showSignature: function() {
    wx.showToast({ title: '签名功能暂未开放', icon: 'none' })
  },

  confirmSign: function() {
    var that = this
    var queryId = this.data.queryId
    var queryDataId = this.data.queryDataId
    var signType = this.data.signType
    var signatureImage = this.data.signatureImage

    if (signType === 'signature' && !signatureImage) {
      wx.showToast({ title: '请先完成签名', icon: 'none' })
      return
    }

    dataApi.sign(queryId, queryDataId, {
      signType: signType,
      signatureUrl: signatureImage
    }).then(function(data) {
      if (data.success) {
        that.setData({ signed: true })
        wx.showToast({ title: '签收成功', icon: 'success' })
      } else {
        wx.showToast({ title: data.message || '签收失败', icon: 'none' })
      }
    }).catch(function() {
      wx.showToast({ title: '签收失败', icon: 'none' })
    })
  },

  resetQuery: function() {
    var queryConditions = this.data.queryConditions.map(function(c) {
      return Object.assign({}, c, { value: '' })
    })
    this.setData({
      queryConditions: queryConditions,
      queryResult: null,
      queryError: '',
      resultData: [],
      modifiableFields: [],
      hasPendingChanges: false,
      signatureImage: '',
      queryDataId: null,
      signed: false
    })
  },

  goHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  onShareAppMessage: function() {
    var queryInfo = this.data.queryInfo
    var title = (queryInfo && queryInfo.name) || '班班通丨线上收集'
    return {
      title: title,
      path: '/pages/query/query?id=' + this.data.queryId
    }
  }
})
