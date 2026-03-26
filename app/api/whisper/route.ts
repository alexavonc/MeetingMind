import { NextRequest, NextResponse } from "next/server";

const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: "whisper-large-v3",
  },
  openai: {
    url: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
  },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const apiKey = formData.get("apiKey") as string;
    const file = formData.get("file") as File;
    const provider = (formData.get("provider") as string) || "groq";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const { url, model } = PROVIDERS[provider as keyof typeof PROVIDERS] ?? PROVIDERS.groq;

    const outForm = new FormData();
    outForm.append("file", file);
    outForm.append("model", model);
    outForm.append("response_format", "text");
    outForm.append("prompt", "Singapore English meeting. Code-switching between English, Singlish, and Mandarin Chinese. Common Singlish: lah, lor, meh, can, cannot, sia, walao, alamak, shiok, confirm, already.");

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: outForm,
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: body }, { status: res.status });
    }

    const text = await res.text();
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
