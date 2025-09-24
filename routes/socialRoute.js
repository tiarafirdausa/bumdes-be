// routes/socialRoutes.js
const express = require("express");
const router = express.Router();
const socialController = require("../controllers/socialController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  socialController.createSocial
);
router.get("/", socialController.getAllSocial);
router.get("/:id", socialController.getSocialById);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  socialController.updateSocial
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  socialController.deleteSocial
);

module.exports = router;
