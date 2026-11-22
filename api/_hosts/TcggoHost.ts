import type { CardInfo, EpisodeInfo, PriceLang } from "../../src/types";
import type { HostId } from "../../src/hostCatalog.js";
import {
  CardHost,
  type EpisodesResponse,
  type HostResult,
  type SearchQuery,
  type SearchResponse,
} from "./CardHost.js";

const API_HOST = "pokemon-tcg-api.p.rapidapi.com";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paging(json: any, page: number) {
  const current = Number(json?.paging?.current);
  const total = Number(json?.paging?.total);
  return {
    page: Number.isFinite(current) && current > 0 ? current : page,
    totalPages: Number.isFinite(total) && total > 0 ? total : 1,
  };
}

export class TcggoHost extends CardHost {
  readonly id: HostId = "tcggo";
  readonly envKeyVar = "RAPIDAPI_KEY";

  private headers(key: string): Record<string, string> {
    return { "x-rapidapi-key": key, "x-rapidapi-host": API_HOST };
  }

  searchCards(
    { query, episode, sort, page }: SearchQuery,
    key: string,
  ): Promise<HostResult<SearchResponse>> {
    if (typeof episode === "string") {
      return Promise.resolve({
        status: 400,
        body: { error: "Invalid set" },
      });
    }
    const base =
      episode !== null
        ? `https://${API_HOST}/episodes/${episode}/cards`
        : `https://${API_HOST}/cards`;
    const search = query ? `search=${encodeURIComponent(query)}&` : "";
    const url = `${base}?${search}sort=${sort}&per_page=20&page=${page}`;
    return this.requestJson(
      url,
      this.headers(key),
      `search q="${query}" episode=${episode ?? "-"} sort=${sort} page=${page}`,
      (json) => {
        const data: unknown[] = Array.isArray(json?.data) ? json.data : [];
        const cards = data
          .map(normalizeCard)
          .filter((c): c is CardInfo => c !== null);
        return {
          value: { cards, ...paging(json, page) },
          summary: `${cards.length} cartas`,
        };
      },
    );
  }

  listEpisodes(
    page: number,
    key: string,
  ): Promise<HostResult<EpisodesResponse>> {
    return this.requestJson(
      `https://${API_HOST}/episodes?page=${page}`,
      this.headers(key),
      `episodes page=${page}`,
      (json) => {
        const data: unknown[] = Array.isArray(json?.data) ? json.data : [];
        const episodes = data
          .map(normalizeEpisode)
          .filter((e): e is EpisodeInfo => e !== null);
        return {
          value: { episodes, ...paging(json, page) },
          summary: `${episodes.length} colecciones`,
        };
      },
    );
  }
}
