/// <reference lib="deno.unstable" />

import { initKv } from "../db/kv.ts";
import {
  isLegacyPhotoRecord,
  type StoredPhotoRecord,
  uploadPhotoObject,
} from "../lib/r2Photos.ts";

function parseArgs(args: string[]): { dryRun: boolean } {
  return {
    dryRun: args.includes("--dry-run"),
  };
}

async function migrate(): Promise<void> {
  const { dryRun } = parseArgs(Deno.args);
  const kv = await initKv();

  let scanned = 0;
  let alreadyMetadata = 0;
  let migrated = 0;

  for await (
    const entry of kv.list<StoredPhotoRecord>({
      prefix: ["inventory", "photos"],
    })
  ) {
    scanned++;
    const key = entry.key;
    const photoId = typeof key[2] === "string" ? key[2] : null;
    if (!photoId || !entry.value) continue;

    if (!isLegacyPhotoRecord(entry.value)) {
      alreadyMetadata++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] would migrate photo ${photoId} (${entry.value.data.byteLength} bytes)`,
      );
      migrated++;
      continue;
    }

    const meta = await uploadPhotoObject(
      photoId,
      entry.value.data,
      entry.value.contentType,
    );
    await kv.set(entry.key, meta);
    migrated++;
    console.log(`migrated ${photoId} -> ${meta.objectKey}`);
  }

  console.log("\nPhoto migration complete");
  console.log(`scanned: ${scanned}`);
  console.log(`already metadata: ${alreadyMetadata}`);
  console.log(`migrated: ${migrated}${dryRun ? " (dry-run)" : ""}`);
}

if (import.meta.main) {
  migrate().catch((error) => {
    console.error("Photo migration failed", error);
    Deno.exit(1);
  });
}
