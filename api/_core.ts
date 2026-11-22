import { DEFAULT_HOST_ID, type SortOption } from "../src/hostCatalog.js";
import type {
  CardHost,
  EpisodesResponse,
  HostResult,
  SearchResponse,
} from "./_hosts/CardHost.js";
import { getHost } from "./_hosts/index.js";

export type HandlerResult = HostResult<SearchResponse>;
export type EpisodesHandlerResult = HostResult<EpisodesResponse>;

export interface SearchParams {
  q?: string | null;
  episode?: string | null;
  sort?: string | null;
  page?: string | null;
}

/**
 * Picks the host and key for a request: `x-tcg-host` (a host id) and `x-tcg-key` headers sent by
 * the browser (set in the "Authenticate" modal) override the default host and the server's env key.
 */
export function resolveHost(
  headers: Record<string, string | string[] | undefined>,
  env: Record<string, string | undefined>,
): { host: CardHost; key: string } | { error: string; status: number } {
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || "";
  const host = getHost(one(headers["x-tcg-host"]) || DEFAULT_HOST_ID);
  if (!host) return { status: 400, error: "Invalid host" };
  const key = one(headers["x-tcg-key"]) || env[host.envKeyVar] || "";
  if (!key) {
    return {
      status: 500,
      error: `Missing API key: set it in Authenticate or in ${host.envKeyVar}`,
    };
  }
  return { host, key };
}

function parsePage(pageParam: string | null | undefined): number {
  const pageNum = parseInt(pageParam ?? "1", 10);
  return Number.isFinite(pageNum) && pageNum >= 1 && pageNum <= 1000
    ? pageNum
    : 1;
}

const NO_EPISODES = "This host does not support sets";

/** Validates params against the host capabilities and delegates the search to the host. */
export async function handleSearch(
  params: SearchParams,
  host: CardHost,
  key: string,
): Promise<HandlerResult> {
  const query = (params.q ?? "").trim();
  if (query && (query.length < 2 || query.length > 60)) {
    return {
      status: 400,
      body: {
        error: "Search text must be between 2 and 60 characters",
      },
    };
  }
  const episodeRaw = (params.episode ?? "").trim();
  let episode: string | number | null = null;
  if (episodeRaw) {
    if (/^\d+$/.test(episodeRaw)) {
      const n = parseInt(episodeRaw, 10);
      if (n <= 0) {
        return { status: 400, body: { error: "Invalid set" } };
      }
      episode = n;
    } else if (/^[a-z0-9][a-z0-9-]{0,99}$/.test(episodeRaw)) {
      episode = episodeRaw;
    } else {
      return { status: 400, body: { error: "Invalid set" } };
    }
  }
  if (!query && episode === null) {
    return {
      status: 400,
      body: { error: "Enter a card name or a set" },
    };
  }
  if (episode !== null && !host.capabilities.episodes) {
    return { status: 400, body: { error: NO_EPISODES } };
  }
  const requested = params.sort as SortOption;
  const sort: SortOption = host.capabilities.sorts.includes(requested)
    ? requested
    : "relevance";
  return host.searchCards(
    { query, episode, sort, page: parsePage(params.page) },
    key,
  );
}

/** Delegates the episodes listing (one page) to the host. */
export async function handleEpisodes(
  pageParam: string | null | undefined,
  host: CardHost,
  key: string,
): Promise<EpisodesHandlerResult> {
  if (!host.capabilities.episodes) {
    return { status: 400, body: { error: NO_EPISODES } };
  }
  return host.listEpisodes(parsePage(pageParam), key);
}
