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
      if (data.success) {
        var queryInfo = data.data
        var headers = queryInfo.headers || []
        var settings = queryInfo.settings || {}
        var conditions = settings.conditions || []
        
        var queryConditions = conditions.map(function(idx) {
          return {
            label: headers[idx] ? headers[idx].column_name : '列' + idx,
            value: ''
          }
        })

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
    }).catch(function() {
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

    this.setData({ loading: true, queryError: '', queryResult: null })

    var conditions = {}
    queryConditions.forEach(function(c) {
      conditions[c.label] = c.value
    })

    dataApi.query(queryId, conditions).then(function(data) {
      if (data.success) {
        var result = data.data
        that.setData({
          queryResult: result.resultData,
          queryDataId: result.queryDataId,
          allowModify: result.allowModify,
          enableSign: result.enableSign,
          signType: result.signType,
          signed: result.signed,
          loading: false
        })
      } else {
        that.setData({
          queryError: data.message || '查询失败',
          loading: false
        })
      }
    }).catch(function() {
      that.setData({
        queryError: '查询失败',
        loading: false
      })
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

        that.setData({
          queryResult: resultData,
          modifiableFields: modifiableFields,
          loading: false
        })
      } else {
        that.setData({
          queryError: '未找到匹配的数据，请检查查询条件',
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

  onModifyInput: function(e) {
    var index = e.currentTarget.dataset.index
    var value = e.detail.value
    var fields = this.data.modifiableFields.slice()
    fields[index].newValue = value
    this.setData({ modifiableFields: fields })
  },

  submitModify: function() {
    var that = this
    var modifiableFields = this.data.modifiableFields
    var queryDataId = this.data.queryDataId
    var queryId = this.data.queryId
    
    if (queryId === 'example') {
      this.submitExampleModify()
      return
    }

    var modifications = modifiableFields
      .filter(function(f) { return f.newValue.trim() })
      .map(function(f) {
        return {
          column: f.label,
          newValue: f.newValue
        }
      })

    if (modifications.length === 0) {
      wx.showToast({ title: '请输入修改内容', icon: 'none' })
      return
    }

    dataApi.modify(queryId, queryDataId, modifications).then(function(data) {
      if (data.success) {
        wx.showToast({ title: '修改成功', icon: 'success' })
        that.doQuery()
      } else {
        wx.showToast({ title: data.message || '修改失败', icon: 'none' })
      }
    }).catch(function() {
      wx.showToast({ title: '修改失败', icon: 'none' })
    })
  },

  submitExampleModify: function() {
    var modifiableFields = this.data.modifiableFields
    var queryResult = this.data.queryResult
    var queryInfo = this.data.queryInfo
    var hasChange = false

    modifiableFields.forEach(function(field, idx) {
      if (field.newValue.trim()) {
        var headerIndex = queryInfo.tableData.headers.indexOf(field.label)
        if (headerIndex > -1) {
          queryResult[headerIndex].value = field.newValue
          queryResult[headerIndex].modified = true
          hasChange = true
        }
      }
    })

    if (hasChange) {
      this.setData({ queryResult: queryResult })
      wx.showToast({ title: '修改成功', icon: 'success' })
    } else {
      wx.showToast({ title: '请输入修改内容', icon: 'none' })
    }
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
      signatureImage: '',
      queryDataId: null,
      signed: false
    })
  }
})
