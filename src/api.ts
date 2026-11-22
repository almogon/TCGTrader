import type { CardInfo, EpisodeInfo, PriceLang } from './types';

export interface SearchPage {
  cards: CardInfo[];
  page: number;
  totalPages: number;
}

export type SortOption = 'relevance' | 'price_highest' | 'price_lowest';

export interface SearchParams {
  q: string;
  episode: number | null;
  sort: SortOption;
  page: number;
}

const cache = new Map<string, SearchPage>();

/** Credenciales propias guardadas desde el modal "Authenticate"; vacías = las del servidor. */
export interface AuthSettings {
  host: string;
  key: string;
}

const AUTH_KEY = 'tcg-trader-auth-v1';

export function loadAuth(): AuthSettings {
  try {
    const p = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') as Partial<AuthSettings> | null;
    return { host: typeof p?.host === 'string' ? p.host : '', key: typeof p?.key === 'string' ? p.key : '' };
  } catch {
    return { host: '', key: '' };
  }
}

/** Sobrescribe las credenciales guardadas (si ambas quedan vacías, se borran) y vacía la caché de búsquedas. */
export function saveAuth(auth: AuthSettings) {
  const clean = { host: auth.host.trim(), key: auth.key.trim() };
  try {
    if (clean.host || clean.key) localStorage.setItem(AUTH_KEY, JSON.stringify(clean));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
  cache.clear();
}

function authHeaders(): Record<string, string> {
  const { host, key } = loadAuth();
  const h: Record<string, string> = {};
  if (host) h['x-tcg-host'] = host;
  if (key) h['x-tcg-key'] = key;
  return h;
}

export async function searchCards(params: SearchParams, signal?: AbortSignal): Promise<SearchPage> {
  const q = params.q.trim();
  const { episode, sort, page } = params;
  const key = `${q.toLowerCase()}|${episode ?? ''}|${sort}|${page}`;
  const label = `"${q}" col=${episode ?? '-'} ${sort} p${page}`;
  const hit = cache.get(key);
  if (hit) {
    console.debug(`[search] caché ${label} · ${hit.cards.length} cartas`);
    return hit;
  }
  console.debug(`[search] → ${label}`);
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (episode !== null) qs.set('episode', String(episode));
  qs.set('sort', sort);
  qs.set('page', String(page));
  const r = await fetch(`/api/search?${qs.toString()}`, { signal, headers: authHeaders() });
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* respuesta no JSON */
  }
  if (!r.ok) {
    const msg = (body as { error?: string } | null)?.error;
    console.warn(`[search] ← ${r.status} ${label}: ${msg ?? 'sin detalle'}`);
    throw new Error(msg ?? `Error ${r.status}`);
  }
  const data = body as SearchPage;
  console.debug(`[search] ← ${r.status} ${label} · ${data.cards.length} cartas`);
  cache.set(key, data);
  return data;
}

const EPISODES_KEY = 'tcg-trader-episodes-v1';
const EPISODES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SavedEpisodes {
  savedAt: number;
  episodes: EpisodeInfo[];
}

function readSavedEpisodes(): SavedEpisodes | null {
  try {
    const raw = localStorage.getItem(EPISODES_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SavedEpisodes>;
    if (typeof p.savedAt !== 'number' || !Array.isArray(p.episodes)) return null;
    return { savedAt: p.savedAt, episodes: p.episodes };
  } catch {
    return null;
  }
}

function writeSavedEpisodes(episodes: EpisodeInfo[]) {
  try {
    localStorage.setItem(EPISODES_KEY, JSON.stringify({ savedAt: Date.now(), episodes }));
  } catch {
    /* almacenamiento no disponible */
  }
}

interface EpisodesPage {
  episodes: EpisodeInfo[];
  page: number;
  totalPages: number;
}

async function fetchEpisodesPage(page: number): Promise<EpisodesPage> {
  const r = await fetch(`/api/episodes?page=${page}`, { headers: authHeaders() });
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* respuesta no JSON */
  }
  if (!r.ok) {
    const msg = (body as { error?: string } | null)?.error;
    throw new Error(msg ?? `Error ${r.status}`);
  }
  return body as EpisodesPage;
}

async function downloadEpisodes(): Promise<EpisodeInfo[]> {
  const first = await fetchEpisodesPage(1);
  const all = [...first.episodes];
  for (let p = 2; p <= first.totalPages; p++) {
    all.push(...(await fetchEpisodesPage(p)).episodes);
  }
  console.debug(`[episodes] descargadas ${all.length} colecciones (${first.totalPages} páginas)`);
  // Más recientes primero; sin fecha al final.
  all.sort((a, b) => {
    if (a.releasedAt === b.releasedAt) return 0;
    if (a.releasedAt === null) return 1;
    if (b.releasedAt === null) return -1;
    return a.releasedAt < b.releasedAt ? 1 : -1;
  });
  return all;
}

let episodesInFlight: Promise<EpisodeInfo[]> | null = null;

export function loadEpisodes(force = false): Promise<EpisodeInfo[]> {
  const saved = readSavedEpisodes();
  if (!force && saved && Date.now() - saved.savedAt < EPISODES_TTL_MS) {
    console.debug(`[episodes] caché local · ${saved.episodes.length} colecciones`);
    return Promise.resolve(saved.episodes);
  }
  if (episodesInFlight) return episodesInFlight;
  episodesInFlight = (async () => {
    try {
      const episodes = await downloadEpisodes();
      writeSavedEpisodes(episodes);
      return episodes;
    } catch (e) {
      if (saved) {
        console.warn(
          `[episodes] fallo al descargar, uso datos caducados: ${e instanceof Error ? e.message : String(e)}`,
        );
        return saved.episodes;
      }
      throw e;
    } finally {
      episodesInFlight = null;
    }
  })();
  return episodesInFlight;
}

/** Precio de la carta para el idioma elegido (cartas antiguas sin `prices`: usa `price`). */
export function priceFor(card: CardInfo, lang: PriceLang): number | null {
  return card.prices ? card.prices[lang] ?? null : card.price;
}

/** Devuelve la lista con `price` resuelto: el editado si existe, si no el del idioma propio de la carta (EU por defecto). */
export function resolveBag<T extends CardInfo & { customPrice?: number | null; lang?: PriceLang }>(cards: T[]): T[] {
  return cards.map((c) => ({
    ...c,
    price: typeof c.customPrice === 'number' && c.customPrice > 0 ? c.customPrice : priceFor(c, c.lang ?? 'EU'),
  }));
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const formatEur = (n: number) => eur.format(n);
