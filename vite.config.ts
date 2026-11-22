import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleEpisodes, handleSearch, resolveHost } from './api/_core.js';
import type { CardHost } from './api/_hosts/CardHost.js';

type Out = { status: number; body: unknown };

// Serves /api/* with the same handlers as the Vercel functions, in `vite dev` and `vite preview` (Docker).
function apiPlugin(mode: string): Plugin {
  const register = (middlewares: Connect.Server) => {
    const env = loadEnv(mode, process.cwd(), '');
    const route = (path: string, run: (p: URLSearchParams, host: CardHost, key: string) => Promise<Out>) => {
      middlewares.use(path, async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'GET') return send(405, { error: 'Método no permitido' });
        const resolved = resolveHost(req.headers, env);
        if ('error' in resolved) return send(resolved.status, { error: resolved.error });
        const url = new URL(req.url ?? '', 'http://localhost');
        const out = await run(url.searchParams, resolved.host, resolved.key);
        send(out.status, out.body);
      });
    };
    route('/api/search', (p, host, key) =>
      handleSearch(
        { q: p.get('q'), episode: p.get('episode'), sort: p.get('sort'), page: p.get('page') },
        host,
        key,
      ),
    );
    route('/api/episodes', (p, host, key) => handleEpisodes(p.get('page'), host, key));
  };
  return {
    name: 'local-api',
    configureServer(server) {
      register(server.middlewares);
    },
    configurePreviewServer(server) {
      register(server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the same build works at the root and behind a sub-path proxy.
  base: './',
  plugins: [react(), apiPlugin(mode)],
}));
