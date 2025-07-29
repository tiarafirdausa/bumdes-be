// routes/dashboard.js
const express = require("express");
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/summary', dashboardController.getDashboardSummary);
router.get('/analytics', dashboardController.getAnalyticsData);

module.exports = router;
