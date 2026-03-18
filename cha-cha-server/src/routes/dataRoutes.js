const express = require('express')
const router = express.Router()
const dataController = require('../controllers/dataController')
const { optionalAuth, authMiddleware } = require('../config/auth')

router.post('/:id/query', optionalAuth, dataController.queryData)
router.put('/:id/data/:dataId', authMiddleware, dataController.modifyData)
router.post('/:id/data/:dataId/sign', authMiddleware, dataController.signData)

module.exports = router
