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

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
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
