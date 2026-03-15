const express = require('express')
const router = express.Router()
const userController = require('../controllers/userController')
const { authMiddleware } = require('../config/auth')

router.post('/login', userController.loginOrRegister)
router.get('/info', authMiddleware, userController.getUserInfo)
router.put('/info', authMiddleware, userController.updateUserInfo)

module.exports = router
