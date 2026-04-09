import { NextRequest, NextResponse } from "next/server";

interface ImageInput {
  base64: string;   // full data URL, e.g. "data:image/jpeg;base64,..."
  timestamp: number; // seconds, for the frame label
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, images, prompt, maxTokens = 1500 } = (await req.json()) as {
      apiKey: string;
      images: ImageInput[];
      prompt: string;
      maxTokens?: number;
    };

    if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    if (!images?.length) return NextResponse.json({ text: "" });

    // Build a multimodal content array: timestamp label + image for each frame
    const content: unknown[] = [];
    for (const img of images) {
      const [header, data] = img.base64.split(",");
      const mediaType = (header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg") as
        "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const minutes = Math.floor(img.timestamp / 60);
      const seconds = Math.floor(img.timestamp % 60);

      content.push({
        type: "text",
        text: `Frame at ${minutes}:${String(seconds).padStart(2, "0")}:`,
      });
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
    }
    content.push({ type: "text", text: prompt });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: body }, { status: res.status });
    }

    const data = (await res.json()) as { content: { type: string; text: string }[] };
    const text = data.content.find((c) => c.type === "text")?.text ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
