const { v4: uuidv4 } = require('uuid')
const { query, queryOne, insert } = require('../config/database')
const { generateToken } = require('../config/auth')
const { getOpenidByCode } = require('../services/wechatService')

const loginOrRegister = async (req, res) => {
  try {
    const { login_code, nickname, avatar_url } = req.body

    if (!login_code) {
      return res.status(400).json({
        success: false,
        message: '缺少登录凭证'
      })
    }

    let openid
    try {
      const result = await getOpenidByCode(login_code)
      openid = result.openid
    } catch (error) {
      console.error('获取openid失败:', error.message)
      return res.status(400).json({
        success: false,
        message: '微信登录失败，请重试'
      })
    }

    if (!openid) {
      return res.status(400).json({
        success: false,
        message: '获取用户信息失败'
      })
    }

    let user = await queryOne(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    )

    if (!user) {
      const userId = uuidv4()
      await insert('users', {
        id: userId,
        openid: openid,
        nickname: nickname || '微信用户',
        avatar_url: avatar_url || ''
      })

      user = await queryOne(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      )
    }

    const token = generateToken({
      id: user.id,
      openid: user.openid,
      nickname: user.nickname
    })

    res.json({
      success: true,
      data: {
        token,
        userInfo: {
          id: user.id,
          nickname: user.nickname,
          avatar_url: user.avatar_url
        }
      }
    })
  } catch (error) {
    console.error('登录失败:', error)
    res.status(500).json({
      success: false,
      message: '登录失败'
    })
  }
}

const getUserInfo = async (req, res) => {
  try {
    const userId = req.user.id

    const user = await queryOne(
      'SELECT id, nickname, avatar_url, phone, created_at FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      return res.status(404).json({
      success: false,
      message: '用户不存在'
      })
    }

    res.json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error('获取用户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    })
  }
}

const updateUserInfo = async (req, res) => {
  try {
    const userId = req.user.id
    const { nickname, phone, avatar_url } = req.body

    const updates = []
    const values = []

    if (nickname !== undefined) {
      updates.push('nickname = ?')
      values.push(nickname)
    }
    if (phone !== undefined) {
      updates.push('phone = ?')
      values.push(phone)
    }
    if (avatar_url !== undefined) {
      updates.push('avatar_url = ?')
      values.push(avatar_url)
    }

    if (updates.length === 0) {
      return res.json({
        success: true,
        message: '没有需要更新的内容'
      })
    }

    values.push(userId)

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    const user = await queryOne(
      'SELECT id, nickname, avatar_url, phone FROM users WHERE id = ?',
      [userId]
    )

    res.json({
      success: true,
      message: '更新成功',
      data: user
    })
  } catch (error) {
    console.error('更新用户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    })
  }
}

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传头像' })
    }

    const avatarPath = '/chacha/uploads/avatars/' + req.file.filename

    res.json({ success: true, data: { path: avatarPath } })
  } catch (error) {
    console.error('上传头像失败:', error)
    res.status(500).json({ success: false, message: '上传头像失败' })
  }
}

module.exports = {
  loginOrRegister,
  getUserInfo,
  updateUserInfo,
  uploadAvatar
}
