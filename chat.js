/**
 * routes/chat.js
 * RAG-powered Q&A endpoint — answers questions about uploaded recipe documents.
 */

const express = require('express');
const { retrieve } = require('../src/vectorStore');
const { buildRAGPrompt } = require('../src/promptBuilder');
const { generateText } = require('../src/watsonxClient');

const router = express.Router();

// ─── POST /api/chat ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'A non-empty question is required.' });
  }

  const topK = parseInt(process.env.TOP_K_RESULTS) || 5;
  const contextChunks = retrieve(question.trim(), topK);

  const prompt = buildRAGPrompt(question.trim(), contextChunks);

  try {
    const answer = await generateText(prompt);

    res.json({
      question: question.trim(),
      answer,
      sources: contextChunks.map((c) => ({
        filename: c.metadata.filename,
        score: Math.round(c.score * 1000) / 1000,
        excerpt: c.text.slice(0, 200) + (c.text.length > 200 ? '…' : ''),
      })),
      contextUsed: contextChunks.length,
    });
  } catch (err) {
    console.error('[chat] LLM error:', err.message);
    res.status(502).json({ error: 'Failed to generate a response. Check your watsonx.ai credentials.' });
  }
});

module.exports = router;
