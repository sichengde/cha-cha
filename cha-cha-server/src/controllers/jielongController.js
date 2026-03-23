const { v4: uuidv4 } = require('uuid')
const { query, queryOne, insert, update, remove, transaction } = require('../config/database')
const { generateJielongQrCodeBuffer } = require('../services/wechatService')
const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')

const exportDir = path.join(__dirname, '../../exports')
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true })
}

// ========== 创建接龙 ==========
const createJielong = async (req, res) => {
  try {
    const userId = req.user.id
    const { title, description, deadline, max_count, need_remark, remark_hint, fields } = req.body

    if (!title || title.length > 30) {
      return res.status(400).json({ success: false, message: '请输入标题（最多30字）' })
    }
    if (description && description.length > 200) {
      return res.status(400).json({ success: false, message: '描述最多200字' })
    }
    if (need_remark && !remark_hint) {
      return res.status(400).json({ success: false, message: '开启备注收集时须填写提示语' })
    }

    // 验证自定义字段
    let fieldsJson = null
    if (fields && Array.isArray(fields) && fields.length > 0) {
      const validFields = fields.filter(f => f && f.name && typeof f.name === 'string').map(f => ({
        name: f.name.trim().slice(0, 20),
        required: !!f.required
      }))
      if (validFields.length > 0) {
        fieldsJson = JSON.stringify(validFields)
      }
    }

    const id = uuidv4()
    await insert('jielong', {
      id,
      title: title.trim(),
      description: (description || '').trim() || null,
      creator_id: userId,
      deadline: deadline ? new Date(deadline).toISOString().slice(0, 19).replace('T', ' ') : null,
      max_count: max_count && max_count > 0 ? parseInt(max_count) : null,
      need_remark: need_remark ? 1 : 0,
      remark_hint: remark_hint || null,
      fields: fieldsJson,
      status: 'open'
    })

    res.json({ success: true, data: { id } })
  } catch (error) {
    console.error('创建接龙失败:', error)
    res.status(500).json({ success: false, message: '创建失败' })
  }
}

// ========== 更新接龙 ==========
const updateJielong = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { title, description, deadline, max_count, need_remark, remark_hint, status } = req.body

    const jielong = await queryOne('SELECT * FROM jielong WHERE id = ? AND creator_id = ?', [id, userId])
    if (!jielong) {
      return res.status(404).json({ success: false, message: '接龙不存在或无权限' })
    }

    const updates = {}
    if (title !== undefined) {
      if (!title || title.length > 30) return res.status(400).json({ success: false, message: '标题最多30字' })
      updates.title = title.trim()
    }
    if (description !== undefined) updates.description = description ? description.trim() : null
    if (deadline !== undefined) updates.deadline = deadline ? new Date(deadline).toISOString().slice(0, 19).replace('T', ' ') : null
    if (max_count !== undefined) updates.max_count = max_count && max_count > 0 ? parseInt(max_count) : null
    if (need_remark !== undefined) updates.need_remark = need_remark ? 1 : 0
    if (remark_hint !== undefined) updates.remark_hint = remark_hint || null
    if (status !== undefined && (status === 'open' || status === 'closed')) updates.status = status

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: '无更新内容' })
    }

    await update('jielong', updates, 'id = ?', [id])
    res.json({ success: true, message: '更新成功' })
  } catch (error) {
    console.error('更新接龙失败:', error)
    res.status(500).json({ success: false, message: '更新失败' })
  }
}

// ========== 获取接龙详情 ==========
const getJielongDetail = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const jielong = await queryOne('SELECT * FROM jielong WHERE id = ?', [id])
    if (!jielong) {
      return res.status(404).json({ success: false, message: '接龙不存在' })
    }

    // 自动关闭检查：截止时间已过
    if (jielong.status === 'open' && jielong.deadline && new Date(jielong.deadline) < new Date()) {
      await update('jielong', { status: 'closed' }, 'id = ?', [id])
      jielong.status = 'closed'
    }

    const members = await query(
      'SELECT id, user_id, nickname, avatar, remark, field_values, joined_at FROM jielong_member WHERE jielong_id = ? AND is_deleted = 0 ORDER BY joined_at ASC',
      [id]
    )

    const memberCount = members.length
    // 自动关闭检查：人数已满
    if (jielong.status === 'open' && jielong.max_count && memberCount >= jielong.max_count) {
      await update('jielong', { status: 'closed' }, 'id = ?', [id])
      jielong.status = 'closed'
    }

    // 检查当前用户是否已报名
    const myMembership = members.find(m => m.user_id === userId)

    // 解析自定义字段
    let parsedFields = null
    try { parsedFields = jielong.fields ? JSON.parse(jielong.fields) : null } catch (e) {}

    res.json({
      success: true,
      data: {
        ...jielong,
        need_remark: !!jielong.need_remark,
        fields: parsedFields,
        is_creator: jielong.creator_id === userId,
        is_joined: !!myMembership,
        my_member_id: myMembership ? myMembership.id : null,
        member_count: memberCount,
        members: members.map((m, i) => {
          let fv = null
          try { fv = m.field_values ? JSON.parse(m.field_values) : null } catch (e) {}
          return {
            ...m,
            field_values: fv,
            seq: i + 1
          }
        })
      }
    })
  } catch (error) {
    console.error('获取接龙详情失败:', error)
    res.status(500).json({ success: false, message: '获取详情失败' })
  }
}

// ========== 我的接龙列表 ==========
const getMyJielongList = async (req, res) => {
  try {
    const userId = req.user.id
    const { type = 'created', page = 1, pageSize = 20, keyword, status } = req.query
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(pageSize)
    const limit = Math.min(50, Math.max(1, parseInt(pageSize)))

    let rows, total

    if (type === 'joined') {
      // 我参与的
      let countSql = `SELECT COUNT(DISTINCT jm.jielong_id) as total
         FROM jielong_member jm JOIN jielong j ON j.id = jm.jielong_id
         WHERE jm.user_id = ? AND jm.is_deleted = 0`
      const countParams = [userId]
      if (keyword) {
        countSql += ' AND j.title LIKE ?'
        countParams.push('%' + keyword + '%')
      }
      if (status === 'open' || status === 'closed') {
        countSql += ' AND j.status = ?'
        countParams.push(status)
      }
      const [countResult] = await query(countSql, countParams)
      total = countResult ? countResult.total : 0

      let listSql = `SELECT j.*, (SELECT COUNT(*) FROM jielong_member WHERE jielong_id = j.id AND is_deleted = 0) as member_count
         FROM jielong j
         INNER JOIN jielong_member jm ON j.id = jm.jielong_id
         WHERE jm.user_id = ? AND jm.is_deleted = 0`
      const listParams = [userId]
      if (keyword) {
        listSql += ' AND j.title LIKE ?'
        listParams.push('%' + keyword + '%')
      }
      if (status === 'open' || status === 'closed') {
        listSql += ' AND j.status = ?'
        listParams.push(status)
      }
      listSql += ' GROUP BY j.id ORDER BY jm.joined_at DESC LIMIT ? OFFSET ?'
      listParams.push(limit, offset)
      rows = await query(listSql, listParams)
    } else {
      // 我发起的
      let countSql = 'SELECT COUNT(*) as total FROM jielong WHERE creator_id = ?'
      const countParams = [userId]
      if (keyword) {
        countSql += ' AND title LIKE ?'
        countParams.push('%' + keyword + '%')
      }
      if (status === 'open' || status === 'closed') {
        countSql += ' AND status = ?'
        countParams.push(status)
      }
      const countResult = await queryOne(countSql, countParams)
      total = countResult ? countResult.total : 0

      let listSql = `SELECT j.*, (SELECT COUNT(*) FROM jielong_member WHERE jielong_id = j.id AND is_deleted = 0) as member_count
         FROM jielong j
         WHERE j.creator_id = ?`
      const listParams = [userId]
      if (keyword) {
        listSql += ' AND j.title LIKE ?'
        listParams.push('%' + keyword + '%')
      }
      if (status === 'open' || status === 'closed') {
        listSql += ' AND j.status = ?'
        listParams.push(status)
      }
      listSql += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?'
      listParams.push(limit, offset)
      rows = await query(listSql, listParams)
    }

    res.json({
      success: true,
      data: {
        list: rows.map(r => ({ ...r, need_remark: !!r.need_remark })),
        total,
        page: parseInt(page),
        pageSize: limit
      }
    })
  } catch (error) {
    console.error('获取接龙列表失败:', error)
    res.status(500).json({ success: false, message: '获取列表失败' })
  }
}

// ========== 报名 ==========
const joinJielong = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { remark, field_values, nickname: submittedNickname, avatar: submittedAvatar } = req.body

    const jielong = await queryOne('SELECT * FROM jielong WHERE id = ?', [id])
    if (!jielong) {
      return res.status(404).json({ success: false, message: '接龙不存在' })
    }

    // 检查是否已关闭
    if (jielong.status === 'closed') {
      return res.status(400).json({ success: false, message: '接龙已关闭' })
    }
    // 检查截止时间
    if (jielong.deadline && new Date(jielong.deadline) < new Date()) {
      await update('jielong', { status: 'closed' }, 'id = ?', [id])
      return res.status(400).json({ success: false, message: '接龙已过截止时间' })
    }

    // 检查人数上限
    const countResult = await queryOne(
      'SELECT COUNT(*) as cnt FROM jielong_member WHERE jielong_id = ? AND is_deleted = 0',
      [id]
    )
    if (jielong.max_count && countResult.cnt >= jielong.max_count) {
      await update('jielong', { status: 'closed' }, 'id = ?', [id])
      return res.status(400).json({ success: false, message: '已满员' })
    }

    // 检查是否需要备注
    if (jielong.need_remark && !remark) {
      return res.status(400).json({ success: false, message: '请填写备注' })
    }

    // 验证自定义字段
    let parsedFields = null
    try { parsedFields = jielong.fields ? JSON.parse(jielong.fields) : null } catch (e) {}
    let fieldValuesJson = null
    if (parsedFields && parsedFields.length > 0) {
      if (!field_values || typeof field_values !== 'object') {
        return res.status(400).json({ success: false, message: '请填写必填字段' })
      }
      for (const f of parsedFields) {
        if (f.required && (!field_values[f.name] || !field_values[f.name].toString().trim())) {
          return res.status(400).json({ success: false, message: '请填写' + f.name })
        }
      }
      fieldValuesJson = JSON.stringify(field_values)
    }

    // 检查是否已报名（包括被删除的记录）
    const existing = await queryOne(
      'SELECT id, is_deleted FROM jielong_member WHERE jielong_id = ? AND user_id = ?',
      [id, userId]
    )

    // 获取用户信息
    const user = await queryOne('SELECT nickname, avatar_url FROM users WHERE id = ?', [userId])
    const finalNickname = submittedNickname || (user && user.nickname) || '微信用户'
    const finalAvatar = submittedAvatar || (user && user.avatar_url) || ''

    if (existing) {
      if (!existing.is_deleted) {
        return res.status(400).json({ success: false, message: '您已报名' })
      }
      // 之前被删除过，恢复报名
      await update('jielong_member', {
        is_deleted: 0,
        nickname: finalNickname,
        avatar: finalAvatar,
        remark: remark || null,
        field_values: fieldValuesJson,
        joined_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }, 'id = ?', [existing.id])
    } else {
      await insert('jielong_member', {
        jielong_id: id,
        user_id: userId,
        nickname: finalNickname,
        avatar: finalAvatar,
        remark: remark || null,
        field_values: fieldValuesJson
      })
    }

    res.json({ success: true, message: '报名成功' })
  } catch (error) {
    console.error('报名失败:', error)
    res.status(500).json({ success: false, message: '报名失败' })
  }
}

// ========== 取消报名 ==========
const quitJielong = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const jielong = await queryOne('SELECT status FROM jielong WHERE id = ?', [id])
    if (!jielong) {
      return res.status(404).json({ success: false, message: '接龙不存在' })
    }
    if (jielong.status === 'closed') {
      return res.status(400).json({ success: false, message: '接龙已关闭，无法取消' })
    }

    const member = await queryOne(
      'SELECT id FROM jielong_member WHERE jielong_id = ? AND user_id = ? AND is_deleted = 0',
      [id, userId]
    )
    if (!member) {
      return res.status(400).json({ success: false, message: '您未报名' })
    }

    await remove('jielong_member', 'id = ?', [member.id])

    res.json({ success: true, message: '已取消报名' })
  } catch (error) {
    console.error('取消报名失败:', error)
    res.status(500).json({ success: false, message: '取消报名失败' })
  }
}

// ========== 发起人删除成员 ==========
const removeMember = async (req, res) => {
  try {
    const { id, memberId } = req.params
    const userId = req.user.id

    const jielong = await queryOne('SELECT creator_id FROM jielong WHERE id = ?', [id])
    if (!jielong || jielong.creator_id !== userId) {
      return res.status(403).json({ success: false, message: '无权操作' })
    }

    const member = await queryOne(
      'SELECT id FROM jielong_member WHERE id = ? AND jielong_id = ? AND is_deleted = 0',
      [memberId, id]
    )
    if (!member) {
      return res.status(404).json({ success: false, message: '成员不存在' })
    }

    await update('jielong_member', { is_deleted: 1 }, 'id = ?', [memberId])

    res.json({ success: true, message: '已移除成员' })
  } catch (error) {
    console.error('删除成员失败:', error)
    res.status(500).json({ success: false, message: '删除成员失败' })
  }
}

// ========== 删除接龙 ==========
const deleteJielong = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const jielong = await queryOne('SELECT creator_id FROM jielong WHERE id = ?', [id])
    if (!jielong || jielong.creator_id !== userId) {
      return res.status(403).json({ success: false, message: '无权操作' })
    }

    await remove('jielong_member', 'jielong_id = ?', [id])
    await remove('jielong', 'id = ?', [id])

    res.json({ success: true, message: '已删除' })
  } catch (error) {
    console.error('删除接龙失败:', error)
    res.status(500).json({ success: false, message: '删除失败' })
  }
}

// ========== 导出名单 ==========
const exportMembers = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const jielong = await queryOne('SELECT * FROM jielong WHERE id = ? AND creator_id = ?', [id, userId])
    if (!jielong) {
      return res.status(403).json({ success: false, message: '无权操作' })
    }

    const members = await query(
      'SELECT nickname, remark, field_values, joined_at FROM jielong_member WHERE jielong_id = ? AND is_deleted = 0 ORDER BY joined_at ASC',
      [id]
    )

    // 解析自定义字段定义
    let parsedFields = null
    try { parsedFields = jielong.fields ? JSON.parse(jielong.fields) : null } catch (e) {}

    const headerRow = ['序号', '昵称']
    if (parsedFields && parsedFields.length > 0) {
      parsedFields.forEach(f => headerRow.push(f.name))
    }
    headerRow.push('报名时间')
    if (jielong.need_remark) headerRow.push('备注')

    const sheetData = [headerRow]
    members.forEach((m, i) => {
      const row = [i + 1, m.nickname]
      if (parsedFields && parsedFields.length > 0) {
        let fv = null
        try { fv = m.field_values ? JSON.parse(m.field_values) : null } catch (e) {}
        parsedFields.forEach(f => row.push((fv && fv[f.name]) || ''))
      }
      row.push(m.joined_at)
      if (jielong.need_remark) row.push(m.remark || '')
      sheetData.push(row)
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, '报名名单')

    const fileName = `${jielong.title}_报名名单_${Date.now()}.xlsx`
    const exportPath = path.join(exportDir, fileName)
    XLSX.writeFile(workbook, exportPath)

    res.download(exportPath, fileName, (err) => {
      if (err) console.error('下载文件失败:', err)
    })
  } catch (error) {
    console.error('导出名单失败:', error)
    res.status(500).json({ success: false, message: '导出失败' })
  }
}

// ========== 接龙二维码 ==========
const getJielongQrCode = async (req, res) => {
  try {
    const { id } = req.params

    const jielong = await queryOne('SELECT id FROM jielong WHERE id = ?', [id])
    if (!jielong) {
      return res.status(404).json({ success: false, message: '接龙不存在' })
    }

    const qrCodeBuffer = await generateJielongQrCodeBuffer(id)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    res.send(qrCodeBuffer)
  } catch (error) {
    console.error('生成接龙二维码失败:', error)
    const statusCode = error.code === 'WECHAT_CONFIG_MISSING' ? 400 : 500
    res.status(statusCode).json({ success: false, message: error.message || '生成二维码失败' })
  }
}

module.exports = {
  createJielong,
  updateJielong,
  getJielongDetail,
  getMyJielongList,
  joinJielong,
  quitJielong,
  removeMember,
  deleteJielong,
  exportMembers,
  getJielongQrCode
}
