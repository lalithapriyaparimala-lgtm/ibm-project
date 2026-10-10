# 🍽️ Chef Granite — IBM Granite RAG Recipe Assistant

A web-based AI application that uses **Retrieval-Augmented Generation (RAG)** and the **IBM Granite Large Language Model** via IBM watsonx.ai to:

- Answer questions from uploaded recipe documents
- Generate personalised recipes from user preferences, ingredients, dietary requirements, and cooking constraints
- Adapt and modify recipes on the fly

---

## ✨ Features

| Feature | Details |
|---|---|
| 📚 Document ingestion | Upload PDF, DOCX, TXT, or Markdown recipe documents |
| 🔍 RAG retrieval | TF-IDF vector store with cosine similarity retrieval |
| 💬 Recipe Q&A | Ask anything about your uploaded recipes |
| ✨ Recipe generation | Create personalised recipes from ingredients + preferences |
| 🔄 Recipe modification | Adapt generated recipes with natural language |
| 📋 Copy / Print | One-click export of generated recipes |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                  Browser (SPA)                   │
│  ┌──────────┐  ┌───────────────────────────────┐ │
│  │ Sidebar  │  │  Tab: Q&A  |  Tab: Generator  │ │
│  │ Upload   │  │  Chat UI   |  Recipe Form      │ │
│  │ Doc list │  └───────────────────────────────┘ │
│  └──────────┘                                    │
└───────────────────┬──────────────────────────────┘
                    │ REST API
┌───────────────────▼──────────────────────────────┐
│              Express.js Server                   │
│  POST /api/documents/upload                      │
│  GET  /api/documents                             │
│  POST /api/chat                                  │
│  POST /api/recipes/generate                      │
│  POST /api/recipes/modify                        │
└───────┬──────────────────────┬────────────────────┘
        │                      │
┌───────▼──────────┐  ┌────────▼────────────────────┐
│   RAG Pipeline   │  │  IBM watsonx.ai             │
│                  │  │                             │
│  documentParser  │  │  POST /ml/v1/text/          │
│  chunker         │  │       generation            │
│  vectorStore     │  │                             │
│  (TF-IDF + cos.) │  │  Model: granite-3-8b-instruct│
└──────────────────┘  └─────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- An [IBM Cloud account](https://cloud.ibm.com)
- An [IBM watsonx.ai](https://dataplatform.cloud.ibm.com) project

### 2. Clone and install

```bash
git clone <repo>
cd recipe-rag-granite
npm install
```

### 3. Configure credentials

```bash
cp .env.example .env
```

Edit `.env`:

```env
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
GRANITE_MODEL_ID=ibm/granite-3-8b-instruct
```

#### Getting your credentials

| Credential | Where to find it |
|---|---|
| `WATSONX_API_KEY` | IBM Cloud → Manage → Access → API keys |
| `WATSONX_PROJECT_ID` | watsonx.ai → Your project → Manage → General → Project ID |
| `WATSONX_URL` | Based on your region, e.g. `https://us-south.ml.cloud.ibm.com` |

### 4. Run

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Open **http://localhost:3000**

---

## 📖 Usage

### Recipe Q&A (RAG)

1. Click **Browse files** or drag-and-drop your recipe PDFs/documents into the sidebar
2. Wait for ingestion (chunk count updates in the status bar)
3. Switch to the **Recipe Q&A** tab
4. Ask any question about your recipes — e.g.  
   *"What recipe uses chicken and lemon?"*  
   *"How do I make the pasta dough from my Italian cookbook?"*

### Recipe Generator

1. Switch to the **Recipe Generator** tab
2. Fill in:
   - Available ingredients
   - Meal type, cuisine style
   - Dietary restrictions (click tags to toggle)
   - Cooking time, servings, skill level
3. Click **✨ Generate Recipe**
4. Use the **Adapt** bar to modify the result (e.g. *"make it vegan"*, *"reduce cooking time"*)

---

## 📁 Project Structure

```
recipe-rag-granite/
├── server.js                 # Express entry point
├── package.json
├── .env.example
│
├── src/
│   ├── watsonxClient.js      # IBM watsonx.ai / IAM auth + text generation
│   ├── documentParser.js     # PDF / DOCX / TXT text extraction
│   ├── chunker.js            # Overlapping text chunking
│   ├── vectorStore.js        # In-memory TF-IDF vector store
│   └── promptBuilder.js      # Granite prompt templates
│
├── routes/
│   ├── documents.js          # Upload & manage recipe documents
│   ├── chat.js               # RAG Q&A endpoint
│   └── recipes.js            # Recipe generation & modification
│
└── public/
    ├── index.html            # SPA shell
    ├── styles.css            # Dark theme UI
    └── app.js                # Frontend logic
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `GRANITE_MODEL_ID` | `ibm/granite-3-8b-instruct` | Granite model to use |
| `CHUNK_SIZE` | `512` | Words per document chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `TOP_K_RESULTS` | `5` | Chunks retrieved per query |
| `MAX_TOKENS` | `1024` | Max tokens in LLM response |
| `TEMPERATURE` | `0.7` | Generation temperature |
| `PORT` | `3000` | HTTP server port |

---

## 🔒 Notes

- The vector store is **in-memory** — document knowledge resets on server restart.  
  For persistence, swap `vectorStore.js` for a persistent backend (e.g. Chroma, Milvus, pgvector).
- Files are deleted from disk immediately after text extraction — only vector chunks are retained.
- Credentials never leave the server — the API key is only used server-side for IAM token exchange.

---

## 📜 License

MIT
