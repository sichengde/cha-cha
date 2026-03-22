Page({
  data: {
    statusBarHeight: 44
  },

  onLoad: function() {
    var systemSetting = wx.getSystemSetting()
    this.setData({
      statusBarHeight: systemSetting.statusBarHeight || 44
    })
  },

  goBack: function() {
    wx.navigateBack()
  },

  goToAgreement: function() {
    wx.showModal({
      title: '用户协议',
      content: '感谢您使用小丽表格。使用本服务即表示您同意遵守相关条款和规定。',
      showCancel: false
    })
  },

  goToPrivacy: function() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私保护。您的数据将被安全存储，不会泄露给第三方。',
      showCancel: false
    })
  }
})
