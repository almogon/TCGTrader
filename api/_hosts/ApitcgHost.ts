import type { CardInfo, EpisodeInfo } from "../../src/types";
import type { HostId, SortOption } from "../../src/hostCatalog.js";
import {
  CardHost,
  type EpisodesResponse,
  type HostResult,
  type SearchQuery,
  type SearchResponse,
} from "./CardHost.js";

const BASE_URL = "https://api.apitcg.com";
const PER_PAGE = 20;

/** Tipo de cambio fijo: API TCG da precios de TCGplayer en USD. */
export const USD_TO_EUR = 0.92;

const SORT_PARAMS: Record<SortOption, string> = {
  relevance: "",
  price_highest:
    "&sortBy=markets.tcgplayer.prices.market&sortOrder=desc",
  price_lowest: "&sortBy=markets.tcgplayer.prices.market&sortOrder=asc",
};

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
  const id = Number(raw._id);
  const name = str(raw.name);
  if (!Number.isFinite(id) || !name) return null;
  const img = Array.isArray(raw.images) ? raw.images[0] : null;
  const tp = raw.markets?.tcgplayer?.prices;
  const usd = positive(tp?.market) ?? positive(tp?.mid);
  const eur = usd === null ? null : Math.round(usd * USD_TO_EUR * 100) / 100;
  return {
    id,
    name,
    cardNumber: str(raw.cardNumber) ?? str(raw.code),
    rarity: str(raw.attributes?.Rarity),
    setName: str(raw.set?.name),
    image: str(img?.large) ?? str(img?.medium) ?? str(img?.small),
    price: eur,
    prices: { EU: eur },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEpisode(raw: any): EpisodeInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const id = str(raw._id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    code: str(raw.code),
    logo: str(raw.logo),
    releasedAt: str(raw.release_date),
    series: typeof raw.serie === "string" ? str(raw.serie) : null,
  };
}

export class ApitcgHost extends CardHost {
  readonly id: HostId = "apitcg";
  readonly envKeyVar = "APITCG_API_KEY";

  private headers(key: string): Record<string, string> {
    return { "x-api-key": key };
  }

  searchCards(
    { query, episode, sort, page }: SearchQuery,
    key: string,
  ): Promise<HostResult<SearchResponse>> {
    if (typeof episode === "number") {
      return Promise.resolve({
        status: 400,
        body: { error: "Invalid set" },
      });
    }
    let url = `${BASE_URL}/api/products?tcg=pokemon&type=card`;
    if (query) url += `&name=${encodeURIComponent(query)}`;
    if (episode !== null) url += `&set=${encodeURIComponent(episode)}`;
    url += `&limit=${PER_PAGE}&page=${page}${SORT_PARAMS[sort]}`;
    return this.requestJson(
      url,
      this.headers(key),
      `search q="${query}" set=${episode ?? "-"} sort=${sort} page=${page}`,
      (json) => {
        const data: unknown[] = Array.isArray(json?.data) ? json.data : [];
        const cards = data
          .map(normalizeCard)
          .filter((c): c is CardInfo => c !== null);
        const total = Number(json?.total);
        const totalPages =
          Number.isFinite(total) && total > 0
            ? Math.max(1, Math.ceil(total / PER_PAGE))
            : 1;
        return {
          value: { cards, page, totalPages },
          summary: `${cards.length} cartas`,
        };
      },
    );
  }

  listEpisodes(
    page: number,
    key: string,
  ): Promise<HostResult<EpisodesResponse>> {
    // La API devuelve todas las colecciones de una vez: solo hay página 1.
    if (page > 1) {
      return Promise.resolve({
        status: 200,
        body: { episodes: [], page, totalPages: 1 },
      });
    }
    return this.requestJson(
      `${BASE_URL}/api/pokemon/sets`,
      this.headers(key),
      "episodes",
      (json) => {
        const data: unknown[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : [];
        const episodes = data
          .map(normalizeEpisode)
          .filter((e): e is EpisodeInfo => e !== null);
        // Más recientes primero; sin fecha al final.
        episodes.sort((a, b) => {
          if (a.releasedAt === b.releasedAt) return 0;
          if (a.releasedAt === null) return 1;
          if (b.releasedAt === null) return -1;
          return a.releasedAt < b.releasedAt ? 1 : -1;
        });
        return {
          value: { episodes, page: 1, totalPages: 1 },
          summary: `${episodes.length} colecciones`,
        };
      },
    );
  }
}
