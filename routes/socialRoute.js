// routes/socialRoutes.js
const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController'); 

router.post('/', socialController.createSocial);
router.get('/', socialController.getAllSocial);
router.get('/:id', socialController.getSocialById);
router.put('/:id', socialController.updateSocial);
router.delete('/:id', socialController.deleteSocial);

module.exports = router;