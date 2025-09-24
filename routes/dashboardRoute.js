// routes/dashboard.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get(
  "/summary",
  protect,
  authorize("admin", "editor", "author"),
  dashboardController.getDashboardSummary
);
router.get(
  "/analytics",
  protect,
  authorize("admin", "editor", "author"),
  dashboardController.getAnalyticsData
);

module.exports = router;
