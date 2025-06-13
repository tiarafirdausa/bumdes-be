const express = require('express');
const router = express.Router();
const komentarController = require('../controllers/komentarController'); 

router.post('/', komentarController.addComment); 
router.get('/:id', komentarController.getComments);
router.get('/', komentarController.getAllComments);
router.delete('/:id', komentarController.deleteComment);

module.exports = router;