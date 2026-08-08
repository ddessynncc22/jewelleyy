const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadSingleImage } = require('../middleware/upload');
const { sendSuccess } = require('../utils/response');

// Generic single-image upload (e.g. buy-back ID proof). Returns the stored URL.
router.post('/', protect, uploadSingleImage, (req, res, next) => {
  try {
    if (!req.file) {
      return sendSuccess(res, { url: null });
    }
    const url = `${req.uploadBaseUrl}/${req.file.filename}`;
    return sendSuccess(res, { url });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
