const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define a reusable storage configuration function
const createStorage = (folderName) => {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = path.join(__dirname, '../public/uploads', folderName);
            // Ensure the directory exists
            fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            // Create a unique filename: originalname-timestamp.ext
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileExtension = path.extname(file.originalname);
            cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
        }
    });
};

// Define a reusable file filter for images
const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Export pre-configured upload instances for common uses or just the building blocks
exports.articleImageUpload = multer({
    storage: createStorage('artikel'), // Use 'artikel' folder
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

exports.halamanImageUpload = multer({
    storage: createStorage('halaman'), // Use 'halaman' folder
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

exports.userProfileImageUpload = multer({
    storage: createStorage('users'), // Use 'users' folder for profile pictures
    fileFilter: imageFileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // Example: 2MB limit for profile pictures
});

// Or export the building blocks if you want to configure on the fly
exports.createStorage = createStorage;
exports.imageFileFilter = imageFileFilter;