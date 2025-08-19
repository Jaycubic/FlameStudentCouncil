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
    const uploadTime = Date.now();
    res.status(200).json({
      message: 'Photo uploaded successfully',
      filename: req.file.filename,
      uploadTime,
    });
  });
};

exports.deletePhoto = (req, res) => {
  const { filename, uploadTime } = req.body;
  const currentTime = Date.now();
  const timeElapsed = currentTime - uploadTime;
  if (timeElapsed > 60000) {
    return res.status(403).json({ message: 'Cannot delete photo after 1 minute' });
  }
  const filePath = path.join(uploadPath, filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to delete photo' });
    }
    res.status(200).json({ message: 'Photo deleted successfully' });
  });
};

exports.editPhoto = (req, res) => {
  const { uploadTime } = req.body;
  const currentTime = Date.now();
  const timeElapsed = currentTime - uploadTime;
  if (timeElapsed > 60000) {
    return res.status(403).json({ message: 'Cannot edit photo after 1 minute' });
  }
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const oldFilename = req.body.filename;
    const oldFilePath = path.join(uploadPath, oldFilename);
    fs.unlink(oldFilePath, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to delete old photo' });
      }
      const newUploadTime = Date.now();
      res.status(200).json({
        message: 'Photo updated successfully',
        filename: req.file.filename,
        uploadTime: newUploadTime,
      });
    });
  });
};
