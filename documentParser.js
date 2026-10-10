/**
 * documentParser.js
 * Extracts plain text from uploaded recipe documents.
 * Supports: PDF, DOCX, TXT, MD
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Parses a file and returns its text content.
 *
 * @param {string} filePath  - Absolute path to the uploaded file
 * @param {string} mimeType  - MIME type of the file
 * @returns {Promise<string>}
 */
async function parseDocument(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    ext === '.docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (['.txt', '.md', '.text'].includes(ext)) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

module.exports = { parseDocument };
