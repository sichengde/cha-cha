const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const userController = require('../controllers/userController')
const { authMiddleware } = require('../config/auth')

const avatarDir = path.join(__dirname, '../../uploads/avatars')
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true })
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${req.user.id}-${Date.now()}${ext}`)
  }
})

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('只支持图片文件'))
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 }
})

router.post('/login', userController.loginOrRegister)
router.get('/info', authMiddleware, userController.getUserInfo)
router.put('/info', authMiddleware, userController.updateUserInfo)
router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), userController.uploadAvatar)

module.exports = router
