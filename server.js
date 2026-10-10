/**
 * server.js
 * Main Express application for the IBM Granite RAG Recipe Assistant.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const documentsRouter = require('./routes/documents');
const chatRouter = require('./routes/chat');
const recipesRouter = require('./routes/recipes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve the frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/recipes', recipesRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'IBM Granite RAG Recipe Assistant',
    model: process.env.GRANITE_MODEL_ID || 'ibm/granite-3-8b-instruct',
    timestamp: new Date().toISOString(),
  });
});

// ─── Catch-all → SPA ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🍽️  IBM Granite RAG Recipe Assistant`);
  console.log(`   Running at http://localhost:${PORT}`);
  console.log(`   Model: ${process.env.GRANITE_MODEL_ID || 'ibm/granite-3-8b-instruct'}`);
  console.log(`   Upload recipe docs, then ask questions or generate new recipes!\n`);
});

module.exports = app;
