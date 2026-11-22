import { DEFAULT_HOST_ID, HOST_CATALOG, isHostId, type HostId, type HostInfo, type SortOption } from './hostCatalog';
import type { CardInfo, EpisodeInfo, PriceLang } from './types';

export type { SortOption };

export interface SearchPage {
  cards: CardInfo[];
  page: number;
  totalPages: number;
}

export interface SearchParams {
  q: string;
  episode: string | number | null;
  sort: SortOption;
  page: number;
}

const cache = new Map<string, SearchPage>();

/** Host elegido y API keys propias (una por host) guardadas desde el modal "Authenticate"; sin key = la del servidor. */
export interface AuthSettings {
  hostId: HostId;
  keys: Partial<Record<HostId, string>>;
}

const AUTH_KEY = 'tcg-trader-auth-v2';
const AUTH_KEY_V1 = 'tcg-trader-auth-v1';
const V1_DEFAULT_HOST = 'pokemon-tcg-api.p.rapidapi.com';

function cleanKeys(raw: unknown): Partial<Record<HostId, string>> {
  const keys: Partial<Record<HostId, string>> = {};
  if (raw && typeof raw === 'object') {
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      if (isHostId(id) && typeof v === 'string' && v.trim()) keys[id] = v.trim();
    }
  }
  return keys;
}

/** Migra el formato v1 ({host, key}) al v2: solo se conserva la key si el host era vacío o el de TCGGO. */
export function migrateAuthV1(raw: unknown): AuthSettings {
  const p = raw && typeof raw === 'object' ? (raw as { host?: unknown; key?: unknown }) : {};
  const host = typeof p.host === 'string' ? p.host.trim() : '';
  const key = typeof p.key === 'string' ? p.key.trim() : '';
  const keys: Partial<Record<HostId, string>> = {};
  if ((host === '' || host === V1_DEFAULT_HOST) && key) keys.tcggo = key;
  return { hostId: DEFAULT_HOST_ID, keys };
}

export function loadAuth(): AuthSettings {
  try {
    const v2 = localStorage.getItem(AUTH_KEY);
    if (v2) {
      const p = JSON.parse(v2) as { hostId?: unknown; keys?: unknown } | null;
      return { hostId: isHostId(p?.hostId) ? p.hostId : DEFAULT_HOST_ID, keys: cleanKeys(p?.keys) };
    }
    const v1 = localStorage.getItem(AUTH_KEY_V1);
    if (v1) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(v1);
      } catch {
        /* v1 corrupto: se descarta */
      }
      const migrated = migrateAuthV1(parsed);
      localStorage.setItem(AUTH_KEY, JSON.stringify(migrated));
      localStorage.removeItem(AUTH_KEY_V1);
      return migrated;
    }
  } catch {
    /* almacenamiento no disponible o JSON corrupto */
  }
  return { hostId: DEFAULT_HOST_ID, keys: {} };
}

/** Sobrescribe el host y las keys guardados (se descartan las vacías) y vacía la caché de búsquedas. */
export function saveAuth(auth: AuthSettings) {
  const clean: AuthSettings = {
    hostId: isHostId(auth.hostId) ? auth.hostId : DEFAULT_HOST_ID,
    keys: cleanKeys(auth.keys),
  };
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(clean));
  } catch {
    /* almacenamiento no disponible */
  }
  cache.clear();
}

/** Información y capacidades del host elegido actualmente. */
export function currentHost(): HostInfo {
  return HOST_CATALOG[loadAuth().hostId];
}

function authHeaders(): Record<string, string> {
  const { hostId, keys } = loadAuth();
  const h: Record<string, string> = { 'x-tcg-host': hostId };
  const key = keys[hostId];
  if (key) h['x-tcg-key'] = key;
  return h;
}

export async function searchCards(params: SearchParams, signal?: AbortSignal): Promise<SearchPage> {
  const q = params.q.trim();
  const { episode, sort, page } = params;
  const key = `${loadAuth().hostId}|${q.toLowerCase()}|${episode ?? ''}|${sort}|${page}`;
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

const EPISODES_KEY_PREFIX = 'tcg-trader-episodes-v2-';
const EPISODES_KEY_V1 = 'tcg-trader-episodes-v1';
const EPISODES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SavedEpisodes {
  savedAt: number;
  episodes: EpisodeInfo[];
}

function readSavedEpisodes(hostId: HostId): SavedEpisodes | null {
  try {
    const raw = localStorage.getItem(EPISODES_KEY_PREFIX + hostId);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SavedEpisodes>;
    if (typeof p.savedAt !== 'number' || !Array.isArray(p.episodes)) return null;
    return { savedAt: p.savedAt, episodes: p.episodes };
  } catch {
    return null;
  }
}

function writeSavedEpisodes(hostId: HostId, episodes: EpisodeInfo[]) {
  try {
    localStorage.setItem(EPISODES_KEY_PREFIX + hostId,JSON.stringify({ savedAt: Date.now(), episodes }));
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

const episodesInFlight = new Map<HostId, Promise<EpisodeInfo[]>>();

export function loadEpisodes(force = false): Promise<EpisodeInfo[]> {
  const host = currentHost();
  if (!host.capabilities.episodes) return Promise.resolve([]);
  const hostId = host.id;
  try {
    localStorage.removeItem(EPISODES_KEY_V1);
  } catch {
    /* almacenamiento no disponible */
  }
  const saved = readSavedEpisodes(hostId);
  if (!force && saved && Date.now() - saved.savedAt < EPISODES_TTL_MS) {
    console.debug(`[episodes] caché local · ${saved.episodes.length} colecciones`);
    return Promise.resolve(saved.episodes);
  }
  const pending = episodesInFlight.get(hostId);
  if (pending) return pending;
  const run = (async () => {
    try {
      const episodes = await downloadEpisodes();
      writeSavedEpisodes(hostId, episodes);
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
      episodesInFlight.delete(hostId);
    }
  })();
  episodesInFlight.set(hostId, run);
  return run;
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
