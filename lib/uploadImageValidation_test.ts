import { assertEquals, assertStringIncludes } from "$std/assert/mod.ts";
import {
  DEFAULT_UPLOAD_IMAGE_POLICY,
  validateUploadedImage,
} from "./uploadImageValidation.ts";

function u32be(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function u32le(value: number): number[] {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function createPng(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52,
    ...u32be(width),
    ...u32be(height),
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
}

function createJpeg(width: number, height: number): Uint8Array {
  const app0 = [
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x01,
    0x00,
    0x48,
    0x00,
    0x48,
    0x00,
    0x00,
  ];

  const sof0 = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
  ];

  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}

function createWebpVp8x(width: number, height: number): Uint8Array {
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  const vp8xPayload = [
    0x00,
    0x00,
    0x00,
    0x00,
    widthMinusOne & 0xff,
    (widthMinusOne >>> 8) & 0xff,
    (widthMinusOne >>> 16) & 0xff,
    heightMinusOne & 0xff,
    (heightMinusOne >>> 8) & 0xff,
    (heightMinusOne >>> 16) & 0xff,
  ];

  const riffSize = 4 + 8 + vp8xPayload.length;
  return new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46,
    ...u32le(riffSize),
    0x57,
    0x45,
    0x42,
    0x50,
    0x56,
    0x50,
    0x38,
    0x58,
    ...u32le(vp8xPayload.length),
    ...vp8xPayload,
  ]);
}

Deno.test("accepts valid PNG and extracts dimensions", () => {
  const png = createPng(640, 480);
  const result = validateUploadedImage("image/png", png);

  if ("status" in result) {
    throw new Error(`Unexpected validation error: ${result.error}`);
  }

  assertEquals(result.mimeType, "image/png");
  assertEquals(result.width, 640);
  assertEquals(result.height, 480);
});

Deno.test("accepts valid JPEG and extracts dimensions", () => {
  const jpeg = createJpeg(1024, 768);
  const result = validateUploadedImage("image/jpeg", jpeg);

  if ("status" in result) {
    throw new Error(`Unexpected validation error: ${result.error}`);
  }

  assertEquals(result.mimeType, "image/jpeg");
  assertEquals(result.width, 1024);
  assertEquals(result.height, 768);
});

Deno.test("accepts valid WebP VP8X and extracts dimensions", () => {
  const webp = createWebpVp8x(800, 600);
  const result = validateUploadedImage("image/webp", webp);

  if ("status" in result) {
    throw new Error(`Unexpected validation error: ${result.error}`);
  }

  assertEquals(result.mimeType, "image/webp");
  assertEquals(result.width, 800);
  assertEquals(result.height, 600);
});

Deno.test("rejects unsupported declared content type", () => {
  const png = createPng(128, 128);
  const result = validateUploadedImage("image/gif", png);

  assertEquals("status" in result ? result.status : 0, 415);
  if ("status" in result) {
    assertStringIncludes(result.error, "JPEG, PNG, or WebP");
  }
});

Deno.test("rejects mismatched mime and signature", () => {
  const png = createPng(128, 128);
  const result = validateUploadedImage("image/jpeg", png);

  assertEquals("status" in result ? result.status : 0, 415);
  if ("status" in result) {
    assertStringIncludes(result.error, "does not match");
  }
});

Deno.test("rejects corrupt image data", () => {
  const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const result = validateUploadedImage("image/png", fakePng);

  assertEquals("status" in result ? result.status : 0, 415);
  if ("status" in result) {
    assertStringIncludes(result.error, "not a valid");
  }
});

Deno.test("rejects too-small dimensions", () => {
  const tiny = createPng(8, 8);
  const result = validateUploadedImage("image/png", tiny);

  assertEquals("status" in result ? result.status : 0, 422);
  if ("status" in result) {
    assertStringIncludes(result.error, "too small");
  }
});

Deno.test("rejects too-large dimensions", () => {
  const huge = createPng(5000, 2000);
  const result = validateUploadedImage("image/png", huge);

  assertEquals("status" in result ? result.status : 0, 422);
  if ("status" in result) {
    assertStringIncludes(result.error, "too large");
  }
});

Deno.test("rejects too many pixels", () => {
  const policy = {
    ...DEFAULT_UPLOAD_IMAGE_POLICY,
    maxWidth: 20000,
    maxHeight: 20000,
    maxPixels: 100,
  };
  const image = createPng(20, 20);
  const result = validateUploadedImage("image/png", image, policy);

  assertEquals("status" in result ? result.status : 0, 422);
  if ("status" in result) {
    assertStringIncludes(result.error, "too many pixels");
  }
});

Deno.test("rejects oversized byte payload", () => {
  const policy = {
    ...DEFAULT_UPLOAD_IMAGE_POLICY,
    maxBytes: 16,
  };
  const image = createPng(32, 32);
  const result = validateUploadedImage("image/png", image, policy);

  assertEquals("status" in result ? result.status : 0, 413);
  if ("status" in result) {
    assertStringIncludes(result.error, "10 MB limit");
  }
});
