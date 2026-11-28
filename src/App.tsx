import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import BagColumn from './components/BagColumn';
import SharedSearch from './components/SharedSearch';
import TradeResults from './components/TradeResults';
import { findTrades } from './tradeEngine';
import { priceFor, resolveBag } from './api';
import { isPriceLang, type Card, type CardInfo, type PriceLang, type TradeResult } from './types';

const STORAGE_KEY = 'tcg-trader-state-v1';

type SetCards = Dispatch<SetStateAction<Card[]>>;

interface Saved {
  give: Card[];
  receive: Card[];
  tolerancePct: number;
  maxResults: number;
  lang: PriceLang;
}

/** Descarta un customPrice que no sea número > 0. */
function cleanCard(c: Card): Card {
  const cp = c?.customPrice;
  const ok = typeof cp === 'number' && Number.isFinite(cp) && cp > 0;
  const l = c?.lang;
  return { ...c, customPrice: ok ? cp : null, lang: isPriceLang(l) ? l : undefined };
}

function load(): Saved {
  const def: Saved = { give: [], receive: [], tolerancePct: 10, maxResults: 10, lang: 'EU' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<Saved>;
    return {
      give: Array.isArray(p.give) ? p.give.map(cleanCard) : [],
      receive: Array.isArray(p.receive) ? p.receive.map(cleanCard) : [],
      tolerancePct: typeof p.tolerancePct === 'number' ? p.tolerancePct : 10,
      maxResults: typeof p.maxResults === 'number' ? p.maxResults : 10,
      lang: isPriceLang(p.lang) ? p.lang : 'EU',
    };
  } catch {
    return def;
  }
}

const newUid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function App() {
  const [initial] = useState(load);
  const [give, setGive] = useState<Card[]>(initial.give);
  const [receive, setReceive] = useState<Card[]>(initial.receive);
  const [tolerancePct, setTolerancePct] = useState(initial.tolerancePct);
  const [maxResults, setMaxResults] = useState(initial.maxResults);
  const [lang, setLang] = useState<PriceLang>(initial.lang);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [snapshot, setSnapshot] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ give, receive, tolerancePct, maxResults, lang }));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [give, receive, tolerancePct, maxResults, lang]);

  const currentKey = useMemo(
    () => JSON.stringify({ give, receive, tolerancePct, maxResults }),
    [give, receive, tolerancePct, maxResults],
  );

  const giveP = useMemo(() => resolveBag(give), [give]);
  const receiveP = useMemo(() => resolveBag(receive), [receive]);

  // Sin precio en el idioma elegido: se conserva el precio que se mostraba (EU) como precio fijado.
  const add = (set: SetCards) => (info: CardInfo) => {
    const kept = priceFor(info, lang) === null ? priceFor(info, 'EU') : null;
    set((prev) => [...prev, { ...info, uid: newUid(), pinned: false, lang, customPrice: kept }]);
  };
  const toggle = (set: SetCards) => (uid: string) =>
    set((prev) => prev.map((c) => (c.uid === uid ? { ...c, pinned: !c.pinned } : c)));
  const setPrice = (set: SetCards) => (uid: string, value: number | null) =>
    set((prev) => prev.map((c) => (c.uid === uid ? { ...c, customPrice: value } : c)));
  const setCardLang = (set: SetCards) => (uid: string, l: PriceLang) =>
    set((prev) =>
      prev.map((c) => {
        if (c.uid !== uid) return c;
        // Sin precio en el idioma nuevo: se conserva el precio actual como precio fijado.
        const current = resolveBag([c])[0].price;
        const keep = priceFor(c, l) === null && current !== null;
        return { ...c, lang: l, customPrice: keep ? current : c.customPrice };
      }),
    );
  const remove = (set: SetCards) => (uid: string) => set((prev) => prev.filter((c) => c.uid !== uid));

  function runTrade() {
    setResult(findTrades(giveP, receiveP, { tolerancePct, maxResults }));
    setSnapshot(currentKey);
  }

  function clearAll() {
    setGive([]);
    setReceive([]);
    setResult(null);
    setSnapshot('');
  }

  return (
    <div className="app">
      <header>
        <h1>TCG Trader</h1>
        <p className="muted">Find balanced Pokémon card trades based on Cardmarket prices.</p>
      </header>

      <SharedSearch onGive={add(setGive)} onReceive={add(setReceive)} lang={lang} onLangChange={setLang} />

      <main className="board">
        <BagColumn
          title="I give"
          cards={giveP}
          onPriceChange={setPrice(setGive)}
          onLangChange={setCardLang(setGive)}
          onTogglePin={toggle(setGive)}
          onRemove={remove(setGive)}
        />
        <div className="center">
          <button type="button" className="trade" onClick={runTrade}>
            Trade
          </button>
          <label>
            Tolerance (%)
            <input
              type="number"
              min={0}
              max={50}
              value={tolerancePct}
              onChange={(e) => setTolerancePct(clamp(Number(e.target.value) || 0, 0, 50))}
            />
          </label>
          <label>
            Max results
            <input
              type="number"
              min={1}
              max={50}
              value={maxResults}
              onChange={(e) => setMaxResults(clamp(Math.round(Number(e.target.value)) || 1, 1, 50))}
            />
          </label>
          <button type="button" className="danger" onClick={clearAll}>
            Clear
          </button>
        </div>
        <BagColumn
          title="I receive"
          cards={receiveP}
          onPriceChange={setPrice(setReceive)}
          onLangChange={setCardLang(setReceive)}
          onTogglePin={toggle(setReceive)}
          onRemove={remove(setReceive)}
        />
      </main>

      {result && <TradeResults result={result} tolerancePct={tolerancePct} stale={snapshot !== currentKey} />}
    </div>
  );
}
