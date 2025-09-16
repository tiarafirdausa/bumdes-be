// backend/middleware/csrfMiddleware.js
const crypto = require("crypto");

const generateCsrfToken = (req, res, next) => {
  const csrfExcludedRoutes = [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/refresh-token",
  ];

  if (csrfExcludedRoutes.includes(req.path)) {
    return next();
  }

  let csrfTokenFromCookie = req.cookies["_csrf"];
  let csrfTokenFromHeader = req.headers["x-csrf-token"];

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!csrfTokenFromCookie) {
      const newCsrfToken = crypto.randomBytes(32).toString("hex");
      res.cookie("_csrf", newCsrfToken, {
        httpOnly: true, 
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        maxAge: 60 * 60 * 1000,
      });
      req.csrfToken = newCsrfToken;
    } else {
      req.csrfToken = csrfTokenFromCookie;
    }
    return next();
  }

  if (!csrfTokenFromHeader || !csrfTokenFromCookie || csrfTokenFromHeader !== csrfTokenFromCookie) {
    return res.status(403).json({ error: "CSRF token tidak valid atau tidak ada." });
  }
  next();
};

module.exports = generateCsrfToken;
