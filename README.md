# VideoAnalyzer

YouTube video analysis tool — paste a URL, get a timestamped AI summary, interactive mind map, chat interface, and AI-powered visual transcript.

## Stack

- **Next.js 14** + TypeScript
- **Prisma** + SQLite (local) / Turso (production)
- **OpenRouter** — Gemini 2.5 Flash for summary and chat
- **Google Generative AI** — Gemini 2.5 Flash for visual transcript
- **Supadata** — YouTube transcript proxy (bypasses Vercel IP restrictions)

## Features

### Summary Tab
AI-generated timestamped summary of the video transcript. Powered by Gemini 2.5 Flash via OpenRouter.

### Chat Tab
Streaming chat interface — ask questions about the video content. Context is the full transcript.

### Mind Map Tab
Interactive SVG mind map of the summary using markmap. Collapsible branches.

### Visual Tab
Gemini analyzes the actual video frames to produce a scene-by-scene visual breakdown — no captions required. Describes what is shown on screen, actions, on-screen text, and key visual moments. Output is structured with clickable timestamps that jump the video player to that moment.

**API:** `POST /api/visual-transcript` — accepts `{ videoId }`, calls Gemini with the YouTube URL as a `fileData` input, saves result to DB.

**Requires:** `GOOGLE_AI_API_KEY` in `.env`

## Getting Started

```bash
npm install
npx prisma migrate dev
npm run dev
```

App runs at http://localhost:3000.

## Environment Variables

```env
# Local DB
DATABASE_URL=file:./dev.db

# AI — summary and chat
OPENROUTER_API_KEY=

# AI — visual transcript
GOOGLE_AI_API_KEY=

# YouTube transcript proxy (needed on Vercel)
SUPADATA_API_KEY=

# Production DB (Vercel only)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

## Key Files

| File | Purpose |
|------|---------|
| `app/api/analyze/route.ts` | Transcript fetch + AI summary |
| `app/api/chat/route.ts` | Streaming chat |
| `app/api/visual-transcript/route.ts` | Gemini video frame analysis |
| `app/video/[id]/page.tsx` | 4-tab video page |
| `components/visual-transcript-display.tsx` | Visual tab UI |
| `components/summary-display.tsx` | Summary tab UI |
| `components/chat-interface.tsx` | Chat tab UI |
| `components/mind-map-display.tsx` | Mind map tab UI |
| `lib/db.ts` | Prisma client (SQLite or Turso) |
| `prisma/schema.prisma` | Video + ChatMessage models |

## Deployment

Deployed on Vercel. GitHub: `StarDrop9/videoanalyst`.

Vercel requires `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` instead of local SQLite. The `lib/db.ts` adapter switches automatically based on which env vars are present.
