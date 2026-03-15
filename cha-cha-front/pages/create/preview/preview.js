var app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    headers: [],
    rows: [],
    uploadedFile: null,
    showEditModal: false,
    editHeaderIndex: -1,
    editHeaderValue: '',
    showHeaderSelect: false,
    allRows: [],
    selectedHeaderRow: 0,
    showActionSheet: false,
    actionHeaderIndex: -1
  },

  onLoad: function(options) {
    var systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44
    })
    this.initData()
  },

  initData: function() {
    var uploadedFile = app.globalData.uploadedFile
    if (uploadedFile) {
      this.setData({
        headers: uploadedFile.headers || [],
        rows: uploadedFile.rows || [],
        uploadedFile: uploadedFile
      })
    }
  },

  goBack: function() {
    wx.navigateBack()
  },

  reUpload: function() {
    wx.navigateBack()
  },

  editHeader: function(e) {
    var index = e.currentTarget.dataset.index
    this.setData({
      showActionSheet: true,
      actionHeaderIndex: index
    })
  },

  closeActionSheet: function() {
    this.setData({
      showActionSheet: false,
      actionHeaderIndex: -1
    })
  },

  editHeaderAction: function() {
    var index = this.data.actionHeaderIndex
    this.setData({
      showActionSheet: false,
      showEditModal: true,
      editHeaderIndex: index,
      editHeaderValue: this.data.headers[index]
    })
  },

  deleteColumnDirect: function() {
    var that = this
    var index = this.data.actionHeaderIndex
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这一列吗？',
      success: function(res) {
        if (res.confirm) {
          var headers = that.data.headers.slice()
          var rows = that.data.rows.slice()
          
          headers.splice(index, 1)
          rows = rows.map(function(row) {
            var newRow = row.slice()
            newRow.splice(index, 1)
            return newRow
          })
          
          that.setData({
            headers: headers,
            rows: rows,
            showActionSheet: false
          })
          that.updateGlobalData()
        } else {
          that.setData({
            showActionSheet: false
          })
        }
      }
    })
  },

  closeEditModal: function() {
    this.setData({
      showEditModal: false,
      editHeaderIndex: -1,
      editHeaderValue: ''
    })
  },

  onEditInput: function(e) {
    this.setData({
      editHeaderValue: e.detail.value
    })
  },

  confirmEdit: function() {
    var headers = this.data.headers
    headers[this.data.editHeaderIndex] = this.data.editHeaderValue
    this.setData({ headers: headers })
    this.closeEditModal()
    this.updateGlobalData()
  },

  reselectHeader: function() {
    var uploadedFile = app.globalData.uploadedFile
    if (uploadedFile && uploadedFile.allRows) {
      var allRows = uploadedFile.allRows.map(function(row) {
        return row.join(' | ')
      })
      this.setData({
        showHeaderSelect: true,
        allRows: allRows,
        selectedHeaderRow: uploadedFile.headerRowIndex || 0
      })
    } else {
      wx.showToast({
        title: '无法获取原始数据',
        icon: 'none'
      })
    }
  },

  closeHeaderSelect: function() {
    this.setData({
      showHeaderSelect: false
    })
  },

  selectHeaderRow: function(e) {
    var index = e.currentTarget.dataset.index
    this.setData({
      selectedHeaderRow: index
    })
  },

  confirmHeaderSelect: function() {
    var uploadedFile = app.globalData.uploadedFile
    if (uploadedFile && uploadedFile.allRows) {
      var selectedIndex = this.data.selectedHeaderRow
      var newHeaders = uploadedFile.allRows[selectedIndex]
      var newRows = uploadedFile.allRows.slice(selectedIndex + 1)
      
      this.setData({
        headers: newHeaders,
        rows: newRows,
        showHeaderSelect: false
      })
      
      uploadedFile.headers = newHeaders
      uploadedFile.rows = newRows
      uploadedFile.headerRowIndex = selectedIndex
      app.globalData.uploadedFile = uploadedFile
    }
  },

  updateGlobalData: function() {
    var uploadedFile = app.globalData.uploadedFile
    if (uploadedFile) {
      uploadedFile.headers = this.data.headers
      uploadedFile.rows = this.data.rows
      app.globalData.uploadedFile = uploadedFile
    }
  },

  goToCondition: function() {
    wx.navigateTo({
      url: '/pages/create/condition/condition'
    })
  }
})
