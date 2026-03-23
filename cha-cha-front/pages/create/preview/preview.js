var app = getApp()
var fileApi = require('../../../utils/api').fileApi
var getStatusBarHeight = require('../../../utils/util').getStatusBarHeight

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
    actionHeaderIndex: -1,
    displayRows: [],
    pageSize: 15,
    currentPage: 1,
    totalRows: 0,
    isLoadingMore: false,
    hasMore: true
  },

  onLoad: function(options) {
    this.setData({ statusBarHeight: getStatusBarHeight() })
    this.initData()
  },

  initData: function() {
    var uploadedFile = app.globalData.uploadedFile
    if (uploadedFile) {
      var previewRows = uploadedFile.previewRows || []
      var totalRows = uploadedFile.rowCount || 0
      var displayRows = previewRows

      var fileInfo = {
        name: uploadedFile.name || '',
        headers: uploadedFile.headers || [],
        headerRowIndex: uploadedFile.headerRowIndex,
        rowCount: totalRows
      }

      this.setData({
        headers: uploadedFile.headers || [],
        uploadedFile: fileInfo,
        displayRows: displayRows,
        totalRows: totalRows,
        currentPage: 1,
        hasMore: false
      })
    }
  },

  deleteTempFile: function() {
    var uploadedFile = app.globalData.uploadedFile
    if (uploadedFile && uploadedFile.fileId) {
      fileApi.deleteTemp(uploadedFile.fileId).catch(function() {})
    }
  },

  goBack: function() {
    this.deleteTempFile()
    wx.navigateBack()
  },

  reUpload: function() {
    this.deleteTempFile()
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

          var displayRows = rows.slice(0, that.data.pageSize)
          that.data.rows = rows
          that.setData({
            headers: headers,
            displayRows: displayRows,
            totalRows: rows.length,
            currentPage: 1,
            hasMore: rows.length > that.data.pageSize,
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

      var displayRows = newRows.slice(0, this.data.pageSize)

      this.data.rows = newRows
      this.setData({
        headers: newHeaders,
        displayRows: displayRows,
        totalRows: newRows.length,
        currentPage: 1,
        hasMore: newRows.length > this.data.pageSize,
        showHeaderSelect: false
      })

      uploadedFile.headers = newHeaders
      uploadedFile.rows = newRows
      uploadedFile.headerRowIndex = selectedIndex
      app.globalData.uploadedFile = uploadedFile
    }
  },

  loadMore: function() {
    if (this.data.isLoadingMore || !this.data.hasMore) {
      return
    }

    var that = this
    var currentPage = this.data.currentPage + 1
    var startIndex = currentPage * this.data.pageSize
    var endIndex = startIndex + this.data.pageSize
    var newRows = this.data.displayRows.concat(this.data.rows.slice(startIndex, endIndex))

    this.setData({
      isLoadingMore: true,
      currentPage: currentPage,
      displayRows: newRows,
      hasMore: newRows.length < this.data.totalRows
    })

    setTimeout(function() {
      that.setData({
        isLoadingMore: false
      })
    }, 300)
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
