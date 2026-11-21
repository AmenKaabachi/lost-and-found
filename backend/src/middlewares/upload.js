import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});

const fileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
  else {
    const locale = req.locale || 'en';
    cb(new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      translations[locale]?.unsupportedFileFormat || translations.en.unsupportedFileFormat
    ), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).array('photos', 3);