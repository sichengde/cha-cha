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

module.exports = {
  showToast: showToast,
  showLoading: showLoading,
  hideLoading: hideLoading,
  showConfirm: showConfirm,
  getStatusText: getStatusText,
  getStatusClass: getStatusClass
}
