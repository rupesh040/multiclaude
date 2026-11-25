import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

const require = createRequire(import.meta.url);
const electronExecutable = require("electron");
const isProd = process.argv.includes("--prod");

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      resolve(findFreePort(startPort + 1));
    });
    server.listen(startPort, "127.0.0.1", () => {
      server.close(() => resolve(startPort));
    });
  });
}

async function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for Next.js server at ${url}`);
}

async function main() {
  if (isProd) {
    const outIndex = path.resolve("out", "index.html");
    if (!fs.existsSync(outIndex)) {
      console.error("Missing static export at out/index.html. Run `npm run build` first.");
      process.exit(1);
    }

    const electronProc = spawn(electronExecutable, ["."], {
      stdio: "inherit",
      env: { ...process.env },
    });
    electronProc.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  const port = await findFreePort(3000);
  const url = `http://localhost:${port}`;
  const nextBin = require.resolve("next/dist/bin/next");

  const nextProc = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    stdio: "inherit",
    env: { ...process.env },
  });

  const cleanup = () => {
    if (!nextProc.killed) {
      nextProc.kill("SIGTERM");
    }
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await waitForServer(url);
  } catch (err) {
    cleanup();
    console.error(err);
    process.exit(1);
  }

  const electronProc = spawn(electronExecutable, ["."], {
    stdio: "inherit",
    env: {
      ...process.env,
      MULTICLAUDE_URL: url,
    },
  });

  electronProc.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main();
