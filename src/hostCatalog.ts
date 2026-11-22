// Catálogo de hosts compartido entre el servidor (api/_hosts) y la UI. Sin dependencias de servidor ni del DOM.
import type { PriceLang } from './types';

export const SORT_OPTIONS = ['relevance', 'price_highest', 'price_lowest'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const HOST_IDS = ['tcggo', 'apitcg'] as const;
export type HostId = (typeof HOST_IDS)[number];

export const isHostId = (v: unknown): v is HostId =>
  typeof v === 'string' && (HOST_IDS as readonly string[]).includes(v);

/** Qué admite un host; la UI oculta o desactiva lo que no esté aquí. */
export interface HostCapabilities {
  /** Búsqueda y listado por colección (episodio). */
  episodes: boolean;
  /** Ordenaciones admitidas; siempre incluye 'relevance'. */
  sorts: readonly SortOption[];
  /** Idiomas con precio propio; el resto cae al precio EU. */
  pricedLangs: readonly PriceLang[];
}

export interface HostInfo {
  id: HostId;
  label: string;
  capabilities: HostCapabilities;
}

export const HOST_CATALOG: Record<HostId, HostInfo> = {
  tcggo: {
    id: 'tcggo',
    label: 'TCGGO (RapidAPI)',
    capabilities: {
      episodes: true,
      sorts: SORT_OPTIONS,
      pricedLangs: ['EU', 'DE', 'ES'],
    },
  },
  apitcg: {
    id: 'apitcg',
    label: 'API TCG',
    capabilities: {
      episodes: true,
      sorts: SORT_OPTIONS,
      pricedLangs: ['EU'],
    },
  },
};

export const DEFAULT_HOST_ID: HostId = 'tcggo';
