const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const {
  tinymceImageUpload,
  tinymceVideoUpload,
} = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/tinymce-image",
  protect,
  authorize("admin", "editor", "author"),
  tinymceImageUpload.single("image"),
  uploadController.uploadTinymceImage
);
router.post(
  "/tinymce-video",
  protect,
  authorize("admin", "editor", "author"),
  tinymceVideoUpload.single("video"),
  uploadController.uploadTinymceVideo
);

module.exports = router;
