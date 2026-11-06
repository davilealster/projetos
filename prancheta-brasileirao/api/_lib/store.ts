// Armazenamento dos documentos do admin.
// Na Vercel: Blob privado (BLOB_READ_WRITE_TOKEN). Local (npm run dev): arquivos em .cache/admin-store.
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN && (process.env.VERCEL === "1" || process.env.ADMIN_USE_BLOB === "1");
const LOCAL_DIR = join(process.cwd(), ".cache", "admin-store");

export async function readDoc<T>(name: string): Promise<T | null> {
  if (useBlob()) {
    try {
      const r = await get(name, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return JSON.parse(await new Response(r.stream).text()) as T;
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  }
  try {
    return JSON.parse(await readFile(join(LOCAL_DIR, name), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeDoc(name: string, data: unknown): Promise<void> {
  const body = JSON.stringify(data);
  if (useBlob()) {
    await put(name, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  const file = join(LOCAL_DIR, name);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
}
