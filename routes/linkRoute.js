const express = require("express");
const router = express.Router();
const linksController = require("../controllers/linkController");
const { linkImageUpload } = require("../validation/configMulter");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin", "editor", "author"),
  linkImageUpload,
  linksController.createLink
);
router.get("/", linksController.getLinks);
router.get(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  linksController.getLinkById
);
router.put(
  "/:id",
  protect,
  authorize("admin", "editor", "author"),
  linkImageUpload,
  linksController.updateLink
);
router.delete("/:id", protect, authorize("admin"), linksController.deleteLink);

module.exports = router;
