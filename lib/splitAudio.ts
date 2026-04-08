/**
 * Client-side audio splitting for files that exceed the Groq 25 MB limit.
 *
 * Strategy:
 *   1. Decode the audio using Web Audio API (decodeAudioData)
 *   2. Resample + mix-down to 16 kHz mono via OfflineAudioContext
 *      (16 kHz is Whisper's native rate — no quality loss for speech)
 *   3. Slice the PCM samples into chunks, each encoding to < 24 MB WAV
 *   4. Return each chunk as a File object
 */

const TARGET_RATE = 16_000; // Hz — Whisper's native rate
const BYTES_PER_SAMPLE = 2; // 16-bit PCM
const WAV_HEADER_BYTES = 44;
const MAX_CHUNK_BYTES = 24 * 1024 * 1024; // 24 MB safety margin under Groq's 25 MB limit
const MAX_SAMPLES_PER_CHUNK = Math.floor(
  (MAX_CHUNK_BYTES - WAV_HEADER_BYTES) / BYTES_PER_SAMPLE
); // ≈ 12.58 M samples ≈ 13.1 min at 16 kHz

/** Encode a Float32 mono PCM array as a 16-bit PCM WAV file. */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const len = samples.length;
  const buf = new ArrayBuffer(WAV_HEADER_BYTES + len * BYTES_PER_SAMPLE);
  const v = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  str(0, "RIFF");
  v.setUint32(4, 36 + len * BYTES_PER_SAMPLE, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);       // PCM sub-chunk size
  v.setUint16(20, 1, true);        // PCM format
  v.setUint16(22, 1, true);        // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true); // byte rate
  v.setUint16(32, BYTES_PER_SAMPLE, true);              // block align
  v.setUint16(34, 16, true);       // bits per sample
  str(36, "data");
  v.setUint32(40, len * BYTES_PER_SAMPLE, true);

  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(WAV_HEADER_BYTES + i * BYTES_PER_SAMPLE, s < 0 ? s * 32768 : s * 32767, true);
  }
  return buf;
}

/**
 * Split a large audio file into multiple WAV chunks, each under 24 MB.
 *
 * @param file      The audio file to split (any format the browser can decode)
 * @param onProgress  Optional callback for status messages shown in the UI
 * @returns         Array of WAV File objects ready for the Groq API
 */
export async function splitAudioFile(
  file: File,
  onProgress?: (detail: string) => void
): Promise<File[]> {
  onProgress?.("Decoding audio…");

  const arrayBuffer = await file.arrayBuffer();

  // Decode at the file's native rate
  const tmpCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  } finally {
    await tmpCtx.close();
  }

  // Resample to TARGET_RATE mono using OfflineAudioContext
  onProgress?.("Resampling to 16 kHz…");
  const targetFrames = Math.ceil(decoded.duration * TARGET_RATE);
  const offCtx = new OfflineAudioContext(1, targetFrames, TARGET_RATE);
  const src = offCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  const samples = rendered.getChannelData(0);

  // Slice into chunks
  const numChunks = Math.ceil(samples.length / MAX_SAMPLES_PER_CHUNK);
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const chunks: File[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * MAX_SAMPLES_PER_CHUNK;
    const end = Math.min(start + MAX_SAMPLES_PER_CHUNK, samples.length);
    const slice = samples.slice(start, end);

    if (numChunks > 1) {
      onProgress?.(`Encoding part ${i + 1} of ${numChunks}…`);
    }

    const wav = encodeWav(slice, TARGET_RATE);
    const name = numChunks > 1 ? `${baseName}_part${i + 1}.wav` : `${baseName}.wav`;
    chunks.push(new File([wav], name, { type: "audio/wav" }));
  }

  return chunks;
}
