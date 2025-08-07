// routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

router.post('/', menuController.createMenu);
router.get('/', menuController.getAllMenus); 
router.get('/id/:id', menuController.getMenuById);
router.get('/:slug', menuController.getMenuBySlug); 
router.get('/with-items/:slug', menuController.getMenuWithItemsBySlug);
router.put('/:id', menuController.updateMenu);
router.delete('/:id', menuController.deleteMenu);

module.exports = router;