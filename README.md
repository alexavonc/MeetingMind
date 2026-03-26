# MeetingMind

> Apple Watch → Groq Whisper → Claude API meeting transcript dashboard

Record meetings on Apple Watch with built-in Voice Memos → iOS Shortcut sends audio to Groq Whisper large-v3 → Claude diarises, summarises, and generates flowcharts.

## Stack

- **Next.js 16 (App Router)** + TypeScript
- **Tailwind CSS v4** — dark mode only
- **Fonts**: Bricolage Grotesque (UI) + JetBrains Mono (code/timestamps)
- **Mermaid.js** — flowchart rendering
- **Groq Whisper large-v3** — audio transcription (~3× cheaper than OpenAI)
- **Anthropic Claude API** (`claude-sonnet-4-20250514`) — diarisation, summaries, flowcharts
- **localStorage** — persistence (Supabase upgrade path planned)

## Dev setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app loads with 3 seed meetings so you can explore without API keys.

## API keys

Go to **Settings** (bottom of sidebar) and enter:
- **Anthropic Claude key** — `sk-ant-...`
- **Groq API key** — `gsk_...` (get one free at console.groq.com)

Keys are stored in `localStorage`. Never share the device's localStorage with others.

## Apple Watch workflow

1. Record meeting on Apple Watch with **Voice Memos** (built-in, free)
2. Audio auto-syncs to iPhone
3. iOS Shortcut sends the m4a to `/api/ingest` → Groq transcribes → Claude processes
4. Meeting appears in your dashboard

**Railway env vars needed:**
```
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
MEETINGMIND_INGEST_SECRET=your-generated-secret
```

## Features

- **Folder organisation**: Govtech / flow-three / Personal
- **Language badges**: EN / ZH (Mandarin) / SG (Singlish)
- **Transcript view**: Speaker-separated utterances with timestamps
  - Amber underlined = Mandarin phrase → tap for Chinese tooltip
  - Pink text = Singlish slang `[sg]lah[/sg]`
- **Summary view**: AI summary + action items with checkboxes + participants
- **Flowchart view**: Mermaid.js diagram, regeneratable via Claude
- **Upload modal**: Drop audio file OR paste raw transcript text
- **Record button**: In-browser microphone recording (no local file saved)
- **Processing pipeline**: Groq Whisper → Claude diarise → Summarise → Flowchart → Save
- **Mobile responsive**: Hamburger menu, FAB buttons

## Estimated running costs

| Item | Cost |
|------|------|
| Groq Whisper large-v3 | ~$0.111/hr audio (~$0.06 for 30 min) |
| Claude API (diarise + summary + flow) | ~$0.02–0.05 |
| **Per meeting** | **~$0.08–0.11** |
| 10–15 meetings/month | ~$1–2/month |

## Deploy

```bash
# Railway
railway up
```

## Roadmap

- [ ] Supabase backend (meetings table + auth)
- [ ] Voice Memos iOS Shortcut auto-sync guide
- [ ] Export: copy as Markdown, PDF summary
- [ ] Search across all meetings
- [ ] Move API keys server-side before sharing with others
