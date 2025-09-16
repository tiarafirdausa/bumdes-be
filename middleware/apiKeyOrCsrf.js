const csrfMiddleware = require("./csrfMiddleware");

function apiKeyOrCsrf(req, res, next) {
  const apiKey = req.header("X-API-Key");

  if (apiKey && apiKey === process.env.INTERNAL_API_KEY) {
    return next();
  }

  return csrfMiddleware(req, res, next);
}

module.exports = apiKeyOrCsrf;
