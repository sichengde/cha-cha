var app = getApp()
var api = require('../../utils/api')
var queryApi = api.queryApi
var dataApi = api.dataApi

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
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })
    
    if (options.id) {
      this.setData({ queryId: options.id })
      this.loadQueryInfo(options.id)
    } else if (options.example === 'true') {
      this.loadExampleQuery()
    }
  },

  loadExampleQuery: function() {
    var exampleQuery = {
      id: 'example',
      name: '示例查询 - 成绩查询',
      description: '2024年期末考试成绩查询',
      cover: '',
      settings: {
        conditions: [0, 1],
        allowModify: true,
        modifyColumns: [3],
        enableSign: true,
        signType: 'button'
      },
      tableData: {
        headers: ['姓名', '身份证后四位', '班级', '成绩', '排名'],
        rows: [
          ['张三', '1234', '一班', '95', '1'],
          ['李四', '2345', '一班', '92', '2'],
          ['王五', '3456', '二班', '88', '3']
        ]
      }
    }

    this.setData({
      queryInfo: exampleQuery,
      queryConditions: [
        { label: '姓名', value: '' },
        { label: '身份证后四位', value: '' }
      ]
    })
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

    if (queryId === 'example') {
      this.doExampleQuery()
      return
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

  doExampleQuery: function() {
    var that = this
    var queryConditions = this.data.queryConditions
    var queryInfo = this.data.queryInfo
    
    this.setData({ loading: true })

    setTimeout(function() {
      var mockResult = that.findMockResult(queryConditions, queryInfo)
      
      if (mockResult) {
        var resultData = queryInfo.tableData.headers.map(function(header, idx) {
          return {
            label: header,
            value: mockResult[idx],
            is_modifiable: queryInfo.settings.modifyColumns.indexOf(idx) > -1,
            modified: false
          }
        })

        var modifiableFields = queryInfo.settings.modifyColumns.map(function(idx) {
          return {
            label: queryInfo.tableData.headers[idx],
            value: mockResult[idx],
            newValue: ''
          }
        })

        var decoratedResult = that.decorateQueryResult(resultData, true, modifiableFields)

        that.setData({
          queryResult: decoratedResult,
          allowModify: true,
          modifiableFields: modifiableFields,
          hasPendingChanges: false,
          loading: false
        })
      } else {
        that.setData({
          queryError: '未找到匹配的数据，请检查查询条件',
          hasPendingChanges: false,
          loading: false
        })
      }
    }, 1000)
  },

  findMockResult: function(conditions, queryInfo) {
    if (!queryInfo || !queryInfo.tableData || !queryInfo.tableData.rows) {
      return null
    }

    var rows = queryInfo.tableData.rows
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i]
      var match = true
      for (var j = 0; j < conditions.length; j++) {
        var conditionIndex = queryInfo.settings.conditions[j]
        if (row[conditionIndex] !== conditions[j].value) {
          match = false
          break
        }
      }
      if (match) return row
    }
    return null
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

    if (queryId === 'example') {
      this.applyInlineChanges()
      wx.showToast({ title: '修改成功', icon: 'success' })
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
    var that = this
    wx.showModal({
      title: '手写签名',
      content: '请在弹出的画板上进行签名',
      showCancel: false,
      success: function() {
        that.setData({
          signatureImage: '/assets/images/mock-signature.svg'
        })
      }
    })
  },

  confirmSign: function() {
    var that = this
    var queryId = this.data.queryId
    var queryDataId = this.data.queryDataId
    var signType = this.data.signType
    var signatureImage = this.data.signatureImage

    if (queryId === 'example') {
      this.confirmExampleSign()
      return
    }

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

  confirmExampleSign: function() {
    var queryInfo = this.data.queryInfo
    var signatureImage = this.data.signatureImage

    if (queryInfo.settings.signType === 'signature' && !signatureImage) {
      wx.showToast({ title: '请先完成签名', icon: 'none' })
      return
    }

    this.setData({ signed: true })
    wx.showToast({ title: '签收成功', icon: 'success' })
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
  }
})
