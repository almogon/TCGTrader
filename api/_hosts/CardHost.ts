import type { CardInfo, EpisodeInfo } from "../../src/types";
import {
  HOST_CATALOG,
  type HostCapabilities,
  type HostId,
  type SortOption,
} from "../../src/hostCatalog.js";

export interface SearchQuery {
  /** Texto ya validado (puede ir vacío si hay colección). */
  query: string;
  episode: string | number | null;
  sort: SortOption;
  page: number;
}

export interface SearchResponse {
  cards: CardInfo[];
  page: number;
  totalPages: number;
}

export interface EpisodesResponse {
  episodes: EpisodeInfo[];
  page: number;
  totalPages: number;
}

export interface HostResult<T> {
  status: number;
  body: T | { error: string };
}

/** Proveedor de cartas. Cada host concreto traduce a/desde su API y devuelve el formato común. */
export abstract class CardHost {
  abstract readonly id: HostId;
  /** Variable de entorno con la clave por defecto del servidor. */
  abstract readonly envKeyVar: string;

  get label(): string {
    return HOST_CATALOG[this.id].label;
  }

  get capabilities(): HostCapabilities {
    return HOST_CATALOG[this.id].capabilities;
  }

  abstract searchCards(
    q: SearchQuery,
    key: string,
  ): Promise<HostResult<SearchResponse>>;

  abstract listEpisodes(
    page: number,
    key: string,
  ): Promise<HostResult<EpisodesResponse>>;

  /** Resume las cabeceras de cuota `x-ratelimit-*` (nunca incluye la clave). */
  protected rateLimitInfo(h: Headers): string {
    const parts: string[] = [];
    h.forEach((value, name) => {
      if (name.toLowerCase().startsWith("x-ratelimit-"))
        parts.push(`${name.slice(12)}=${value}`);
    });
    return parts.length
      ? `cuota: ${parts.join(", ")}`
      : "cuota: (sin cabeceras)";
  }

  /**
   * GET JSON con log y mapeo de errores común. `parse` convierte el JSON en la respuesta
   * y un resumen para el log (p. ej. "20 cartas").
   */
  protected async requestJson<T>(
    url: string,
    headers: Record<string, string>,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parse: (json: any) => { value: T; summary: string },
  ): Promise<HostResult<T>> {
    const tag = `[${this.id}]`;
    const started = Date.now();
    console.log(`${tag} → GET ${description}`);
    try {
      const r = await fetch(url, { headers });
      const ms = Date.now() - started;
      const quota = this.rateLimitInfo(r.headers);
      if (!r.ok) {
        const bodyText = (await r.text().catch(() => "")).slice(0, 300);
        console.error(
          `${tag} ← ${r.status} en ${ms} ms · ${quota} · respuesta: ${bodyText || "(vacía)"}`,
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
      const { value, summary } = parse(json);
      console.log(`${tag} ← ${r.status} en ${ms} ms · ${summary} · ${quota}`);
      return { status: 200, body: value };
    } catch (e) {
      console.error(
        `${tag} ✕ error de red tras ${Date.now() - started} ms: ${e instanceof Error ? e.message : String(e)}`,
      );
      return {
        status: 502,
        body: { error: "No se pudo contactar con la API de cartas" },
      };
    }
  }
}
