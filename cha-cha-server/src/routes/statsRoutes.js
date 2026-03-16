const express = require('express')
const router = express.Router()
const statsController = require('../controllers/statsController')
const { authMiddleware } = require('../config/auth')

router.get('/:id', authMiddleware, statsController.getStatistics)
router.get('/:id/all', authMiddleware, statsController.getAllDataList)
router.get('/:id/unqueried', authMiddleware, statsController.getUnqueriedList)
router.get('/:id/unsigned', authMiddleware, statsController.getUnsignedList)

module.exports = router
