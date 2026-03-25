# MeetingMind

> Apple Watch → Whisper API → Claude API meeting transcript dashboard

Record meetings on Apple Watch (Whisper Memos / Just Press Record) → audio transcribed via OpenAI Whisper → structured by Claude into transcripts, summaries, action items, and flowcharts.

## Stack

- **Next.js 16 (App Router)** + TypeScript
- **Tailwind CSS v4** — dark mode only
- **Fonts**: Bricolage Grotesque (UI) + JetBrains Mono (code/timestamps)
- **Mermaid.js** — flowchart rendering
- **OpenAI Whisper API** — audio transcription
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
- **OpenAI Whisper key** — `sk-...`

Keys are stored in `localStorage`. Never share the device's localStorage with others. A future upgrade will move keys server-side.

## Features

- **Folder organisation**: Govtech / flow-three / Personal
- **Language badges**: EN / ZH (Mandarin) / SG (Singlish)
- **Transcript view**: Speaker-separated utterances with timestamps
  - Amber underlined = Mandarin phrase → tap for Chinese tooltip
  - Pink text = Singlish slang `[sg]lah[/sg]`
- **Summary view**: AI summary + action items with checkboxes + participants
- **Flowchart view**: Mermaid.js diagram, regeneratable via Claude
- **Upload modal**: Drop audio file OR paste raw transcript text
- **Processing pipeline**: Whisper → Diarise → Summarise → Flowchart → Save
- **Mobile responsive**: Hamburger menu, FAB button

## Estimated running costs

| Item | Cost |
|------|------|
| Whisper API | ~$0.006/min (~$0.18 for 30 min) |
| Claude API (diarise + summary + flow) | ~$0.02–0.05 |
| **Per meeting** | **~$0.20–0.25** |
| 10–15 meetings/month | ~$3–4/month |

## Deploy

```bash
# Vercel (recommended)
vercel deploy

# Railway
railway up
```

## Roadmap

- [ ] Supabase backend (meetings table + auth)
- [ ] Whisper Memos webhook auto-sync from iPhone
- [ ] Export: copy as Markdown, PDF summary
- [ ] Search across all meetings
- [ ] Move API keys server-side before sharing with others
