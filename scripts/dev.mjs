import { createServer } from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.unref();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

async function findFreePort(start) {
  let port = start;
  while (!(await isPortFree(port))) {
    console.log(`⨯ Puerto ${port} en uso, probando siguiente...`);
    port++;
  }
  return port;
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getOtherDevServer() {
  for (const lockPath of [".next/dev/lock", ".next/lock"]) {
    try {
      const info = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
      if (info?.pid && isPidAlive(info.pid)) {
        return { lockPath, info };
      }
    } catch {
      // lock inexistente o ilegible; seguir
    }
  }
  return null;
}

const startPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const port = await findFreePort(isNaN(startPort) ? 3000 : startPort);
const other = getOtherDevServer();

const env = { ...process.env };
if (other) {
  env.NEXT_DIST_DIR = `.next/dev-${port}`;
  console.log(
    `⚠ Otra instancia de Next.js dev está corriendo (PID ${other.info.pid}). Aislando dist dir para esta instancia.`,
  );
}

console.log(`Iniciando Next.js dev en http://localhost:${port}`);

const nextEntry = path.join("node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextEntry, "dev", "-p", String(port)], {
  stdio: "inherit",
  env,
});

child.on("error", (err) => {
  console.error("Error al iniciar Next.js:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
