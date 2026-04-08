const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { photoUploadQueue } = require('../queues/photoUploadQueue');

const uploadPath = '/opt/View/StudentTrackingSystem/server/Photos';

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // req.body is NOT reliably available during filename() — multer hasn't parsed it yet.
    // We pass studentId as a query param: POST /api/photos/upload?studentId=240951
    const studentId = req.query.studentId || 'unknown';
    const fileExt = path.extname(file.originalname).toLowerCase();
    const filename = `${studentId}${fileExt}`;
    const filePath = path.join(uploadPath, filename);

    // Clean up any OTHER extension variant so getPhoto finds exactly one file
    const extensions = ['.jpg', '.jpeg', '.png'];
    extensions.forEach(ext => {
      const old = path.join(uploadPath, `${studentId}${ext}`);
      if (old !== filePath && fs.existsSync(old)) {
        fs.unlinkSync(old);
      }
    });

    console.log(`[PHOTO] Saving: ${filePath}`);
    cb(null, filename);
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
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Trigger Google Drive upload now that the local file exists
    setImmediate(async () => {
      try {
        const studentId = req.query.studentId || 'unknown';
        const studentEmail = req.user?.email;

        if (studentId !== 'unknown' && studentEmail) {
          await photoUploadQueue.add(
            `upload:${studentId}`,
            { studentId, studentEmail, jobType: 'upload' },
            {
              jobId: `upload-${studentId}-${Date.now()}`,
              priority: 1,
              attempts: 4,
              backoff: { type: 'exponential', delay: 15_000 }
            }
          );
          console.log(`[PHOTO] Queued Drive upload for ${studentId} after local upload`);
        }
      } catch (qErr) {
        console.error('[PHOTO] Failed to enqueue Drive upload:', qErr.message);
      }
    });

    res.status(200).json({
      message: 'Photo uploaded successfully',
      filename: req.file.filename, // e.g. "240951.png" — includes extension
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
    console.log('[PHOTO] getPhoto called, param:', param);
    if (!param) return res.status(400).send('Bad request');

    let filePath = null;

    // If client passed extension already (like 123.jpg), serve that exact file if present
    if (path.extname(param)) {
      const potential = path.join(uploadPath, param);
      console.log('[PHOTO] Has extension, trying exact:', potential, 'exists:', fs.existsSync(potential));
      if (fs.existsSync(potential)) {
        filePath = potential;
      }
    } else {
      // Otherwise try common extensions in order
      const extensions = ['.jpg', '.jpeg', '.png'];
      for (const ext of extensions) {
        const potential = path.join(uploadPath, `${param}${ext}`);
        console.log('[PHOTO] Trying:', potential, 'exists:', fs.existsSync(potential));
        if (fs.existsSync(potential)) {
          filePath = potential;
          break;
        }
      }
    }

    if (!filePath) {
      console.log('[PHOTO] NOT FOUND for param:', param);
      return res.status(404).json({ message: 'Photo not found' });
    }

    console.log('[PHOTO] Serving:', path.resolve(filePath));
    // Use absolute path to be safe
    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('Error serving photo:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
