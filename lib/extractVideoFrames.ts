/**
 * Extract unique keyframes from a video file for visual context analysis.
 *
 * Strategy:
 *   1. Create a hidden <video> element from the file
 *   2. Seek to evenly-spaced timestamps
 *   3. Draw each frame to a canvas and compute pixel diff vs the previous kept frame
 *   4. Only keep frames that changed enough (new content on screen)
 *   5. Return at most MAX_FRAMES base64 JPEGs with timestamps
 */

export interface VideoFrame {
  dataUrl: string;    // base64 JPEG, 640-wide
  timestamp: number;  // seconds from start
}

const SAMPLE_INTERVAL = 15;  // sample one frame every N seconds
const DIFF_THRESHOLD = 0.04; // 4% of pixels changed = new unique frame
const MAX_FRAMES = 10;       // cap to keep Claude Vision cost reasonable
const OUTPUT_WIDTH = 640;

export async function extractKeyframes(
  file: File,
  onProgress?: (detail: string) => void
): Promise<VideoFrame[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(url);
        resolve([]); // can't extract from live/streaming source
        return;
      }

      const W = OUTPUT_WIDTH;
      const H = video.videoHeight > 0
        ? Math.round(W * (video.videoHeight / video.videoWidth))
        : Math.round(W * 0.5625); // default 16:9

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Build timestamp list
      const timestamps: number[] = [];
      for (let t = 0; t <= duration; t += SAMPLE_INTERVAL) {
        timestamps.push(Math.min(t, duration - 0.1));
      }
      if (timestamps.length === 0) timestamps.push(0);

      const frames: VideoFrame[] = [];
      let lastPixels: Uint8ClampedArray | null = null;

      for (let i = 0; i < timestamps.length; i++) {
        if (frames.length >= MAX_FRAMES) break;
        onProgress?.(`Scanning frame ${i + 1} of ${timestamps.length}…`);

        try {
          await seekTo(video, timestamps[i]);
          ctx.drawImage(video, 0, 0, W, H);
          const imageData = ctx.getImageData(0, 0, W, H);

          if (!lastPixels || pixelDiff(imageData.data, lastPixels, W * H) > DIFF_THRESHOLD) {
            frames.push({
              dataUrl: canvas.toDataURL("image/jpeg", 0.75),
              timestamp: timestamps[i],
            });
            lastPixels = new Uint8ClampedArray(imageData.data); // copy
          }
        } catch {
          // Single frame failure — skip and continue
        }
      }

      URL.revokeObjectURL(url);
      resolve(frames);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video for frame extraction"));
    };
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Seek timeout")), 5000);
    const onSeeked = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Seek error"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

/** Returns the fraction of pixels that changed significantly between two frames. */
function pixelDiff(a: Uint8ClampedArray, b: Uint8ClampedArray, totalPixels: number): number {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i]     - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    if (dr + dg + db > 40) changed++;
  }
  return changed / totalPixels;
}
