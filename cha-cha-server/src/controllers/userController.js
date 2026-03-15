const { v4: uuidv4 } = require('uuid')
const { query, queryOne, insert } = require('../config/database')
const { generateToken } = require('../config/auth')

const loginOrRegister = async (req, res) => {
  try {
    const { openid, nickname, avatar_url } = req.body
    console.log('登录请求:', { openid, nickname, avatar_url, body: req.body })

    if (!openid) {
      return res.status(400).json({
        success: false,
        message: 'openid不能为空'
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
        openid,
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

module.exports = {
  loginOrRegister,
  getUserInfo,
  updateUserInfo
}
