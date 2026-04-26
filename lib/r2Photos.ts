import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
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

export interface R2ObjectSummary {
  key: string;
  lastModified: string | null;
  size: number;
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

/** Check if R2 is configured without throwing */
export function isR2Configured(): boolean {
  const accountId = Deno.env.get("R2_ACCOUNT_ID")?.trim() ?? "";
  const bucket = Deno.env.get("R2_BUCKET")?.trim() ?? "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim() ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim() ?? "";
  
  return !!(accountId && bucket && accessKeyId && secretAccessKey);
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
export const INVENTORY_PHOTO_PREFIX = "inventory/photos/";
export const FEEDBACK_PHOTO_PREFIX = "feedback/photos/";

export function isLegacyPhotoRecord(record: StoredPhotoRecord): record is LegacyItemPhoto {
  return "data" in record;
}

export function buildPhotoObjectKey(photoId: string): string {
  return `${INVENTORY_PHOTO_PREFIX}${photoId}`;
}

export function buildFeedbackPhotoObjectKey(photoId: string): string {
  return `${FEEDBACK_PHOTO_PREFIX}${photoId}`;
}

export function isInventoryPhotoObjectKey(objectKey: string): boolean {
  return objectKey.startsWith(INVENTORY_PHOTO_PREFIX) &&
    objectKey.length > INVENTORY_PHOTO_PREFIX.length;
}

export async function putR2Object(
  objectKey: string,
  data: Uint8Array,
  contentType: string,
  cacheControl?: string,
): Promise<{ objectKey: string; byteLength: number; contentType: string }> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      Body: data,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );

  return {
    objectKey,
    byteLength: data.byteLength,
    contentType,
  };
}

export async function uploadPhotoObject(
  photoId: string,
  data: Uint8Array,
  contentType: string,
): Promise<ItemPhotoMeta> {
  const objectKey = buildPhotoObjectKey(photoId);
  const stored = await putR2Object(
    objectKey,
    data,
    contentType,
    "public, max-age=31536000, immutable",
  );

  return {
    contentType: stored.contentType,
    objectKey: stored.objectKey,
    byteLength: stored.byteLength,
  };
}

export async function uploadFeedbackPhotoObject(
  photoId: string,
  data: Uint8Array,
  contentType: string,
): Promise<ItemPhotoMeta> {
  const objectKey = buildFeedbackPhotoObjectKey(photoId);
  const stored = await putR2Object(
    objectKey,
    data,
    contentType,
    "public, max-age=31536000, immutable",
  );

  return {
    contentType: stored.contentType,
    objectKey: stored.objectKey,
    byteLength: stored.byteLength,
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

export async function listR2ObjectsByPrefix(
  prefix: string,
): Promise<R2ObjectSummary[]> {
  const client = getR2Client();
  const bucket = getBucketName();
  const out: R2ObjectSummary[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of result.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({
        key: obj.Key,
        lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
        size: obj.Size ?? 0,
      });
    }

    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return out;
}
