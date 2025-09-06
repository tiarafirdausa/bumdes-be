const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController'); 
const { excelImportUpload } = require("../validation/configMulter"); 

router.post('/', categoryController.createCategory); 
router.post("/import-excel", excelImportUpload, categoryController.importCategories);
router.get('/', categoryController.getCategories); 
router.get('/id/:id', categoryController.getCategoryById); 
router.get('/:slug', categoryController.getCategoryBySlug); 
router.put('/id/:id', categoryController.updateCategory); 
router.delete('/:id', categoryController.deleteCategory); 
module.exports = router;