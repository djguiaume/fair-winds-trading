// Shared helpers of the command-line tools (decision 0153).
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** A Vite server for the repository; `listen` also serves the game over http. */
export async function startVite(listen = false) {
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    appType: listen ? 'spa' : 'custom',
    server: listen
      ? { port: 0, strictPort: false, host: '127.0.0.1' }
      : { middlewareMode: true, hmr: false, ws: false },
  });
  if (listen) await server.listen();
  return server;
}

/** Splits `--name value`, `--flag` and positional arguments. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) out._.push(a);
    else {
      const [key, inline] = a.slice(2).split(/=(.*)/s);
      if (inline !== undefined) out[key] = inline;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
      else out[key] = true;
    }
  }
  return out;
}
