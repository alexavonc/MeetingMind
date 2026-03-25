/**
 * Transcribes an audio file using OpenAI Whisper API via a server-side route
 * to keep the API key off the client.
 */
export async function transcribeAudio(
  apiKey: string,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("apiKey", apiKey);

  const res = await fetch("/api/whisper", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API error: ${err}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text;
}
