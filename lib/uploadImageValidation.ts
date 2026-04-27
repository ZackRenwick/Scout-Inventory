export interface UploadImagePolicy {
  allowedMimeTypes: Set<string>;
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
}

export interface UploadImageValidationResult {
  width: number;
  height: number;
  mimeType: string;
  byteLength: number;
}

export interface UploadImageValidationError {
  status: number;
  error: string;
}

const JPEG_MIME = "image/jpeg";
const PNG_MIME = "image/png";
const WEBP_MIME = "image/webp";

const SOF_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

export const DEFAULT_UPLOAD_IMAGE_POLICY: UploadImagePolicy = {
  allowedMimeTypes: new Set([JPEG_MIME, PNG_MIME, WEBP_MIME]),
  maxBytes: 10 * 1024 * 1024,
  minWidth: 16,
  minHeight: 16,
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 12_000_000,
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (start < 0 || length <= 0 || start + length > bytes.length) return "";
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readU16BE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU24LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 3 > bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readU16LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24);
}

function detectMimeType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return JPEG_MIME;
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return PNG_MIME;
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return WEBP_MIME;
  }

  return null;
}

function parsePngDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);

  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

function parseJpegDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset++;
    }
    if (offset >= bytes.length) return null;

    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }

    const segmentLength = readU16BE(bytes, offset);
    if (!segmentLength || segmentLength < 2) return null;

    const segmentStart = offset + 2;
    if (segmentStart + segmentLength - 2 > bytes.length) return null;

    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      const height = readU16BE(bytes, segmentStart + 1);
      const width = readU16BE(bytes, segmentStart + 3);
      if (!width || !height) return null;
      return { width, height };
    }

    offset = segmentStart + segmentLength - 2;
  }

  return null;
}

function parseWebpDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 20) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, 4);
    const chunkSize = readU32LE(bytes, offset + 4);
    if (chunkSize === null || chunkSize < 0) return null;

    const dataOffset = offset + 8;
    const dataEnd = dataOffset + chunkSize;
    if (dataEnd > bytes.length) return null;

    if (chunkType === "VP8X") {
      if (chunkSize < 10) return null;
      const widthMinusOne = readU24LE(bytes, dataOffset + 4);
      const heightMinusOne = readU24LE(bytes, dataOffset + 7);
      if (widthMinusOne === null || heightMinusOne === null) return null;
      return { width: widthMinusOne + 1, height: heightMinusOne + 1 };
    }

    if (chunkType === "VP8 ") {
      if (chunkSize < 10) return null;
      const startCodeA = bytes[dataOffset + 3];
      const startCodeB = bytes[dataOffset + 4];
      const startCodeC = bytes[dataOffset + 5];
      if (startCodeA !== 0x9d || startCodeB !== 0x01 || startCodeC !== 0x2a) {
        return null;
      }

      const widthRaw = readU16LE(bytes, dataOffset + 6);
      const heightRaw = readU16LE(bytes, dataOffset + 8);
      if (widthRaw === null || heightRaw === null) return null;

      const width = widthRaw & 0x3fff;
      const height = heightRaw & 0x3fff;
      return { width, height };
    }

    if (chunkType === "VP8L") {
      if (chunkSize < 5) return null;
      if (bytes[dataOffset] !== 0x2f) return null;
      const bits = readU32LE(bytes, dataOffset + 1);
      if (bits === null) return null;
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }

    const padding = chunkSize % 2;
    offset = dataEnd + padding;
  }

  return null;
}

function parseDimensions(
  mimeType: string,
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (mimeType === JPEG_MIME) return parseJpegDimensions(bytes);
  if (mimeType === PNG_MIME) return parsePngDimensions(bytes);
  if (mimeType === WEBP_MIME) return parseWebpDimensions(bytes);
  return null;
}

export function validateUploadedImage(
  declaredMimeType: string,
  bytes: Uint8Array,
  policy: UploadImagePolicy = DEFAULT_UPLOAD_IMAGE_POLICY,
): UploadImageValidationResult | UploadImageValidationError {
  const normalizedMimeType = String(declaredMimeType ?? "").trim()
    .toLowerCase();
  if (!policy.allowedMimeTypes.has(normalizedMimeType)) {
    return {
      status: 415,
      error: "Only JPEG, PNG, or WebP images are allowed",
    };
  }

  if (bytes.length === 0) {
    return {
      status: 400,
      error: "Image file is empty",
    };
  }

  if (bytes.length > policy.maxBytes) {
    return {
      status: 413,
      error: "Image exceeds 10 MB limit. Please upload a smaller image",
    };
  }

  const detectedMimeType = detectMimeType(bytes);
  if (!detectedMimeType) {
    return {
      status: 415,
      error: "Uploaded file is not a valid JPEG, PNG, or WebP image",
    };
  }

  if (detectedMimeType !== normalizedMimeType) {
    return {
      status: 415,
      error: "Image content does not match declared content type",
    };
  }

  const dimensions = parseDimensions(detectedMimeType, bytes);
  if (!dimensions) {
    return {
      status: 415,
      error: "Image appears corrupted or unreadable",
    };
  }

  const { width, height } = dimensions;
  if (width < policy.minWidth || height < policy.minHeight) {
    return {
      status: 422,
      error:
        `Image dimensions too small. Minimum is ${policy.minWidth}x${policy.minHeight}px`,
    };
  }

  if (width > policy.maxWidth || height > policy.maxHeight) {
    return {
      status: 422,
      error:
        `Image dimensions too large. Maximum is ${policy.maxWidth}x${policy.maxHeight}px`,
    };
  }

  if (width * height > policy.maxPixels) {
    return {
      status: 422,
      error: "Image has too many pixels. Please use a smaller resolution",
    };
  }

  return {
    width,
    height,
    mimeType: detectedMimeType,
    byteLength: bytes.length,
  };
}
