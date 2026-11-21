import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleEpisodes, handleSearch } from './api/_normalize.js';

type Out = { status: number; body: unknown };

function apiDevPlugin(mode: string): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '');
      const route = (path: string, run: (p: URLSearchParams, key: string) => Promise<Out>) => {
        server.middlewares.use(path, async (req, res) => {
          const send = (status: number, body: unknown) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(body));
          };
          if (req.method !== 'GET') return send(405, { error: 'Método no permitido' });
          const key = env.RAPIDAPI_KEY;
          if (!key) return send(500, { error: 'Falta RAPIDAPI_KEY en .env.local' });
          const url = new URL(req.url ?? '', 'http://localhost');
          const out = await run(url.searchParams, key);
          send(out.status, out.body);
        });
      };
      route('/api/search', (p, key) =>
        handleSearch(
          { q: p.get('q'), episode: p.get('episode'), sort: p.get('sort'), page: p.get('page') },
          key,
        ),
      );
      route('/api/episodes', (p, key) => handleEpisodes(p.get('page'), key));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiDevPlugin(mode)],
}));
