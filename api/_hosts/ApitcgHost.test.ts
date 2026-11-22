import { describe, expect, it } from "vitest";
import {
  normalizeCard,
  normalizeEpisode,
  USD_TO_EUR,
} from "./ApitcgHost.js";

const RAW = {
  _id: 9804,
  type: "card",
  name: "Charizard ex",
  set: { _id: "pokemon-obsidian-flames", name: "Obsidian Flames" },
  code: "OBF-125",
  cardNumber: "125/197",
  images: [{ small: "s", medium: "m", large: "l" }],
  attributes: { Rarity: "Double Rare" },
  markets: { tcgplayer: { prices: { low: 1, mid: 2, high: 3, market: 10 } } },
};

describe("apitcg normalizeCard", () => {
  it("convierte USD a EUR y mapea campos", () => {
    expect(USD_TO_EUR).toBe(0.92);
    expect(normalizeCard(RAW)).toEqual({
      id: 9804,
      name: "Charizard ex",
      cardNumber: "125/197",
      rarity: "Double Rare",
      setName: "Obsidian Flames",
      image: "l",
      price: 9.2,
      prices: { EU: 9.2 },
    });
  });
  it("usa mid si no hay market y code si no hay cardNumber", () => {
    const c = normalizeCard({
      ...RAW,
      cardNumber: undefined,
      markets: { tcgplayer: { prices: { mid: 2 } } },
    });
    expect(c?.price).toBe(1.84);
    expect(c?.cardNumber).toBe("OBF-125");
  });
  it("sin precio ni imagen", () => {
    const c = normalizeCard({ ...RAW, markets: {}, images: [] });
    expect(c?.price).toBeNull();
    expect(c?.prices).toEqual({ EU: null });
    expect(c?.image).toBeNull();
  });
  it("descarta entradas inválidas", () => {
    expect(normalizeCard(null)).toBeNull();
    expect(normalizeCard({ _id: "x", name: "A" })).toBeNull();
    expect(normalizeCard({ _id: 1 })).toBeNull();
  });
});

describe("apitcg normalizeEpisode", () => {
  it("mapea una colección", () => {
    expect(
      normalizeEpisode({
        _id: "pokemon-obsidian-flames",
        name: "Obsidian Flames",
        code: "OBF",
        logo: "http://l",
        release_date: "2023-08-11",
        serie: "Scarlet & Violet",
      }),
    ).toEqual({
      id: "pokemon-obsidian-flames",
      name: "Obsidian Flames",
      code: "OBF",
      logo: "http://l",
      releasedAt: "2023-08-11",
      series: "Scarlet & Violet",
    });
  });
  it("campos opcionales a null y descarta sin id/nombre", () => {
    const e = normalizeEpisode({ _id: "a", name: "A", serie: { x: 1 } });
    expect(e?.series).toBeNull();
    expect(e?.releasedAt).toBeNull();
    expect(normalizeEpisode({ name: "A" })).toBeNull();
    expect(normalizeEpisode({ _id: "a" })).toBeNull();
  });
});
