const express = require('express')
const router = express.Router()
const dataController = require('../controllers/dataController')
const { optionalAuth } = require('../config/auth')

router.post('/:id/query', optionalAuth, dataController.queryData)
router.put('/:id/data/:dataId', optionalAuth, dataController.modifyData)
router.post('/:id/data/:dataId/sign', optionalAuth, dataController.signData)

module.exports = router
