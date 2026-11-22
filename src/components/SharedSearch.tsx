import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  currentHost,
  formatEur,
  loadEpisodes,
  priceFor,
  searchCards,
  type SearchParams,
  type SortOption,
} from '../api';
import type { HostId, HostInfo } from '../hostCatalog';
import { PRICE_LANGS, type CardInfo, type EpisodeInfo, type PriceLang } from '../types';
import AuthModal from './AuthModal';
import EpisodePicker from './EpisodePicker';

const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevance',
  price_highest: 'Price: high to low',
  price_lowest: 'Price: low to high',
};
const SORT_LABELS_ORDER = Object.keys(SORT_LABELS) as SortOption[];

/** Precio en el idioma elegido; si no existe se muestra el EU, que es el que se conserva al añadir. */
const priceShown = (c: CardInfo, lang: PriceLang) => priceFor(c, lang) ?? priceFor(c, 'EU');

interface Props {
  onGive: (card: CardInfo) => void;
  onReceive: (card: CardInfo) => void;
  lang: PriceLang;
  onLangChange: (lang: PriceLang) => void;
}

export default function SharedSearch({ onGive, onReceive, lang, onLangChange }: Props) {
  const [query, setQuery] = useState('');
  const [episode, setEpisode] = useState<string | number | null>(null);
  const [sort, setSort] = useState<SortOption>('relevance');

  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  const [sent, setSent] = useState<SearchParams | null>(null);
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);

  const [host, setHost] = useState<HostInfo>(currentHost);
  const hostIdRef = useRef<HostId>(host.id);
  const { capabilities } = host;
  const episodeEff = capabilities.episodes ? episode : null;

  useEffect(() => {
    let alive = true;
    const next = currentHost();
    if (next.id !== hostIdRef.current) {
      // Cambio de host: se descarta lo mostrado del anterior.
      hostIdRef.current = next.id;
      abortRef.current?.abort();
      setEpisode(null);
      setEpisodes([]);
      setSent(null);
      setCards([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      setError(null);
    }
    setHost(next);
    setSort((s) => (next.capabilities.sorts.includes(s) ? s : 'relevance'));
    setEpisodesLoading(true);
    setEpisodesError(null);
    // La caché de colecciones es por host, basta con pedirla sin forzar.
    loadEpisodes()
      .then((list) => {
        if (alive) setEpisodes(list);
      })
      .catch((e) => {
        if (alive) setEpisodesError(e instanceof Error ? e.message : 'Could not load sets');
      })
      .finally(() => {
        if (alive) setEpisodesLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authVersion]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const canSearch = (query.trim().length >= 2 || episodeEff !== null) && !loading;

  async function run(params: SearchParams) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSent(params);
    setLoading(true);
    setError(null);
    try {
      const res = await searchCards(params, ctrl.signal);
      setCards(res.cards);
      setPage(res.page);
      setTotalPages(res.totalPages);
      setLoading(false);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Search error');
      setCards([]);
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    void run({ q: query.trim(), episode: episodeEff, sort, page: 1 });
  }

  function goTo(p: number) {
    if (!sent || loading) return;
    void run({ ...sent, page: p });
  }

  function add(kind: 'give' | 'receive', c: CardInfo) {
    (kind === 'give' ? onGive : onReceive)(c);
    setFlash(`${c.id}-${kind}`);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 900);
  }

  return (
    <section className="shared-search">
      <form id="shared-search-form" className="search-form" onSubmit={onSubmit}>
        <label>
          Card
          <input
            type="search"
            placeholder="Name (min. 2 letters)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {capabilities.episodes && (
          <div className="field">
            <span className="field-label">Set</span>
            {episodesLoading ? (
              <p className="muted field-note">Loading sets…</p>
            ) : (
              <>
                <EpisodePicker episodes={episodes} value={episode} onChange={setEpisode} />
                {episodesError && (
                  <p className="error field-note">
                    {episodesError}. You can still search without a set.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        <label>
          Price language
          <select value={lang} onChange={(e) => onLangChange(e.target.value as PriceLang)}>
            {PRICE_LANGS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
            {SORT_LABELS_ORDER.filter((s) => capabilities.sorts.includes(s)).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </form>
      <div className="search-actions">
        <button type="submit" form="shared-search-form" className="primary" disabled={!canSearch}>
          {loading ? 'Searching…' : 'Search'}
        </button>
        <button type="button" onClick={() => setAuthOpen(true)}>
          Authenticate
        </button>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSaved={() => setAuthVersion((v) => v + 1)} />

      {sent && (
        <div className="results-box">
          {error && <p className="error">{error}</p>}
          {loading && !error && <p className="muted">Searching…</p>}
          {!loading && !error && cards.length === 0 && <p className="muted">No results</p>}
          {cards.length > 0 && (
            <div className="table-wrap">
              <table className="cards-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Card</th>
                    <th>Set</th>
                    <th>No.</th>
                    <th>Rarity</th>
                    <th>Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className={loading ? 'stale' : ''}>
                  {cards.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.image ? <img src={c.image} alt="" loading="lazy" /> : <div className="thumb-empty" />}
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.setName ?? '—'}</td>
                      <td>{c.cardNumber ?? '—'}</td>
                      <td>{c.rarity ?? '—'}</td>
                      <td className={priceShown(c, lang) === null ? 'price muted' : 'price'}>
                        {priceShown(c, lang) === null ? 'no price' : formatEur(priceShown(c, lang)!)}
                      </td>
                      <td className="actions">
                        <button
                          type="button"
                          className={flash === `${c.id}-give` ? 'added' : ''}
                          onClick={() => add('give', c)}
                        >
                          Give
                        </button>
                        <button
                          type="button"
                          className={flash === `${c.id}-receive` ? 'added' : ''}
                          onClick={() => add('receive', c)}
                        >
                          Receive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(cards.length > 0 || page > 1) && (
            <div className="pager">
              <button type="button" disabled={loading || page <= 1} onClick={() => goTo(page - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button type="button" disabled={loading || page >= totalPages} onClick={() => goTo(page + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
