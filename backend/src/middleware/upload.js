const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = req.tenantId || 'system';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uploadDir = path.join(__dirname, '..', '..', config.uploadPath, tenantId.toString(), dateStr);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    req.uploadBaseUrl = `/uploads/${tenantId}/${dateStr}`;
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
  relativePath: (req, file) => req.uploadBaseUrl || `/uploads/${req.tenantId || 'system'}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|bmp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp, bmp) are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 10,
  },
  fileFilter,
});

const uploadMultiple = upload.array('images', 5);

const uploadImages = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB.',
            errors: null,
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files. Maximum is 5 files.',
            errors: null,
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
          errors: null,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: null,
      });
    }
    next();
  });
};

const uploadSingle = upload.single('image');

const uploadSingleImage = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum size is 5MB.' : err.message,
          errors: null,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: null,
      });
    }
    next();
  });
};

module.exports = { upload, uploadImages, uploadSingleImage };
