import { afterEach, describe, expect, it, vi } from "vitest";
import { handleEpisodes, handleSearch, resolveHost } from "./_core.js";
import { getHost } from "./_hosts/index.js";
import { normalizeCard, normalizeEpisode } from "./_hosts/TcggoHost.js";

describe("resolveHost", () => {
  it("usa tcggo por defecto", () => {
    const r = resolveHost({}, { RAPIDAPI_KEY: "env" });
    expect("host" in r && r.host.id).toBe("tcggo");
  });
  it("rechaza hosts desconocidos con 400", () => {
    const r = resolveHost({ "x-tcg-host": "evil.com" }, { RAPIDAPI_KEY: "k" });
    expect(r).toEqual({ status: 400, error: "Invalid host" });
  });
  it("la key de cabecera gana al env", () => {
    const r = resolveHost({ "x-tcg-key": "hdr" }, { RAPIDAPI_KEY: "env" });
    expect("key" in r && r.key).toBe("hdr");
  });
  it("usa la key del env", () => {
    const r = resolveHost({}, { RAPIDAPI_KEY: "env" });
    expect("key" in r && r.key).toBe("env");
  });
  it("sin key devuelve 500", () => {
    const r = resolveHost({}, {});
    expect("status" in r && r.status).toBe(500);
    expect("error" in r && r.error).toContain("RAPIDAPI_KEY");
  });
});

describe("handleSearch / handleEpisodes", () => {
  const host = getHost("tcggo")!;
  afterEach(() => vi.restoreAllMocks());

  it("validaciones 400 sin fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const p of [
      { q: "a" },
      { q: "x".repeat(61) },
      { episode: "abc" },
      { episode: "0" },
      { episode: "Bad Slug!" },
      { episode: "pokemon-scarlet-violet" }, // slug: tcggo no lo admite
      {},
    ]) {
      expect((await handleSearch(p, host, "k")).status).toBe(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("apitcg admite colección slug y rechaza numérica sin fetch", async () => {
    const apitcg = getHost("apitcg")!;
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }),
    );
    expect(
      (await handleSearch({ episode: "pokemon-scarlet-violet" }, apitcg, "k"))
        .status,
    ).toBe(200);
    expect(String(spy.mock.calls[0][0])).toContain(
      "set=pokemon-scarlet-violet",
    );
    spy.mockClear();
    expect((await handleSearch({ episode: "12" }, apitcg, "k")).status).toBe(
      400,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("delega en el host y normaliza", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 1, name: "Pikachu" }],
          paging: { current: 2, total: 5 },
        }),
        { status: 200 },
      ),
    );
    const out = await handleSearch({ q: "pika", sort: "bogus", page: "2" }, host, "k");
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ page: 2, totalPages: 5 });
    expect(String(spy.mock.calls[0][0])).toContain("sort=relevance&per_page=20&page=2");
  });

  it("mapea 401 a error de clave", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await handleEpisodes("1", host, "k");
    expect(out).toEqual({ status: 502, body: { error: "Invalid API key" } });
  });
});

describe("TCGGO normalize", () => {
  it("normalizeCard", () => {
    const c = normalizeCard({
      id: 7,
      name: " Charizard ",
      card_number: "4",
      rarity: "Rare",
      image: "u",
      episode: { name: "Base" },
      prices: { cardmarket: { lowest_near_mint_EU_only: "10.5", lowest_near_mint_DE: 0 } },
    });
    expect(c).toMatchObject({
      id: 7,
      name: "Charizard",
      setName: "Base",
      price: 10.5,
      prices: { EU: 10.5, DE: null, ES: null },
    });
    expect(normalizeCard({ id: 1 })).toBeNull();
  });
  it("normalizeEpisode", () => {
    expect(
      normalizeEpisode({ id: 3, name: "Set", code: "S1", released_at: "2020", series: { name: "Ser" } }),
    ).toMatchObject({ id: 3, name: "Set", code: "S1", releasedAt: "2020", series: "Ser", logo: null });
    expect(normalizeEpisode({ id: 0, name: "x" })).toBeNull();
  });
});
