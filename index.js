require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./models/db");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoute = require("./routes/authRoute");
const mediaCategoryRoute = require("./routes/mediaCategoryRoute")
const userRoute = require("./routes/userRoute");
const menuRoute = require("./routes/menuRoute"); 
const menuItemRoute = require("./routes/menuItemRoute");
const categoryRoute = require("./routes/categoryRoute");
const postRoute = require("./routes/postRoute");
const pageRoute = require("./routes/pageRoute");
const dashboardRoute = require("./routes/dashboardRoute");
const commentRoute = require("./routes/commentRoute"); 
const settingRoute = require("./routes/settingRoute");
const socialRoute = require("./routes/socialRoute");
const uploadRoute = require("./routes/uploadRoute");
const mediaRoute = require("./routes/mediaRoute");
const tagRoute = require("./routes/tagRoute");

const generateCsrfToken = require("./middleware/csrfMiddleware");

const app = express();
const port = process.env.PORT;

// Middleware (Helmet dan Rate Limiting)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// app.use(helmet({
//   xContentTypeOptions: false, 
// }));

const frontendUrlsString = process.env.FRONTEND_URLS;
const allowedOrigins = frontendUrlsString ? frontendUrlsString.split(',') : [];

app.set('trust proxy', 1);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.disable("x-powered-by");
app.use(generateCsrfToken);
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

app.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken });
});

app.use("/api", authRoute);
app.use("/api/users", userRoute);
app.use("/api/menus", menuRoute);
app.use("/api/menu-items", menuItemRoute); 
app.use("/api/auth", authRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/posts", postRoute);
app.use("/api/pages", pageRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/comments", commentRoute);
app.use("/api/settings", settingRoute);
app.use("/api/socials", socialRoute);
app.use("/api/upload", uploadRoute);
app.use("/api/media", mediaRoute);
app.use("/api/media-categories", mediaCategoryRoute);
app.use("/api/tags", tagRoute);

app.use((err, req, res, next) => {
  if (err.message === "CSRF token tidak valid atau tidak ada.") {
    return res
      .status(403)
      .json({ error: "Forbidden: CSRF token tidak valid." });
  }
  next(err);
});

async function startServer() {
  try {
    await db.query("SELECT 1");
    console.log("Database connected successfully!");

    app.listen(port, () => {
      console.log(`Server berjalan di http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
