import { MAX_OPTIONAL_PER_SIDE } from './types';
import type { Card, TradeOption, TradeOptions, TradeResult } from './types';

/** Combination of one side. Totals are in integer cents to avoid float drift. */
interface Combo {
  cards: Card[];
  cents: number;
}

interface Candidate {
  g: Combo;
  r: Combo;
  diffPct: number;
  count: number;
  cents: number;
}

const EPS = 1e-9;

function toCents(price: number): number {
  return Math.round(price * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cardKey(c: Card): string {
  return `${c.id}:${toCents(c.price ?? 0)}:${c.pinned ? 1 : 0}`;
}

/** Enumerates every valid, de-duplicated combination of a side. */
function buildCombos(cards: Card[]): Combo[] {
  const fixed = cards.filter((c) => c.pinned);
  const optional = cards.filter((c) => !c.pinned);
  const n = optional.length;
  const fixedCents = fixed.reduce((s, c) => s + toCents(c.price ?? 0), 0);
  const optCents = optional.map((c) => toCents(c.price ?? 0));
  const fixedKeys = fixed.map(cardKey);
  const optKeys = optional.map(cardKey);

  const size = 1 << n;
  const sums = new Array<number>(size);
  sums[0] = 0;
  const seen = new Set<string>();
  const combos: Combo[] = [];

  for (let mask = 0; mask < size; mask++) {
    if (mask > 0) {
      const low = mask & -mask;
      sums[mask] = sums[mask & (mask - 1)] + optCents[31 - Math.clz32(low)];
    }
    if (mask === 0 && fixed.length === 0) continue; // at least one card per side

    const keys = fixedKeys.slice();
    const chosen: Card[] = fixed.slice();
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        keys.push(optKeys[i]);
        chosen.push(optional[i]);
      }
    }
    keys.sort();
    const key = keys.join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push({ cards: chosen, cents: fixedCents + sums[mask] });
  }
  return combos;
}

function diffPctOf(g: number, r: number): number {
  const m = Math.max(g, r);
  return m === 0 ? 0 : (Math.abs(r - g) / m) * 100;
}

/** First index whose cents >= value. */
function lowerBound(arr: Combo[], value: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].cents < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Negative = a is better than b. */
function compare(a: Candidate, b: Candidate): number {
  if (Math.abs(a.diffPct - b.diffPct) > EPS) return a.diffPct - b.diffPct;
  if (a.count !== b.count) return b.count - a.count;
  return b.cents - a.cents;
}

function toOption(c: Candidate): TradeOption {
  const g = c.g.cents / 100;
  const r = c.r.cents / 100;
  return {
    give: { cards: c.g.cards, total: round2(g) },
    receive: { cards: c.r.cards, total: round2(r) },
    diff: round2(r - g),
    diffPct: round2(c.diffPct),
  };
}

export function findTrades(give: Card[], receive: Card[], opts: TradeOptions): TradeResult {
  const giveP = give.filter((c) => c.price !== null);
  const recvP = receive.filter((c) => c.price !== null);

  if (giveP.length === 0 || recvP.length === 0) {
    return {
      options: [],
      bestDiffPct: null,
      error: 'Cada lado necesita al menos una carta con precio',
    };
  }

  const tooMany =
    giveP.filter((c) => !c.pinned).length > MAX_OPTIONAL_PER_SIDE ||
    recvP.filter((c) => !c.pinned).length > MAX_OPTIONAL_PER_SIDE;
  if (tooMany) {
    return {
      options: [],
      bestDiffPct: null,
      error: `Máximo ${MAX_OPTIONAL_PER_SIDE} cartas opcionales por lado`,
    };
  }

  const giveCombos = buildCombos(giveP);
  const recvCombos = buildCombos(recvP).sort((a, b) => a.cents - b.cents);
  if (giveCombos.length === 0 || recvCombos.length === 0) {
    return { options: [], bestDiffPct: null, error: null };
  }

  const t = Math.max(0, opts.tolerancePct) / 100;
  const maxResults = Math.max(0, Math.floor(opts.maxResults));
  let best: Candidate[] = [];
  let bestDiffPct: number | null = null;

  const trim = (): void => {
    best.sort(compare);
    if (best.length > maxResults) best.length = maxResults;
  };

  for (const g of giveCombos) {
    // Nearest neighbours on each side of g give the minimum diffPct for this g.
    const idx = lowerBound(recvCombos, g.cents);
    for (const j of [idx - 1, idx]) {
      if (j >= 0 && j < recvCombos.length) {
        const p = diffPctOf(g.cents, recvCombos[j].cents);
        if (bestDiffPct === null || p < bestDiffPct) bestDiffPct = p;
      }
    }

    // Window [g*(1-t), g/(1-t)], then exact filter.
    const lo = g.cents * (1 - t);
    const hi = t >= 1 ? Infinity : g.cents / (1 - t);
    for (let j = lowerBound(recvCombos, Math.floor(lo)); j < recvCombos.length; j++) {
      const r = recvCombos[j];
      if (r.cents > hi + EPS) break;
      const m = Math.max(g.cents, r.cents);
      if (Math.abs(r.cents - g.cents) > t * m + EPS) continue;
      best.push({
        g,
        r,
        diffPct: diffPctOf(g.cents, r.cents),
        count: g.cards.length + r.cards.length,
        cents: g.cents + r.cents,
      });
      if (best.length >= Math.max(64, maxResults * 2)) trim();
    }
  }
  trim();

  return {
    options: best.map(toOption),
    bestDiffPct: bestDiffPct === null ? null : round2(bestDiffPct),
    error: null,
  };
}
