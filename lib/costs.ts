import type { Meeting } from "@/types";
import type { TranscriptionProvider } from "@/types";

// ── Pricing ───────────────────────────────────────────────────────────────────

const CLAUDE_INPUT_PER_TOKEN  = 3    / 1_000_000; // claude-sonnet-4 $3/M input
const CLAUDE_OUTPUT_PER_TOKEN = 15   / 1_000_000; // claude-sonnet-4 $15/M output

const WHISPER_RATES: Record<TranscriptionProvider, number> = {
  groq:         0.111  / 60,  // $0.111/hr → per minute
  openai:       0.006,        // $0.006/min
  huggingface:  0.008  / 60,  // ~$0.008/hr compute (L4 endpoint estimate)
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Rough token count: ~4 chars per token */
function tok(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Parse "47 min", "1 hr 20 min", "2 hr" → minutes */
export function parseDurationMinutes(duration: string): number {
  const h = duration.match(/(\d+)\s*hr/);
  const m = duration.match(/(\d+)\s*min/);
  return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
}

function usd(n: number): string {
  if (n < 0.001) return "<$0.001";
  return `$${n.toFixed(4)}`;
}

export function formatUSD(n: number): string {
  return usd(n);
}

// ── Cost model ────────────────────────────────────────────────────────────────

export interface CallCost {
  label: string;
  detail: string;
  inputTokens?: number;
  outputTokens?: number;
  cost: number;
}

export interface MeetingCostBreakdown {
  transcription: CallCost;
  diarise: CallCost;
  summarise: CallCost;
  flowchart: CallCost;
  total: number;
}

/**
 * Estimate the API cost for a processed meeting.
 * Uses token counts derived from the stored text fields.
 */
export function estimateMeetingCost(
  meeting: Meeting,
  provider: TranscriptionProvider
): MeetingCostBreakdown {
  const minutes = parseDurationMinutes(meeting.duration);

  // ── Transcription ──────────────────────────────────────────────────────────
  const txRate = WHISPER_RATES[provider];
  const txCost = minutes * txRate;
  const txDetail =
    provider === "groq"         ? `Groq whisper-large-v3 · ${minutes} min`
    : provider === "openai"     ? `OpenAI whisper-1 · ${minutes} min`
    :                             `HF turbo-singlish · ${minutes} min`;

  // ── Diarise ────────────────────────────────────────────────────────────────
  // Input: system prompt (~600 tok) + raw transcript (≈ 1.2× diarised output)
  const transcriptText = meeting.transcript.map((u) => `${u.s}: ${u.text}`).join("\n");
  const transcriptTok  = tok(transcriptText);
  const diariseIn      = 600 + Math.round(transcriptTok * 1.2);
  const diariseOut     = transcriptTok;
  const diariseCost    = diariseIn * CLAUDE_INPUT_PER_TOKEN + diariseOut * CLAUDE_OUTPUT_PER_TOKEN;

  // ── Summarise ──────────────────────────────────────────────────────────────
  const summaryText  = meeting.summary + " " + meeting.actions.map((a) => a.text).join(" ");
  const summaryTok   = tok(summaryText);
  const summariseIn  = 400 + transcriptTok;
  const summariseOut = summaryTok;
  const summariseCost = summariseIn * CLAUDE_INPUT_PER_TOKEN + summariseOut * CLAUDE_OUTPUT_PER_TOKEN;

  // ── Flowchart ──────────────────────────────────────────────────────────────
  const flowTok   = tok(meeting.flow ?? "");
  const flowIn    = 500 + summaryTok + transcriptTok;
  const flowOut   = flowTok;
  const flowCost  = flowIn * CLAUDE_INPUT_PER_TOKEN + flowOut * CLAUDE_OUTPUT_PER_TOKEN;

  const total = txCost + diariseCost + summariseCost + flowCost;

  return {
    transcription: { label: "Transcription", detail: txDetail, cost: txCost },
    diarise: {
      label: "Diarise speakers",
      detail: `claude-sonnet-4 · ${diariseIn.toLocaleString()} in / ${diariseOut.toLocaleString()} out tok`,
      inputTokens: diariseIn, outputTokens: diariseOut, cost: diariseCost,
    },
    summarise: {
      label: "Summary & actions",
      detail: `claude-sonnet-4 · ${summariseIn.toLocaleString()} in / ${summariseOut.toLocaleString()} out tok`,
      inputTokens: summariseIn, outputTokens: summariseOut, cost: summariseCost,
    },
    flowchart: {
      label: "Flowchart",
      detail: `claude-sonnet-4 · ${flowIn.toLocaleString()} in / ${flowOut.toLocaleString()} out tok`,
      inputTokens: flowIn, outputTokens: flowOut, cost: flowCost,
    },
    total,
  };
}

/**
 * Sum costs across all meetings.
 */
export function estimateTotalCost(
  meetings: Meeting[],
  provider: TranscriptionProvider
): number {
  return meetings.reduce((sum, m) => sum + estimateMeetingCost(m, provider).total, 0);
}
