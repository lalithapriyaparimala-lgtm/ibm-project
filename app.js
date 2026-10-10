/**
 * public/app.js
 * Frontend logic for the IBM Granite RAG Recipe Assistant.
 */

/* ─── State ──────────────────────────────────────────────── */
let currentRecipe = '';
let chatHistory   = [];

/* ─── DOM refs ───────────────────────────────────────────── */
const chatArea       = document.getElementById('chatArea');
const chatInput      = document.getElementById('chatInput');
const sendBtn        = document.getElementById('sendBtn');
const chatWelcome    = document.getElementById('chatWelcome');
const fileInput      = document.getElementById('fileInput');
const uploadZone     = document.getElementById('uploadZone');
const browseLink     = document.getElementById('browseLink');
const docList        = document.getElementById('docList');
const noDocs         = document.getElementById('noDocs');
const kbChunks       = document.getElementById('kbChunks');
const kbDocCount     = document.getElementById('kbDocCount');
const kbDot          = document.getElementById('kbDot');
const recipeContent  = document.getElementById('recipeContent');
const recipeActions  = document.getElementById('recipeActions');
const modifyBar      = document.getElementById('modifyBar');
const generateBtn    = document.getElementById('generateBtn');
const genSpinner     = document.getElementById('genSpinner');
const generateBtnTxt = document.getElementById('generateBtnText');
const uploadProgress = document.getElementById('uploadProgress');

/* ═══════════════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

/* ═══════════════════════════════════════════════════════════
   HEALTH CHECK — update model badge
═══════════════════════════════════════════════════════════ */
(async () => {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.model) {
      document.getElementById('modelBadge').textContent = `⬡ ${data.model}`;
    }
  } catch (_) {}
  loadDocuments();
})();

/* ═══════════════════════════════════════════════════════════
   FILE UPLOAD
═══════════════════════════════════════════════════════════ */
browseLink.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
});

async function uploadFiles(files) {
  if (!files || files.length === 0) return;

  uploadProgress.classList.add('active');

  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('files', f));

  try {
    const res = await fetch('/api/documents/upload', { method: 'POST', body: fd });
    const data = await res.json();

    if (data.processed && data.processed.length > 0) {
      data.processed.forEach((f) => {
        toast(`✅ "${f.filename}" — ${f.chunks} chunks ingested`, 'success');
      });
    }
    if (data.errors && data.errors.length > 0) {
      data.errors.forEach((e) => toast(`❌ ${e.filename}: ${e.error}`, 'error'));
    }
    await loadDocuments();
  } catch (err) {
    toast('Upload failed. Is the server running?', 'error');
  } finally {
    uploadProgress.classList.remove('active');
    fileInput.value = '';
  }
}

/* ─── Load / render document list ──────────────────────── */
async function loadDocuments() {
  try {
    const res = await fetch('/api/documents');
    const data = await res.json();
    renderDocuments(data.documents, data.totalChunks);
  } catch (_) {}
}

function renderDocuments(docs, totalChunks) {
  const existing = docList.querySelectorAll('.doc-item');
  existing.forEach((el) => el.remove());

  if (!docs || docs.length === 0) {
    noDocs.style.display = '';
    kbDot.classList.add('empty');
    kbChunks.textContent = '0 chunks';
    kbDocCount.textContent = '0 documents';
    return;
  }

  noDocs.style.display = 'none';
  kbDot.classList.remove('empty');
  kbChunks.textContent = `${totalChunks} chunks`;
  kbDocCount.textContent = `${docs.length} document${docs.length !== 1 ? 's' : ''}`;

  docs.forEach((doc) => {
    const ext = doc.filename.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', docx: '📝', txt: '📃', md: '📋' };
    const icon = icons[ext] || '📄';

    const item = document.createElement('div');
    item.className = 'doc-item';
    item.innerHTML = `
      <span class="doc-icon">${icon}</span>
      <div class="doc-info">
        <div class="doc-name" title="${doc.filename}">${doc.filename}</div>
        <div class="doc-meta">${doc.chunkCount} chunks · ${timeAgo(doc.uploadedAt)}</div>
      </div>
      <button class="doc-remove" title="Remove from knowledge base" onclick="removeDoc('${encodeURIComponent(doc.filename)}')">✕</button>
    `;
    docList.appendChild(item);
  });
}

async function removeDoc(encodedName) {
  const filename = decodeURIComponent(encodedName);
  try {
    await fetch(`/api/documents/${encodedName}`, { method: 'DELETE' });
    toast(`Removed "${filename}" from knowledge base`, 'info');
    await loadDocuments();
  } catch (_) {
    toast('Failed to remove document', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════
   CHAT
═══════════════════════════════════════════════════════════ */
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const question = chatInput.value.trim();
  if (!question) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Hide welcome screen on first message
  if (chatWelcome) chatWelcome.style.display = 'none';

  appendMessage('user', question);
  const typingEl = appendTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    typingEl.remove();

    if (data.error) {
      appendMessage('assistant', `⚠️ ${data.error}`);
    } else {
      appendMessage('assistant', data.answer, data.sources);
      chatHistory.push({ question, answer: data.answer });
    }
  } catch (err) {
    typingEl.remove();
    appendMessage('assistant', '⚠️ Could not reach the server. Make sure the backend is running.');
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

function appendMessage(role, text, sources = []) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = renderMarkdown(text);

  if (sources && sources.length > 0) {
    const srcDiv = document.createElement('div');
    srcDiv.className = 'msg-sources';
    srcDiv.innerHTML = '<strong>Sources: </strong>' +
      sources.map((s) => `<span class="source-chip" title="relevance: ${s.score}">📄 ${s.filename}</span>`).join('');
    bubble.appendChild(srcDiv);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatArea.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'message assistant';
  wrap.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatArea.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
  return wrap;
}

function fillQuestion(el) {
  chatInput.value = el.textContent;
  chatInput.focus();
}

/* ═══════════════════════════════════════════════════════════
   RECIPE GENERATOR
═══════════════════════════════════════════════════════════ */

// Diet tag toggles
document.querySelectorAll('.diet-tag').forEach((tag) => {
  tag.addEventListener('click', () => tag.classList.toggle('active'));
});

function getActiveDiets() {
  return Array.from(document.querySelectorAll('.diet-tag.active'))
    .map((t) => t.dataset.value)
    .join(', ');
}

generateBtn.addEventListener('click', generateRecipe);

async function generateRecipe() {
  const ingredients   = document.getElementById('ingredients').value.trim();
  const mealType      = document.getElementById('mealType').value;
  const cuisine       = document.getElementById('cuisine').value;
  const cookingTime   = document.getElementById('cookingTime').value;
  const servings      = document.getElementById('servings').value;
  const skillLevel    = document.getElementById('skillLevel').value;
  const additionalNotes = document.getElementById('additionalNotes').value.trim();
  const dietary       = getActiveDiets();

  setGenerating(true);
  recipeContent.innerHTML = `
    <div class="recipe-placeholder">
      <div class="ph-icon">⏳</div>
      <p>Chef Granite is crafting your recipe…</p>
    </div>`;
  recipeActions.style.display = 'none';
  modifyBar.classList.remove('visible');

  try {
    const res = await fetch('/api/recipes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, mealType, cuisine, dietary, cookingTime, servings, skillLevel, additionalNotes }),
    });
    const data = await res.json();

    if (data.error) {
      recipeContent.innerHTML = `<div class="recipe-placeholder"><div class="ph-icon">⚠️</div><p>${data.error}</p></div>`;
    } else {
      currentRecipe = data.recipe;
      recipeContent.innerHTML = renderMarkdown(data.recipe);
      recipeActions.style.display = '';
      modifyBar.classList.add('visible');

      if (data.inspirationSources && data.inspirationSources.length > 0) {
        const note = document.createElement('p');
        note.style.cssText = 'font-size:11px;color:var(--text-dim);margin-top:16px;padding-top:12px;border-top:1px solid var(--border)';
        note.textContent = `✦ Inspired by: ${data.inspirationSources.join(', ')}`;
        recipeContent.appendChild(note);
      }
    }
  } catch (err) {
    recipeContent.innerHTML = `<div class="recipe-placeholder"><div class="ph-icon">⚠️</div><p>Could not reach the server.</p></div>`;
  } finally {
    setGenerating(false);
  }
}

async function modifyRecipe() {
  const modification = document.getElementById('modifyInput').value.trim();
  if (!modification || !currentRecipe) return;

  setGenerating(true);

  try {
    const res = await fetch('/api/recipes/modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalRecipe: currentRecipe, modification }),
    });
    const data = await res.json();
    if (!data.error) {
      currentRecipe = data.recipe;
      recipeContent.innerHTML = renderMarkdown(data.recipe);
      document.getElementById('modifyInput').value = '';
      toast('Recipe adapted!', 'success');
    }
  } catch (_) {
    toast('Modification failed', 'error');
  } finally {
    setGenerating(false);
  }
}

function setGenerating(on) {
  generateBtn.disabled = on;
  genSpinner.classList.toggle('active', on);
  generateBtnTxt.textContent = on ? 'Generating…' : '✨ Generate Recipe';
}

function copyRecipe() {
  const text = recipeContent.innerText;
  navigator.clipboard.writeText(text).then(() => toast('Recipe copied to clipboard!', 'success'));
}

function printRecipe() {
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Recipe</title>
    <style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.7}
    h1,h2{color:#333}h3{color:#555}ul,ol{padding-left:20px}
    </style></head><body>${recipeContent.innerHTML}</body></html>`);
  win.document.close();
  win.print();
}

function sendToChat() {
  if (!currentRecipe) return;
  document.querySelector('[data-tab="chat"]').click();
  chatInput.value = `I just generated this recipe. Can you suggest wine pairings for it?\n\n${currentRecipe.slice(0, 300)}…`;
  chatInput.dispatchEvent(new Event('input'));
  chatInput.focus();
}

/* ═══════════════════════════════════════════════════════════
   MARKDOWN RENDERER
═══════════════════════════════════════════════════════════ */
function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text);
  }
  // Fallback — basic line breaks
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\n/g, '<br>');
}

/* ═══════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
═══════════════════════════════════════════════════════════ */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ═══════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════ */
function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
