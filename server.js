const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const s3 = require('./s3');
const { PutObjectCommand } = require("@aws-sdk/client-s3");
require('dotenv').config();

const app = express();

// ✅ FIX: Default port for CI + local
const PORT = process.env.PORT || 3001;

// ✅ Multer config (memory storage + validation)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'));
    }
    cb(null, true);
  }
});

// ✅ NEW: Health check route (for CI)
app.get("/", (req, res) => {
  res.send("Server is running");
});

// ✅ Upload route
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 🔥 Resize image
    const resized = await sharp(file.buffer)
      .resize({ width: 300 })
      .toBuffer();

    // 🔥 Unique filename
    const fileName = `${uuidv4()}-${Date.now()}.jpg`;

    // 🔥 Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: resized,
      ContentType: "image/jpeg",
    });

    await s3.send(command);

    const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    console.log(`Handled by PORT ${PORT}`);

    res.json({ url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});