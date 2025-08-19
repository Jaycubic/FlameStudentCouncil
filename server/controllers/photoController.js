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
    const studentId = req.user.studentId; // From validateToken middleware
    const fileExt = path.extname(file.originalname).toLowerCase();
    const filename = `${studentId}${fileExt}`;
    const filePath = path.join(uploadPath, filename);
    if (fs.existsSync(filePath)) {
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
          message: 'You have already successfully uploaded a photo. For any changes, please contact the Program Office Member for assistance.' 
        });
      }
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.status(200).json({
      message: 'Photo uploaded successfully',
      filename: req.file.filename,
    });
  });
};

exports.getPhoto = (req, res) => {
  const studentId = req.params.studentId;
  const extensions = ['.jpg', '.jpeg', '.png'];
  let filePath = null;

  for (const ext of extensions) {
    const potentialPath = path.join(uploadPath, `${studentId}${ext}`);
    if (fs.existsSync(potentialPath)) {
      filePath = potentialPath;
      break;
    }
  }

  if (!filePath) {
    return res.status(404).json({ message: 'Photo not found' });
  }

  res.sendFile(filePath);
};