const { readEnvString } = require('../config/env')

let wechatTokenCache = {
  token: '',
  expiresAt: 0
}

function createError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

function getWechatConfig() {
  return {
    appId: readEnvString('WECHAT_APPID', ''),
    appSecret: readEnvString('WECHAT_APP_SECRET', ''),
    envVersion: readEnvString('WECHAT_ENV_VERSION', 'release')
  }
}

function ensureWechatConfig() {
  const config = getWechatConfig()
  if (!config.appId || !config.appSecret) {
    throw createError('未配置微信小程序 AppID 或 AppSecret', 'WECHAT_CONFIG_MISSING')
  }
  return config
}

async function requestAccessToken() {
  const config = ensureWechatConfig()
  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}`
  const response = await fetch(tokenUrl)
  if (!response.ok) {
    throw createError('获取微信 AccessToken 失败', 'WECHAT_ACCESS_TOKEN_HTTP_ERROR')
  }

  const data = await response.json()
  if (!data || data.errcode) {
    throw createError((data && data.errmsg) || '获取微信 AccessToken 失败', 'WECHAT_ACCESS_TOKEN_API_ERROR')
  }

  const expiresIn = Number(data.expires_in) || 7200
  wechatTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(expiresIn - 120, 60) * 1000
  }

  return data.access_token
}

async function getWechatAccessToken() {
  if (wechatTokenCache.token && Date.now() < wechatTokenCache.expiresAt) {
    return wechatTokenCache.token
  }
  return requestAccessToken()
}

function getQueryMiniProgramPath(queryId) {
  return '/pages/query/query?id=' + queryId
}

async function generateQueryUrlLink(queryId) {
  const accessToken = await getWechatAccessToken()
  const { envVersion } = getWechatConfig()
  const response = await fetch(
    `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'pages/query/query',
        query: 'id=' + queryId,
        env_version: envVersion,
        expire_type: 0
      })
    }
  )

  if (!response.ok) {
    throw createError('生成小程序链接失败', 'WECHAT_URLLINK_HTTP_ERROR')
  }

  const data = await response.json()
  if (!data || data.errcode) {
    throw createError((data && data.errmsg) || '生成小程序链接失败', 'WECHAT_URLLINK_API_ERROR')
  }

  return data.url_link || ''
}

async function generateQueryQrCodeBuffer(queryId) {
  const accessToken = await getWechatAccessToken()
  const { envVersion } = getWechatConfig()
  const sceneValue = queryId.replace(/-/g, '')
  const requestBody = {
    scene: sceneValue,
    page: 'pages/query/query',
    width: 430,
    env_version: envVersion || 'trial',
    check_path: false
  }
  
  console.log('[生成二维码] 请求参数:', JSON.stringify(requestBody))
  
  const response = await fetch(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )

  if (!response.ok) {
    throw createError('生成小程序码失败', 'WECHAT_QRCODE_HTTP_ERROR')
  }

  const contentType = response.headers.get('content-type') || ''
  const buffer = Buffer.from(await response.arrayBuffer())

  if (contentType.indexOf('application/json') > -1) {
    let errorData = null
    try {
      errorData = JSON.parse(buffer.toString('utf8'))
    } catch (e) {
      errorData = null
    }
    console.error('[生成二维码] 微信API错误:', errorData)
    throw createError((errorData && errorData.errmsg) || '生成小程序码失败', 'WECHAT_QRCODE_API_ERROR')
  }

  return buffer
}

async function getOpenidByCode(code) {
  const config = ensureWechatConfig()
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw createError('获取微信OpenID失败', 'WECHAT_OPENID_HTTP_ERROR')
  }

  const data = await response.json()
  if (!data || data.errcode) {
    throw createError((data && data.errmsg) || '获取微信OpenID失败', 'WECHAT_OPENID_API_ERROR')
  }

  return {
    openid: data.openid,
    sessionKey: data.session_key
  }
}

async function generateJielongQrCodeBuffer(jielongId) {
  const accessToken = await getWechatAccessToken()
  const { envVersion } = getWechatConfig()
  const sceneValue = jielongId.replace(/-/g, '')
  const requestBody = {
    scene: sceneValue,
    page: 'pages/jielong/join/join',
    width: 430,
    env_version: envVersion || 'trial',
    check_path: false
  }

  console.log('[生成接龙二维码] 请求参数:', JSON.stringify(requestBody))

  const response = await fetch(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )

  if (!response.ok) {
    throw createError('生成小程序码失败', 'WECHAT_QRCODE_HTTP_ERROR')
  }

  const contentType = response.headers.get('content-type') || ''
  const buffer = Buffer.from(await response.arrayBuffer())

  if (contentType.indexOf('application/json') > -1) {
    let errorData = null
    try {
      errorData = JSON.parse(buffer.toString('utf8'))
    } catch (e) {
      errorData = null
    }
    console.error('[生成接龙二维码] 微信API错误:', errorData)
    throw createError((errorData && errorData.errmsg) || '生成小程序码失败', 'WECHAT_QRCODE_API_ERROR')
  }

  return buffer
}

module.exports = {
  getWechatConfig,
  getQueryMiniProgramPath,
  generateQueryUrlLink,
  generateQueryQrCodeBuffer,
  generateJielongQrCodeBuffer,
  getOpenidByCode
}
