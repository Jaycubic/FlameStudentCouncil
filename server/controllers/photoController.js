// controllers/photoController.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadPath = '/opt/View/StudentTrackingSystem/server/Photos';

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const studentId = req.user?.studentId || req.body.studentId || 'unknown';
    const fileExt = path.extname(file.originalname).toLowerCase();
    const filename = `${studentId}${fileExt}`;
    const filePath = path.join(uploadPath, filename);
    if (fs.existsSync(filePath)) {
      // if you prefer to overwrite instead of rejecting, replace with cb(null, filename)
      cb(new Error('Photo already exists'), null);
    } else {
      console.log(`Saving file to: ${filePath}`);
      cb(null, filename);
    }
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, JPG, and PNG files are allowed'));
  },
}).single('photo');

exports.uploadPhoto = (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.message === 'Photo already exists') {
        return res.status(409).json({
          message:
            'You have already successfully uploaded a photo. For any changes, please contact the Program Office Member for assistance.',
        });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.status(200).json({
      message: 'Photo uploaded successfully',
      filename: req.file.filename, // important: includes extension e.g. "123.jpg"
    });
  });
};

/**
 * GET /photos/:idOrFilename
 * - If client passed "123" -> server will try 123.jpg, 123.jpeg, 123.png
 * - If client passed "123.jpg" -> server will try that exact file
 */
exports.getPhoto = (req, res) => {
  try {
    const param = req.params.studentId; // can be id or filename
    if (!param) return res.status(400).send('Bad request');

    let filePath = null;

    // If client passed extension already (like 123.jpg), serve that exact file if present
    if (path.extname(param)) {
      const potential = path.join(uploadPath, param);
      if (fs.existsSync(potential)) {
        filePath = potential;
      }
    } else {
      // Otherwise try common extensions in order
      const extensions = ['.jpg', '.jpeg', '.png'];
      for (const ext of extensions) {
        const potential = path.join(uploadPath, `${param}${ext}`);
        if (fs.existsSync(potential)) {
          filePath = potential;
          break;
        }
      }
    }

    if (!filePath) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Use absolute path to be safe
    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('Error serving photo:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
