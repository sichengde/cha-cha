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
  const path = getQueryMiniProgramPath(queryId).slice(1)
  const response = await fetch(
    `https://api.weixin.qq.com/wxa/getwxacode?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: path,
        width: 430,
        check_path: false
      })
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
    throw createError((errorData && errorData.errmsg) || '生成小程序码失败', 'WECHAT_QRCODE_API_ERROR')
  }

  return buffer
}

module.exports = {
  getWechatConfig,
  getQueryMiniProgramPath,
  generateQueryUrlLink,
  generateQueryQrCodeBuffer
}
