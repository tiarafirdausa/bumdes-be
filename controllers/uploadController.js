const path = require('path');

exports.uploadTinymceImage = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const imageUrl = `/uploads/tinymce/${req.file.filename}`;

    res.status(200).json({ location: imageUrl });
  } catch (error) {
    console.error("Error uploading TinyMCE image:", error);
    res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
};

exports.uploadTinymceVideo = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const videoUrl = `/uploads/tinymce/${req.file.filename}`;

    res.status(200).json({ location: videoUrl }); 
  } catch (error) {
    console.error("Error uploading TinyMCE video:", error);
    res.status(500).json({ error: 'Failed to upload video', details: error.message });
  }
};