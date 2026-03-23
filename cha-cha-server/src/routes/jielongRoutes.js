const express = require('express')
const router = express.Router()
const jielongController = require('../controllers/jielongController')
const { authMiddleware } = require('../config/auth')

router.post('/', authMiddleware, jielongController.createJielong)
router.get('/mine', authMiddleware, jielongController.getMyJielongList)
router.get('/:id', authMiddleware, jielongController.getJielongDetail)
router.put('/:id', authMiddleware, jielongController.updateJielong)
router.delete('/:id', authMiddleware, jielongController.deleteJielong)
router.post('/:id/join', authMiddleware, jielongController.joinJielong)
router.post('/:id/quit', authMiddleware, jielongController.quitJielong)
router.delete('/:id/member/:memberId', authMiddleware, jielongController.removeMember)
router.get('/:id/export', authMiddleware, jielongController.exportMembers)
router.get('/:id/qrcode', authMiddleware, jielongController.getJielongQrCode)

module.exports = router
