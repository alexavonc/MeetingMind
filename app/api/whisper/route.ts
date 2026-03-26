import { NextRequest, NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const HF_SINGLISH_URL = "https://api-inference.huggingface.co/models/mjwong/whisper-large-v3-turbo-singlish";
const SG_PROMPT = "Singapore English meeting. Code-switching between English, Singlish, and Mandarin Chinese. Common Singlish: lah, lor, meh, can, cannot, sia, walao, alamak, shiok, confirm, already.";

async function transcribeOpenAICompat(url: string, apiKey: string, file: File, model: string, forceEnglish = false): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("model", model);
  form.append("response_format", "text");
  form.append("prompt", SG_PROMPT);
  if (forceEnglish) form.append("language", "en");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.text();
}

async function transcribeHF(endpointUrl: string, hfToken: string, file: File): Promise<string> {
  // HF Inference API / Endpoints expect raw audio bytes, not multipart
  const audioBuffer = await file.arrayBuffer();
  const contentType = file.type || "audio/webm";

  const res = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": contentType,
    },
    body: audioBuffer,
  });
  if (!res.ok) throw new Error(`HF ${res.status}: ${await res.text()}`);

  const data = await res.json() as { text?: string } | Array<{ generated_text?: string }>;
  if (Array.isArray(data)) return data[0]?.generated_text ?? "";
  return data.text ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const apiKey = formData.get("apiKey") as string;
    const file = formData.get("file") as File;
    const provider = (formData.get("provider") as string) || "groq";
    const hfToken = (formData.get("hfToken") as string) || "";
    const hfEndpointUrl = (formData.get("hfEndpointUrl") as string) || HF_SINGLISH_URL;

    if (!file) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    let text = "";

    if (provider === "huggingface") {
      if (!hfToken) {
        return NextResponse.json({ error: "Missing HuggingFace token" }, { status: 400 });
      }

      try {
        text = await transcribeHF(hfEndpointUrl, hfToken, file);
      } catch (hfErr) {
        // HF failed — fall back to Groq if a key is available
        if (apiKey) {
          try {
            text = await transcribeOpenAICompat(GROQ_URL, apiKey, file, "whisper-large-v3", true);
          } catch {
            throw hfErr; // both failed, surface the HF error
          }
        } else {
          throw hfErr;
        }
      }
    } else if (provider === "openai") {
      if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });
      text = await transcribeOpenAICompat(OPENAI_URL, apiKey, file, "whisper-1");
    } else {
      // groq (default)
      if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });
      text = await transcribeOpenAICompat(GROQ_URL, apiKey, file, "whisper-large-v3", true);
    }

    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
