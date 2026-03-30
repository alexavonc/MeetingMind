export type Language = "en" | "zh" | "sg" | "ms";

export interface Utterance {
  s: string; // speaker key e.g. "A"
  t: string; // timestamp e.g. "0:12"
  text: string; // may contain [zh|...|...][/zh] and [sg]...[/sg] markup
}

export interface Action {
  text: string;
  owner: string;
  done: boolean;
}

export type Folder = "govtech" | "flow-three" | "personal";

export interface Meeting {
  id: string;
  title: string;
  folder: Folder;
  date: string;       // e.g. "20 Mar 2026"
  duration: string;   // e.g. "47 min"
  languages: Language[];
  speakers: Record<string, string>; // { A: "Name", B: "Name" }
  transcript: Utterance[];
  summary: string;
  actions: Action[];
  flow: string;
  audiourl?: string;   // Supabase Storage public URL (column name lowercase to match Supabase convention)
  sharetoken?: string; // random UUID used to build public share links
}

export type TranscriptionProvider = "openai" | "groq" | "huggingface";

export interface Settings {
  claudeKey: string;
  whisperKey: string; // Groq or OpenAI key (also used as Groq fallback when HF is primary)
  transcriptionProvider: TranscriptionProvider;
  ingestSecret: string; // token for the /api/ingest Watch → webhook endpoint
  hfToken: string;      // HuggingFace API token
  hfEndpointUrl: string; // HF Inference Endpoint URL (blank = use serverless API)
}

export type ProcessingStep =
  | "transcribing"
  | "diarising"
  | "summarising"
  | "flowcharting"
  | "saving"
  | "done"
  | "error";

export interface ProcessingState {
  active: boolean;
  step: ProcessingStep | null;
  error: string | null;
  detail?: string; // e.g. "Part 2 of 3"
}

// Parsed token types for markup rendering
export type Token =
  | { type: "text"; value: string }
  | { type: "zh"; english: string; chinese: string }
  | { type: "sg"; value: string }
  | { type: "ms"; english: string };
