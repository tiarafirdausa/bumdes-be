// backend/routes/authRoute.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { loginValidation } = require("../validation/authValidation");
const { loginLimiter, forgotPasswordLimiter } = require("../validation/rateLimiters");

router.post("/login", 
  loginLimiter, 
  loginValidation, authController.loginUser);
router.post("/logout", authController.logoutUser);
router.get("/me", authMiddleware.protect, authController.getLoggedInUser);

router.post("/forgotpassword", forgotPasswordLimiter, authController.forgotPassword);
router.post("/resetpassword", authController.resetPassword);

module.exports = router;