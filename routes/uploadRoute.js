const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { tinymceImageUpload } = require('../validation/configMulter');

router.post('/tinymce-image', tinymceImageUpload.single('image'), uploadController.uploadTinymceImage);

module.exports = router;