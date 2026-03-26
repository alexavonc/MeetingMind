import type { TranscriptionProvider } from "@/types";

export async function transcribeAudio(
  apiKey: string,
  file: File,
  provider: TranscriptionProvider = "groq",
  hfToken = "",
  hfEndpointUrl = ""
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("apiKey", apiKey);
  formData.append("provider", provider);
  if (hfToken) formData.append("hfToken", hfToken);
  if (hfEndpointUrl) formData.append("hfEndpointUrl", hfEndpointUrl);

  const res = await fetch("/api/whisper", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transcription error: ${err}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text;
}
