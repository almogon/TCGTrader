import { handleSearch, resolveHost } from './_core.js';

// Minimal shapes of Vercel's Node runtime req/res (avoids the vulnerable @vercel/node dev dependency).
interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}
interface VercelResponse {
  status(code: number): { json(body: unknown): void };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  const resolved = resolveHost(req.headers, process.env);
  if ('error' in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const out = await handleSearch(
    {
      q: one(req.query.q),
      episode: one(req.query.episode),
      sort: one(req.query.sort),
      page: one(req.query.page),
    },
    resolved.host,
    resolved.key,
  );
  res.status(out.status).json(out.body);
}
