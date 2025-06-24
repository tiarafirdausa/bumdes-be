const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { tinymceImageUpload, tinymceVideoUpload } = require('../validation/configMulter');

router.post('/tinymce-image', tinymceImageUpload.single('image'), uploadController.uploadTinymceImage);
router.post('/tinymce-video', tinymceVideoUpload.single('video'), uploadController.uploadTinymceVideo);


module.exports = router;