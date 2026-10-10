/**
 * chunker.js
 * Splits a document's raw text into overlapping chunks for RAG ingestion.
 */

/**
 * Splits text into chunks of roughly `chunkSize` words with `overlap` word overlap.
 *
 * @param {string} text
 * @param {number} chunkSize   - target words per chunk
 * @param {number} overlap     - words to repeat between adjacent chunks
 * @returns {string[]}
 */
function chunkText(text, chunkSize = 512, overlap = 50) {
  // Normalise whitespace
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Split on double-newlines first to respect recipe/section boundaries
  const sections = cleaned.split(/\n\n+/);
  const words = [];

  for (const section of sections) {
    const sectionWords = section.split(/\s+/).filter(Boolean);
    // Insert a paragraph marker so chunks don't silently merge sections
    words.push(...sectionWords, '¶');
  }

  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const end = Math.min(i + chunkSize, words.length);
    const chunk = words
      .slice(i, end)
      .join(' ')
      .replace(/ ¶/g, '\n\n')   // restore paragraph breaks
      .replace(/¶ /g, '\n\n')
      .replace(/¶/g, '')
      .trim();

    if (chunk.length > 0) chunks.push(chunk);
    i += chunkSize - overlap;
    if (i >= words.length) break;
  }

  return chunks;
}

module.exports = { chunkText };
