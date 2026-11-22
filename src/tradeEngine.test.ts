import { describe, it, expect } from 'vitest';
import { findTrades } from './tradeEngine';
import type { Card, TradeOptions } from './types';

let seq = 0;
function card(id: number, price: number | null, pinned = false): Card {
  seq++;
  return {
    id,
    name: `card${id}`,
    cardNumber: null,
    rarity: null,
    setName: null,
    image: null,
    price,
    uid: `u${seq}`,
    pinned,
  };
}

const opts = (tolerancePct: number, maxResults = 50): TradeOptions => ({ tolerancePct, maxResults });
const ids = (cards: Card[]) => cards.map((c) => c.id).sort((a, b) => a - b);

describe('findTrades', () => {
  it('finds a balanced trade', () => {
    const r = findTrades([card(1, 10)], [card(2, 10)], opts(5));
    expect(r.error).toBeNull();
    expect(r.options).toHaveLength(1);
    expect(r.options[0].diff).toBe(0);
    expect(r.options[0].diffPct).toBe(0);
    expect(r.bestDiffPct).toBe(0);
  });

  it('respects tolerance', () => {
    const inside = findTrades([card(1, 10)], [card(2, 11)], opts(10));
    expect(inside.options).toHaveLength(1);
    expect(inside.options[0].diff).toBe(1);
    const outside = findTrades([card(1, 10)], [card(2, 12)], opts(10));
    expect(outside.options).toHaveLength(0);
    expect(outside.error).toBeNull();
    expect(outside.bestDiffPct).toBe(16.67);
  });

  it('includes pinned cards in every option', () => {
    const give = [card(1, 10, true), card(2, 5), card(3, 3)];
    const r = findTrades(give, [card(9, 13)], opts(50));
    expect(r.options.length).toBeGreaterThan(1);
    for (const o of r.options) expect(ids(o.give.cards)).toContain(1);
  });

  it('single combination when a side is all pinned', () => {
    const r = findTrades([card(1, 5, true), card(2, 5, true)], [card(9, 10)], opts(5));
    expect(r.options).toHaveLength(1);
    expect(ids(r.options[0].give.cards)).toEqual([1, 2]);
  });

  it('never uses the empty subset when there are no pinned cards', () => {
    const r = findTrades([card(1, 5), card(2, 5)], [card(9, 5)], opts(1000));
    for (const o of r.options) {
      expect(o.give.cards.length).toBeGreaterThan(0);
      expect(o.receive.cards.length).toBeGreaterThan(0);
    }
    expect(r.options).toHaveLength(3);
  });

  it('pinned cards exceeding tolerance give empty options and correct bestDiffPct', () => {
    const give = [card(1, 100, true), card(2, 1)];
    const r = findTrades(give, [card(9, 50)], opts(10));
    expect(r.options).toHaveLength(0);
    expect(r.error).toBeNull();
    // closest: give 100 vs receive 50 -> 50 %
    expect(r.bestDiffPct).toBe(50);
  });

  it('deduplicates interchangeable duplicates', () => {
    const give = [card(1, 5), card(1, 5)];
    const r = findTrades(give, [card(9, 5)], opts(1000));
    // {1} and {1,1}
    expect(r.options).toHaveLength(2);
  });

  it('ignores cards without price', () => {
    const r = findTrades([card(1, 10), card(2, null)], [card(9, 10)], opts(5));
    expect(r.options).toHaveLength(1);
    expect(ids(r.options[0].give.cards)).toEqual([1]);
  });

  it('errors when a side has no priced cards', () => {
    const r = findTrades([card(1, null)], [card(9, 10)], opts(5));
    expect(r.options).toEqual([]);
    expect(r.bestDiffPct).toBeNull();
    expect(r.error).toBe('Each side needs at least one card with a price');
  });

  it('errors with more than 15 optional cards on a side', () => {
    const many = Array.from({ length: 16 }, (_, i) => card(i + 1, 1));
    const r = findTrades(many, [card(99, 5)], opts(10));
    expect(r.options).toEqual([]);
    expect(r.error).toBe('Maximum 15 optional cards per side');
    const ok = findTrades(many.slice(0, 15), [card(99, 5)], opts(10));
    expect(ok.error).toBeNull();
  });

  it('orders by diffPct, then more cards, then higher value; and caps maxResults', () => {
    const give = [card(1, 10)];
    const receive = [card(2, 10), card(3, 5), card(4, 5), card(5, 9.5)];
    const r = findTrades(give, receive, opts(10));
    // exact matches first: {2} (1 card) vs {3,4} (2 cards) -> more cards first
    expect(r.options[0].diffPct).toBe(0);
    expect(ids(r.options[0].receive.cards)).toEqual([3, 4]);
    expect(ids(r.options[1].receive.cards)).toEqual([2]);
    for (let i = 1; i < r.options.length; i++) {
      expect(r.options[i].diffPct).toBeGreaterThanOrEqual(r.options[i - 1].diffPct);
    }
    const capped = findTrades(give, receive, opts(10, 2));
    expect(capped.options).toHaveLength(2);
    expect(capped.options).toEqual(r.options.slice(0, 2));
  });
});
