import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? "";
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "";

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? "meetingmind";
export const R2_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export function getR2Client(): S3Client | null {
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;
  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  } catch {
    return null;
  }
}
