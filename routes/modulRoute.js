const express = require('express');
const router = express.Router();
const modulController = require('../controllers/modulController');

router.get('/home', modulController.getHomeModules);
router.get('/widget', modulController.getWidgetModules);
router.get('/', modulController.getAllModuls);
router.post('/', modulController.addModul);
router.get('/:id', modulController.getModulById);
router.put('/:id', modulController.updateModul);
router.delete('/:id', modulController.deleteModul);

module.exports = router;