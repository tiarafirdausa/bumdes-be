const express = require("express");
const router = express.Router();
const linksController = require("../controllers/linkController");
const { linkImageUpload } = require("../validation/configMulter");

router.post("/", linkImageUpload, linksController.createLink);
router.get("/", linksController.getLinks);
router.get("/:id", linksController.getLinkById);
router.put("/:id", linkImageUpload, linksController.updateLink);
router.delete("/:id", linksController.deleteLink);

module.exports = router;