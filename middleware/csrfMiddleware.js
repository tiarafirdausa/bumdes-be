// backend/middleware/csrfMiddleware.js
const crypto = require("crypto");

const generateCsrfToken = (req, res, next) => {
  let csrfTokenFromCookie = req.cookies["_csrf"];
  let csrfTokenFromHeader = req.headers["x-csrf-token"];

  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    if (!csrfTokenFromCookie) {
      const newCsrfToken = crypto.randomBytes(32).toString("hex");
      res.cookie("_csrf", newCsrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1 * 60 * 60 * 1000,
        sameSite: "Lax",
      });
      req.csrfToken = newCsrfToken;
    } else {
      req.csrfToken = csrfTokenFromCookie;
    }
    return next();
  }
  if (
    !csrfTokenFromHeader ||
    !csrfTokenFromCookie ||
    csrfTokenFromHeader !== csrfTokenFromCookie
  ) {
    return res
      .status(403)
      .json({ error: "CSRF token tidak valid atau tidak ada." });
  }
  next();
};

module.exports = generateCsrfToken;
