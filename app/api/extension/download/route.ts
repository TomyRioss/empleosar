import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { buildZip } from "@/lib/extensionZip";

const EXT_FILES = [
  "manifest.json",
  "background.js",
  "content/web.js",
  "content/portal.js",
  "README.md",
];

export async function GET(req: Request) {
  const root = path.join(process.cwd(), "empleosar-extension");

  try {
    const maybeDir = await stat(root);
    if (!maybeDir.isDirectory()) return notFound();
  } catch {
    return notFound();
  }

  // El manifest de la extensión apunta a http://localhost:3000 (dev). Como
  // el zip se sirve desde la web real, reescribimos el origin al de esta
  // petición para que el content script de la web funcione en producción.
  let origin = "http://localhost:3000";
  try {
    origin = new URL(req.url).origin;
  } catch {
    // se mantiene el default de dev
  }

  const files = [];
  for (const name of EXT_FILES) {
    if (name === "manifest.json") continue;
    try {
      const data = await readFile(path.join(root, name));
      files.push({ name, data: new Uint8Array(data) });
    } catch {
      return notFound();
    }
  }

  try {
    const manifestRaw = await readFile(path.join(root, "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw);
    manifest.content_scripts = (manifest.content_scripts ?? []).map((cs: {
      matches?: string[];
    }) => ({
      ...cs,
      matches: (cs.matches ?? []).map((m: string) =>
        m.startsWith("http://localhost:3000") ? `${origin}/*` : m,
      ),
    }));
    manifest.host_permissions = (manifest.host_permissions ?? []).map((m: string) =>
      m.startsWith("http://localhost:3000") ? `${origin}/*` : m,
    );
    files.push({
      name: "manifest.json",
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    });
  } catch {
    return notFound();
  }

  const zip = buildZip(files);

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="empleosar-extension.zip"',
    },
  });
}

function notFound() {
  return new NextResponse("La extensión no está disponible en este despliegue.", {
    status: 404,
  });
}