import { handleEpisodes } from './_normalize.js';

// Minimal shapes of Vercel's Node runtime req/res (avoids the vulnerable @vercel/node dev dependency).
interface VercelRequest {
  method?: string;
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
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    res.status(500).json({ error: 'Falta RAPIDAPI_KEY en el servidor' });
    return;
  }
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const out = await handleEpisodes(one(req.query.page), key);
  res.status(out.status).json(out.body);
}
