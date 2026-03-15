const express = require('express')
const router = express.Router()
const queryController = require('../controllers/queryController')
const { authMiddleware } = require('../config/auth')

router.post('/', authMiddleware, queryController.createQueryPage)
router.get('/my', authMiddleware, queryController.getMyQueryPages)
router.get('/:id', queryController.getQueryPage)
router.put('/:id', authMiddleware, queryController.updateQueryPage)
router.delete('/:id', authMiddleware, queryController.deleteQueryPage)

module.exports = router
