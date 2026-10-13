import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  parseRuntimeSnapshot,
  type RuntimeSnapshot,
} from "./core/runtime-snapshot.js";

export const loadRuntimeSnapshotFile = async (
  path: string,
): Promise<RuntimeSnapshot | undefined> => {
  try {
    return parseRuntimeSnapshot(await readFile(path, "utf8"));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
};

export const saveRuntimeSnapshotFile = async (
  path: string,
  snapshot: RuntimeSnapshot,
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  await rename(temporaryPath, path);
};
