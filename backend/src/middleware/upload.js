const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Signature check per format; the client-supplied mimetype alone is
// trivially spoofable, so the file's own magic bytes are the gate.
const MAGIC_BYTES = [
  { ext: '.jpg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.jpeg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { ext: '.gif', check: (b) => b.length >= 6 && (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) },
  { ext: '.webp', check: (b) => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { ext: '.bmp', check: (b) => b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d },
];

// True when every extension listed for the format matches the file's header.
function matchesMagicBytes(ext, buf) {
  return MAGIC_BYTES.filter((m) => m.ext === ext).some((m) => m.check(buf));
}

const INVALID_CONTENT_MSG = 'File content does not match an allowed image format (jpeg, png, gif, webp, bmp)';

// Called after multer has written files: each one is re-read and checked
// against its real content signatures; anything that fails is deleted and the
// request is rejected with a 400.
function verifySavedFiles(req, res, next) {
  const files = req.files && req.files.length ? req.files : req.file ? [req.file] : [];
  for (const file of files) {
    const ext = path.extname(file.filename || file.originalname || '').toLowerCase();
    let header;
    try {
      const fd = fs.openSync(file.path, 'r');
      header = Buffer.alloc(12);
      fs.readSync(fd, header, 0, 12, 0);
      fs.closeSync(fd);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file could not be read',
        errors: null,
      });
    }
    if (!matchesMagicBytes(ext, header)) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        success: false,
        message: INVALID_CONTENT_MSG,
        errors: null,
      });
    }
  }
  return next();
}

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
    return verifySavedFiles(req, res, next);
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
    return verifySavedFiles(req, res, next);
  });
};

module.exports = { upload, uploadImages, uploadSingleImage };
