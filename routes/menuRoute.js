const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// Route untuk membuat menu
router.post('/', menuController.createMenu);
// Route untuk mendapatkan semua menu
router.get('/', menuController.getMenu);
// Route untuk memperbarui menu berdasarkan ID
router.put('/:id', menuController.updateMenu);
// Route untuk menghapus menu berdasarkan ID
router.delete('/:id', menuController.deleteMenu);
// Di routes/menu.js atau app.js
router.get('/:id', menuController.getMenuById);


module.exports = router;