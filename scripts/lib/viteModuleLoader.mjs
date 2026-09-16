/**
 * Load app modules from Node scripts (Vite resolves JSON imports).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function loadAppModule(relativePathFromRoot) {
  const server = await createServer({
    root: REPO_ROOT,
    logLevel: 'error',
    server: { middlewareMode: true },
  });
  try {
    const normalized = relativePathFromRoot.replace(/^\//, '');
    return await server.ssrLoadModule(`/${normalized}`);
  } finally {
    await server.close();
  }
}
