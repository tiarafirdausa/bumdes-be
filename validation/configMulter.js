const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createStorage = (folderName) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname,  '..', 'public', 'uploads', folderName);
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

const mediaFileFilter = (req, file, cb) => {
    const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const allowedVideoMimeTypes = [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime", 
        "video/x-msvideo",
    ];
    
    if (allowedImageMimeTypes.includes(file.mimetype) || allowedVideoMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only image (JPEG, PNG, GIF, WebP) and video (MP4, WebM, Ogg, MOV, AVI) files are allowed!"), false);
    }
};

exports.postImageUpload = multer({
  storage: createStorage("posts"), 
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).fields([
  { name: 'featured_image', maxCount: 1 },    
  { name: 'gallery_images', maxCount: 10 }   
]);

exports.pageImageUpload = multer({
  storage: createStorage("pages"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'featured_image', maxCount: 1 },
  { name: 'gallery_images', maxCount: 10 }
]);

exports.userProfileImageUpload = multer({
  storage: createStorage("users"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

exports.settingImageUpload = multer({
  storage: createStorage("settings"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).fields([
  { name: "logo", maxCount: 1 },
]);

exports.tinymceImageUpload = multer({
  storage: createStorage("tinymce"), 
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

exports.tinymceVideoUpload = multer({
  storage: createStorage("tinymce"), 
  fileFilter: videoFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

exports.mediaUpload = multer({
    storage: createStorage("media"),
    fileFilter: mediaFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
    { name: 'media', maxCount: 10 },
    { name: 'featured_image', maxCount: 1 },
    { name: 'media_cropped', maxCount: 1 } 
]);

exports.bannerImageUpload = multer({
  storage: createStorage("banners"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("gambar");

exports.linkImageUpload = multer({
  storage: createStorage("links"),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("gambar");

exports.createStorage = createStorage;
exports.imageFileFilter = imageFileFilter;
