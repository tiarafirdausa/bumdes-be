const express = require('express');
const router = express.Router();
const komentarController = require('../controllers/komentarController'); 

router.post('/', komentarController.addComment); 
router.get('/:id', komentarController.getComments);

module.exports = router;