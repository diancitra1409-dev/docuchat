# DocuChat — Smart Document Q&A

Chat with PDFs and long notes powered by **Google Gemini (`gemini-3.8-flash`)** using a monorepo architecture (**React + Vite + Tailwind CSS** frontend and **Node.js + Express** backend, pre-configured for **Vercel** serverless deployment).

## Features

- **PDF Upload & Paste Notes**: Upload PDF files up to **5 MB** (parsed strictly in memory with `multer.memoryStorage()` and `pdf-parse` — zero disk writes) or paste long text/notes directly.
- **Auto Summary & Starter Questions**: Automatically generates a **3-bullet summary** and **3 clickable suggested questions** using Gemini structured JSON output.
- **Strict Grounded Q&A Chat**: Multi-turn chat interface with a strict system prompt instructing Gemini to answer **only** from the loaded document, cite sections/quotes, and politely state when an answer is not in the document.
- **1-Click Sample Document**: Includes a **Load Sample Document** button (`Apex Cloud Systems — Remote Work & Employee SOP`) so anyone can test immediately without uploading a file.
- **Vercel-Ready Serverless Setup**: Exports the Express app via `api/index.js` for `/api/*` routes with `vercel.json` rewrites and relative `/api/...` frontend calls.

## Project Structure

```text
docuchat/
├── api/
│   └── index.js                # Vercel serverless entrypoint exporting the Express app
├── client/                     # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── api/docuchatApi.js
│   │   ├── components/
│   │   └── data/sampleDocument.js
│   └── vite.config.js
├── server/                     # Node.js + Express + @google/genai backend
│   └── src/
│       ├── app.js              # Exported Express app
│       ├── index.js            # Local dev server
│       ├── routes/
│       ├── services/
│       └── middleware/
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

## Local Development

1. **Install dependencies** (from the repository root):
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` in `.env` with an API key from [Google AI Studio](https://aistudio.google.com/apikey).

3. **Run both client and server**:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173` (proxies `/api/*` to `http://localhost:3001`)
   - Backend API: `http://localhost:3001`

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket and import it into Vercel.
2. Add `GEMINI_API_KEY` in **Project Settings → Environment Variables**.
3. Deploy — `vercel.json` builds `client/dist` and routes all `/api/*` requests to `api/index.js`.
