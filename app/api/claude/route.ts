import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { apiKey, prompt, maxTokens = 2048, model = "claude-sonnet-4-20250514" } = (await req.json()) as {
      apiKey: string;
      prompt: string;
      maxTokens?: number;
      model?: string;
    };

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: body }, { status: res.status });
    }

    // Pipe text deltas from Anthropic's SSE stream straight to the browser.
    // This keeps the HTTP connection alive (Anthropic sends ping events every ~10 s)
    // and avoids idle-connection timeouts that kill non-streaming long requests.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        let buf = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? ""; // hold back any incomplete line

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data || data === "[DONE]") continue;

              try {
                const event = JSON.parse(data) as {
                  type: string;
                  delta?: { type: string; text: string };
                  error?: { message: string };
                };

                if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                  controller.enqueue(encoder.encode(event.delta.text));
                } else if (event.type === "error") {
                  // Signal the error as a sentinel so the client can surface it
                  controller.enqueue(encoder.encode(`\x00${event.error?.message ?? "Anthropic error"}`));
                  controller.close();
                  return;
                }
              } catch { /* skip malformed SSE lines */ }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
