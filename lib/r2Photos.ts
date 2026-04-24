import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface PhotoObject {
  data: Uint8Array;
  contentType: string;
}

function getR2Config(): R2Config {
  const accountId = Deno.env.get("R2_ACCOUNT_ID")?.trim() ?? "";
  const bucket = Deno.env.get("R2_BUCKET")?.trim() ?? "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim() ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim() ?? "";

  const missing: string[] = [];
  if (!accountId) missing.push("R2_ACCOUNT_ID");
  if (!bucket) missing.push("R2_BUCKET");
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    const runtime = Deno.env.get("DENO_DEPLOYMENT_ID") ? "deploy" : "local";
    throw new Error(
      `R2 is not configured. Missing/empty env vars: ${missing.join(", ")}. Runtime=${runtime}.`,
    );
  }

  return { accountId, bucket, accessKeyId, secretAccessKey };
}

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (client) return client;
  const cfg = getR2Config();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
  });
  return client;
}

function getBucketName(): string {
  return getR2Config().bucket;
}

async function bodyToBytes(body: unknown): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  if (body instanceof Blob) {
    return new Uint8Array(await body.arrayBuffer());
  }
  if (body && typeof body === "object" && "transformToByteArray" in body) {
    const streamLike = body as { transformToByteArray: () => Promise<Uint8Array> };
    return await streamLike.transformToByteArray();
  }

  const stream = body as ReadableStream<Uint8Array> | null;
  if (!stream) return new Uint8Array();
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

export interface ItemPhotoMeta {
  contentType: string;
  objectKey: string;
  byteLength: number;
}

export interface LegacyItemPhoto {
  data: Uint8Array;
  contentType: string;
}

export type StoredPhotoRecord = ItemPhotoMeta | LegacyItemPhoto;

export function isLegacyPhotoRecord(record: StoredPhotoRecord): record is LegacyItemPhoto {
  return "data" in record;
}

export function buildPhotoObjectKey(photoId: string): string {
  return `inventory/photos/${photoId}`;
}

export async function uploadPhotoObject(
  photoId: string,
  data: Uint8Array,
  contentType: string,
): Promise<ItemPhotoMeta> {
  const objectKey = buildPhotoObjectKey(photoId);
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      Body: data,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    contentType,
    objectKey,
    byteLength: data.byteLength,
  };
}

export async function getPhotoObject(objectKey: string): Promise<PhotoObject | null> {
  try {
    const result = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
      }),
    );

    if (!result.Body) return null;
    return {
      data: await bodyToBytes(result.Body),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "NoSuchKey") {
      return null;
    }
    throw error;
  }
}

export async function deletePhotoObject(objectKey: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
    }),
  );
}
