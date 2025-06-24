const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createStorage = (folderName) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "../public/uploads", folderName);
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileExtension = path.extname(file.originalname);
      cb(null, file.fieldname + "-" + uniqueSuffix + fileExtension);
    },
  });
};

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const videoFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime", 
    "video/x-msvideo",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only video files (MP4, WebM, Ogg, MOV, AVI) are allowed!"
      ),
      false
    );
  }
};

exports.articleImageUpload = multer({
  storage: createStorage("artikel"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.halamanImageUpload = multer({
  storage: createStorage("halaman"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.userProfileImageUpload = multer({
  storage: createStorage("users"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

exports.settingImageUpload = multer({
  storage: createStorage("setting"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).fields([
  { name: "ikon", maxCount: 1 },
  { name: "logo", maxCount: 1 },
]);

exports.tinymceImageUpload = multer({
  storage: createStorage("tinymce"), 
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.tinymceVideoUpload = multer({
  storage: createStorage("tinymce"), 
  fileFilter: videoFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, 
});

exports.createStorage = createStorage;
exports.imageFileFilter = imageFileFilter;
