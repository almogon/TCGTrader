import type { CardInfo, EpisodeInfo, PriceLang } from "../src/types";

const HOST = "pokemon-tcg-api.p.rapidapi.com";

export interface SearchResponse {
  cards: CardInfo[];
  page: number;
  totalPages: number;
}

function positive(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCard(raw: any): CardInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const name = str(raw.name);
  if (!Number.isFinite(id) || !name) return null;
  const cm = raw.prices?.cardmarket;
  const prices: Partial<Record<PriceLang, number | null>> = {
    EU: positive(cm?.lowest_near_mint_EU_only),
    DE: positive(cm?.lowest_near_mint_DE),
    ES: positive(cm?.lowest_near_mint_ES),
  };
  return {
    id,
    name,
    cardNumber: str(raw.card_number),
    rarity: str(raw.rarity),
    setName: str(raw.episode?.name),
    image: str(raw.image),
    price: prices.EU ?? null,
    prices,
  };
}

/** Summarizes RapidAPI rate-limit headers (never includes the key). */
function rateLimitInfo(h: Headers): string {
  const parts: string[] = [];
  h.forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-ratelimit-"))
      parts.push(`${name.slice(12)}=${value}`);
  });
  return parts.length ? `cuota: ${parts.join(", ")}` : "cuota: (sin cabeceras)";
}

export interface EpisodesResponse {
  episodes: EpisodeInfo[];
  page: number;
  totalPages: number;
}

export interface HandlerResult {
  status: number;
  body: SearchResponse | { error: string };
}

export interface EpisodesHandlerResult {
  status: number;
  body: EpisodesResponse | { error: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEpisode(raw: any): EpisodeInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const name = str(raw.name);
  if (!Number.isFinite(id) || id <= 0 || !name) return null;
  return {
    id,
    name,
    code: str(raw.code),
    logo: str(raw.logo),
    releasedAt: str(raw.released_at),
    series: str(raw.series?.name),
  };
}

export interface SearchParams {
  q?: string | null;
  episode?: string | null;
  sort?: string | null;
  page?: string | null;
}

const SORTS = ["relevance", "price_highest", "price_lowest"];

function parsePage(pageParam: string | null | undefined): number {
  const pageNum = parseInt(pageParam ?? "1", 10);
  return Number.isFinite(pageNum) && pageNum >= 1 && pageNum <= 1000
    ? pageNum
    : 1;
}

/** Validates params, calls the TCGGO API and returns the normalized response. */
export async function handleSearch(
  params: SearchParams,
  apiKey: string,
): Promise<HandlerResult> {
  const query = (params.q ?? "").trim();
  if (query && (query.length < 2 || query.length > 60)) {
    return {
      status: 400,
      body: {
        error: "El texto de búsqueda debe tener entre 2 y 60 caracteres",
      },
    };
  }
  const episodeRaw = (params.episode ?? "").trim();
  let episode: number | null = null;
  if (episodeRaw) {
    if (!/^\d+$/.test(episodeRaw) || parseInt(episodeRaw, 10) <= 0) {
      return { status: 400, body: { error: "Colección no válida" } };
    }
    episode = parseInt(episodeRaw, 10);
  }
  if (!query && episode === null) {
    return {
      status: 400,
      body: { error: "Indica un nombre de carta o una colección" },
    };
  }
  const sort = SORTS.includes(params.sort ?? "") ? params.sort! : "relevance";
  const page = parsePage(params.page);
  const base =
    episode !== null
      ? `https://${HOST}/episodes/${episode}/cards`
      : `https://${HOST}/cards`;
  const search = query ? `search=${encodeURIComponent(query)}&` : "";
  const url = `${base}?${search}sort=${sort}&per_page=20&page=${page}`;
  const started = Date.now();
  console.log(
    `[tcggo] → GET search q="${query}" episode=${episode ?? "-"} sort=${sort} page=${page}`,
  );
  try {
    const r = await fetch(url, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": HOST },
    });
    const ms = Date.now() - started;
    const quota = rateLimitInfo(r.headers);
    if (!r.ok) {
      const bodyText = (await r.text().catch(() => "")).slice(0, 300);
      console.error(
        `[tcggo] ← ${r.status} en ${ms} ms · ${quota} · respuesta: ${bodyText || "(vacía)"}`,
      );
      const msg =
        r.status === 401 || r.status === 403
          ? "La clave de la API no es válida"
          : r.status === 429
            ? "Límite de peticiones alcanzado, inténtalo más tarde"
            : `Error de la API (${r.status})`;
      return { status: r.status === 429 ? 429 : 502, body: { error: msg } };
    }
    const json = await r.json();
    const data: unknown[] = Array.isArray(json?.data) ? json.data : [];
    const cards = data
      .map(normalizeCard)
      .filter((c): c is CardInfo => c !== null);
    console.log(
      `[tcggo] ← ${r.status} en ${ms} ms · ${cards.length} cartas · ${quota}`,
    );
    const current = Number(json?.paging?.current);
    const total = Number(json?.paging?.total);
    return {
      status: 200,
      body: {
        cards,
        page: Number.isFinite(current) && current > 0 ? current : page,
        totalPages: Number.isFinite(total) && total > 0 ? total : 1,
      },
    };
  } catch (e) {
    console.error(
      `[tcggo] ✕ error de red tras ${Date.now() - started} ms: ${e instanceof Error ? e.message : String(e)}`,
    );
    return {
      status: 502,
      body: { error: "No se pudo contactar con la API de cartas" },
    };
  }
}

/** Calls the TCGGO episodes endpoint (one page) and returns the normalized response. */
export async function handleEpisodes(
  pageParam: string | null | undefined,
  apiKey: string,
): Promise<EpisodesHandlerResult> {
  const page = parsePage(pageParam);
  const url = `https://${HOST}/episodes?page=${page}`;
  const started = Date.now();
  console.log(`[tcggo] → GET episodes page=${page}`);
  try {
    const r = await fetch(url, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": HOST },
    });
    const ms = Date.now() - started;
    const quota = rateLimitInfo(r.headers);
    if (!r.ok) {
      const bodyText = (await r.text().catch(() => "")).slice(0, 300);
      console.error(
        `[tcggo] ← ${r.status} en ${ms} ms · ${quota} · respuesta: ${bodyText || "(vacía)"}`,
      );
      const msg =
        r.status === 401 || r.status === 403
          ? "La clave de la API no es válida"
          : r.status === 429
            ? "Límite de peticiones alcanzado, inténtalo más tarde"
            : `Error de la API (${r.status})`;
      return { status: r.status === 429 ? 429 : 502, body: { error: msg } };
    }
    const json = await r.json();
    const data: unknown[] = Array.isArray(json?.data) ? json.data : [];
    const episodes = data
      .map(normalizeEpisode)
      .filter((e): e is EpisodeInfo => e !== null);
    console.log(
      `[tcggo] ← ${r.status} en ${ms} ms · ${episodes.length} colecciones · ${quota}`,
    );
    const current = Number(json?.paging?.current);
    const total = Number(json?.paging?.total);
    return {
      status: 200,
      body: {
        episodes,
        page: Number.isFinite(current) && current > 0 ? current : page,
        totalPages: Number.isFinite(total) && total > 0 ? total : 1,
      },
    };
  } catch (e) {
    console.error(
      `[tcggo] ✕ error de red tras ${Date.now() - started} ms: ${e instanceof Error ? e.message : String(e)}`,
    );
    return {
      status: 502,
      body: { error: "No se pudo contactar con la API de cartas" },
    };
  }
}
