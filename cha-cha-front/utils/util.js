var showToast = function(title, icon, duration) {
  icon = icon || 'none'
  duration = duration || 2000
  wx.showToast({ title: title, icon: icon, duration: duration })
}

var showLoading = function(title) {
  wx.showLoading({ title: title || '加载中...', mask: true })
}

var hideLoading = function() {
  wx.hideLoading()
}

var showConfirm = function(content, title) {
  return new Promise(function(resolve) {
    wx.showModal({
      title: title || '提示',
      content: content,
      success: function(res) { resolve(res.confirm) }
    })
  })
}

var getStatusText = function(status) {
  var map = { 'pending': '未开始', 'active': '进行中', 'ended': '已结束' }
  return map[status] || status
}

var getStatusClass = function(status) {
  var map = { 'pending': 'tag-warning', 'active': 'tag-success', 'ended': 'tag-error' }
  return map[status] || 'tag-primary'
}

var pad2 = function(value) {
  return value < 10 ? '0' + value : String(value)
}

var parseDateTime = function(input) {
  if (!input) return null
  if (input instanceof Date) return new Date(input.getTime())

  var source = String(input)
  var normalized = source.replace(' ', 'T')
  var date = new Date(normalized)
  if (!isNaN(date.getTime())) {
    return date
  }

  date = new Date(source.replace(/-/g, '/'))
  if (!isNaN(date.getTime())) {
    return date
  }

  return null
}

var formatBeijingDateTime = function(input) {
  if (typeof input === 'string') {
    var raw = input.trim()
    var hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw)
    var matched = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::\d{1,2})?)?$/)
    if (matched && !hasTimezone) {
      return matched[1] + '-' +
        pad2(parseInt(matched[2], 10)) + '-' +
        pad2(parseInt(matched[3], 10)) + ' ' +
        pad2(parseInt(matched[4] || '0', 10)) + ':' +
        pad2(parseInt(matched[5] || '0', 10))
    }
  }

  var date = parseDateTime(input)
  if (!date) return ''

  var utcTime = date.getTime() + date.getTimezoneOffset() * 60000
  var beijingDate = new Date(utcTime + 8 * 60 * 60 * 1000)

  return beijingDate.getFullYear() + '-' +
    pad2(beijingDate.getMonth() + 1) + '-' +
    pad2(beijingDate.getDate()) + ' ' +
    pad2(beijingDate.getHours()) + ':' +
    pad2(beijingDate.getMinutes())
}

var getQueryPath = function(queryId) {
  return '/pages/query/query?id=' + queryId
}

var showQueryShareActionSheet = function(onShare, onQrCode) {
  wx.showActionSheet({
    itemList: ['转发给好友', '生成二维码'],
    success: function(res) {
      if (res.tapIndex === 0) {
        if (typeof onShare === 'function') onShare()
      } else if (res.tapIndex === 1) {
        if (typeof onQrCode === 'function') onQrCode()
      }
    }
  })
}

var cacheFileForPreview = function(tempFilePath) {
  return new Promise(function(resolve) {
    wx.saveFile({
      tempFilePath: tempFilePath,
      success: function(res) {
        resolve(res.savedFilePath || tempFilePath)
      },
      fail: function() {
        resolve(tempFilePath)
      }
    })
  })
}

var showQrPreviewFromTempFile = function(page, tempFilePath) {
  return cacheFileForPreview(tempFilePath).then(function(localPath) {
    page.setData({
      showQrPreview: true,
      qrPreviewPath: localPath
    })
    return localPath
  })
}

var hideQrPreview = function(page) {
  page.setData({
    showQrPreview: false,
    qrPreviewPath: ''
  })
}

module.exports = {
  showToast: showToast,
  showLoading: showLoading,
  hideLoading: hideLoading,
  showConfirm: showConfirm,
  getStatusText: getStatusText,
  getStatusClass: getStatusClass,
  parseDateTime: parseDateTime,
  formatBeijingDateTime: formatBeijingDateTime,
  getQueryPath: getQueryPath,
  showQueryShareActionSheet: showQueryShareActionSheet,
  showQrPreviewFromTempFile: showQrPreviewFromTempFile,
  hideQrPreview: hideQrPreview
}
