const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

router.post('/', menuController.createMenu);
router.get('/', menuController.getMenu);
router.put('/:id', menuController.updateMenu);
router.delete('/:id', menuController.deleteMenu);
router.get('/:id', menuController.getMenuById);


module.exports = router;