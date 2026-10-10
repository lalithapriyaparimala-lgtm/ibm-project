/**
 * routes/documents.js
 * Handles recipe document upload and management endpoints.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { parseDocument } = require('../src/documentParser');
const { chunkText } = require('../src/chunker');
const { addChunk, rebuildVectors, listDocuments, removeDocument, chunkCount } = require('../src/vectorStore');

const router = express.Router();

// ─── Multer upload config ─────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uuidv4()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
  },
});

// ─── POST /api/documents/upload ───────────────────────────────────────────────
router.post('/upload', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const results = [];
  const errors = [];

  for (const file of req.files) {
    try {
      const text = await parseDocument(file.path, file.mimetype);

      if (!text || text.trim().length < 50) {
        errors.push({ filename: file.originalname, error: 'File appears to be empty or unreadable.' });
        fs.unlinkSync(file.path);
        continue;
      }

      const chunkSize = parseInt(process.env.CHUNK_SIZE) || 512;
      const overlap = parseInt(process.env.CHUNK_OVERLAP) || 50;
      const chunks = chunkText(text, chunkSize, overlap);

      const uploadedAt = new Date().toISOString();
      for (let i = 0; i < chunks.length; i++) {
        addChunk(chunks[i], {
          filename: file.originalname,
          storedAs: file.filename,
          chunkIndex: i,
          totalChunks: chunks.length,
          uploadedAt,
        });
      }

      // Clean up uploaded file after ingestion
      fs.unlinkSync(file.path);

      results.push({
        filename: file.originalname,
        chunks: chunks.length,
        characters: text.length,
        uploadedAt,
      });
    } catch (err) {
      errors.push({ filename: file.originalname, error: err.message });
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
  }

  // Rebuild TF-IDF vectors once after all files are processed
  if (results.length > 0) rebuildVectors();

  res.json({
    success: results.length > 0,
    processed: results,
    errors,
    totalChunks: chunkCount(),
  });
});

// ─── GET /api/documents ───────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({ documents: listDocuments(), totalChunks: chunkCount() });
});

// ─── DELETE /api/documents/:filename ─────────────────────────────────────────
router.delete('/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  removeDocument(filename);
  res.json({ success: true, message: `Removed "${filename}" from the knowledge base.` });
});

module.exports = router;
