const jwt = require('jsonwebtoken')
const { readEnvString } = require('./env')

const getJwtSecret = () => readEnvString('JWT_SECRET', '')

const generateToken = (payload) => {
  const secret = getJwtSecret()
  if (!secret) {
    throw new Error('未配置 JWT_SECRET')
  }

  return jwt.sign(payload, secret, {
    expiresIn: readEnvString('JWT_EXPIRES_IN', '7d')
  })
}

const verifyToken = (token) => {
  try {
    const secret = getJwtSecret()
    if (!secret) {
      return null
    }
    return jwt.verify(token, secret)
  } catch (error) {
    return null
  }
}

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: '令牌无效或已过期'
    })
  }

  req.user = decoded
  next()
}

const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (token) {
    const decoded = verifyToken(token)
    if (decoded) {
      req.user = decoded
    }
  }
  
  next()
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuth
}
