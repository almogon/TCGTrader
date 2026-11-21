// Shared types between UI (P1) and trade engine (P2). Do not change without coordinating.

/** Idioma/mercado del precio de Cardmarket. */
export type PriceLang = 'EU' | 'DE' | 'ES';

/** Card as returned by our /api/search proxy, normalized. */
export interface CardInfo {
  id: number;
  name: string;
  cardNumber: string | null;
  rarity: string | null;
  setName: string | null;
  image: string | null;
  /** Market value in EUR (Cardmarket 30d average, fallback lowest_near_mint). null = no price. */
  price: number | null;
  /** Lowest near mint price per market. Optional: old cards saved in localStorage lack it. */
  prices?: Record<PriceLang, number | null>;
}

/** Collection (episode/set) as returned by our /api/episodes proxy, normalized. */
export interface EpisodeInfo {
  id: number;
  name: string;
  code: string | null;
  logo: string | null;
  releasedAt: string | null;
  series: string | null;
}

/** A card placed in the "Ofrezco" or "Recibo" bag. */
export interface Card extends CardInfo {
  /** Unique per bag entry (the same card can be added twice). */
  uid: string;
  /** Pinned cards appear in every combination of their side. */
  pinned: boolean;
  /** Precio editado por el usuario (EUR). Ausente o null = sin edición (se usa el de la API). */
  customPrice?: number | null;
  /** Idioma del precio de esta carta. Si falta, 'EU'. */
  lang?: PriceLang;
}

export interface TradeOptions {
  /** Allowed difference as % of the larger side total (e.g. 10 = ±10 %). */
  tolerancePct: number;
  maxResults: number;
}

export interface TradeSide {
  cards: Card[];
  total: number;
}

export interface TradeOption {
  give: TradeSide;
  receive: TradeSide;
  /** receive.total - give.total (positive = user gains value). */
  diff: number;
  /** |diff| / max(give.total, receive.total) * 100 */
  diffPct: number;
}

export interface TradeResult {
  options: TradeOption[];
  /** Smallest |diffPct| found overall (even outside tolerance); null if no combination possible. */
  bestDiffPct: number | null;
  /** Human-readable reason when options is empty (e.g. too many optional cards, no priced cards). */
  error: string | null;
}

export const MAX_OPTIONAL_PER_SIDE = 15;
