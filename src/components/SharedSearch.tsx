import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatEur, loadEpisodes, priceFor, searchCards, type SearchParams, type SortOption } from '../api';
import type { CardInfo, EpisodeInfo, PriceLang } from '../types';
import EpisodePicker from './EpisodePicker';

interface Props {
  onGive: (card: CardInfo) => void;
  onReceive: (card: CardInfo) => void;
  lang: PriceLang;
  onLangChange: (lang: PriceLang) => void;
}

export default function SharedSearch({ onGive, onReceive, lang, onLangChange }: Props) {
  const [query, setQuery] = useState('');
  const [episode, setEpisode] = useState<number | null>(null);
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

  useEffect(() => {
    let alive = true;
    loadEpisodes()
      .then((list) => {
        if (alive) setEpisodes(list);
      })
      .catch((e) => {
        if (alive) setEpisodesError(e instanceof Error ? e.message : 'No se pudieron cargar las colecciones');
      })
      .finally(() => {
        if (alive) setEpisodesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const canSearch = (query.trim().length >= 2 || episode !== null) && !loading;

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
      setError(e instanceof Error ? e.message : 'Error de búsqueda');
      setCards([]);
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    void run({ q: query.trim(), episode, sort, page: 1 });
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
      <form className="search-form" onSubmit={onSubmit}>
        <label>
          Carta
          <input
            type="search"
            placeholder="Nombre (mín. 2 letras)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="field">
          <span className="field-label">Colección</span>
          {episodesLoading ? (
            <p className="muted field-note">Cargando colecciones…</p>
          ) : (
            <>
              <EpisodePicker episodes={episodes} value={episode} onChange={setEpisode} />
              {episodesError && (
                <p className="error field-note">
                  {episodesError}. Puedes buscar sin colección.
                </p>
              )}
            </>
          )}
        </div>
        <label>
          Idioma del precio
          <select value={lang} onChange={(e) => onLangChange(e.target.value as PriceLang)}>
            <option value="EU">EU</option>
            <option value="DE">DE</option>
            <option value="ES">ES</option>
          </select>
        </label>
        <label>
          Ordenar por
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
            <option value="relevance">Relevancia</option>
            <option value="price_highest">Precio: mayor primero</option>
            <option value="price_lowest">Precio: menor primero</option>
          </select>
        </label>
        <button type="submit" className="primary" disabled={!canSearch}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {sent && (
        <div className="results-box">
          {error && <p className="error">{error}</p>}
          {loading && !error && <p className="muted">Buscando…</p>}
          {!loading && !error && cards.length === 0 && <p className="muted">Sin resultados</p>}
          {cards.length > 0 && (
            <div className="table-wrap">
              <table className="cards-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Carta</th>
                    <th>Colección</th>
                    <th>Nº</th>
                    <th>Rareza</th>
                    <th>Precio</th>
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
                      <td className={priceFor(c, lang) === null ? 'price muted' : 'price'}>
                        {priceFor(c, lang) === null ? 'sin precio' : formatEur(priceFor(c, lang)!)}
                      </td>
                      <td className="actions">
                        <button
                          type="button"
                          className={flash === `${c.id}-give` ? 'added' : ''}
                          onClick={() => add('give', c)}
                        >
                          Ofrezco
                        </button>
                        <button
                          type="button"
                          className={flash === `${c.id}-receive` ? 'added' : ''}
                          onClick={() => add('receive', c)}
                        >
                          Recibo
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
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button type="button" disabled={loading || page >= totalPages} onClick={() => goTo(page + 1)}>
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
