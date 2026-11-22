import { useState } from 'react';
import { formatEur } from '../api';
import { MAX_OPTIONAL_PER_SIDE, PRICE_LANGS, type Card, type PriceLang } from '../types';

interface Props {
  title: string;
  cards: Card[];
  onTogglePin: (uid: string) => void;
  onRemove: (uid: string) => void;
  onPriceChange: (uid: string, value: number | null) => void;
  onLangChange: (uid: string, lang: PriceLang) => void;
}

const fmtInput = (n: number | null) => (n === null ? '' : String(n));

function PriceInput({ card, onPriceChange }: { card: Card; onPriceChange: Props['onPriceChange'] }) {
  const [draft, setDraft] = useState<string | null>(null);
  const edited = typeof card.customPrice === 'number' && card.customPrice > 0;

  function commit() {
    if (draft === null) return;
    const n = parseFloat(draft.trim().replace(',', '.'));
    onPriceChange(card.uid, Number.isFinite(n) && n > 0 ? n : null);
    setDraft(null);
  }

  return (
    <span className={edited ? 'price-edit edited' : 'price-edit'}>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Price in euros"
        placeholder="no price"
        value={draft ?? fmtInput(card.price)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      <span>€</span>
      {edited && (
        <button
          type="button"
          className="restore"
          title="Restore API price"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setDraft(null);
            onPriceChange(card.uid, null);
          }}
        >
          ↺
        </button>
      )}
    </span>
  );
}

export default function BagColumn({ title, cards, onTogglePin, onRemove, onPriceChange, onLangChange }: Props) {
  const total = cards.reduce((s, c) => s + (c.price ?? 0), 0);
  const optional = cards.filter((c) => !c.pinned && c.price !== null).length;

  return (
    <section className="column">
      <h2>{title}</h2>
      {cards.length === 0 ? (
        <p className="muted empty">No cards yet.</p>
      ) : (
        <ul className="bag">
          {cards.map((c) => (
            <li key={c.uid} className={c.price === null ? 'dim' : ''}>
              {c.image ? <img src={c.image} alt="" loading="lazy" /> : <div className="thumb-empty" />}
              <div className="info">
                <strong>{c.name}</strong>
                <small>
                  {c.price === null ? 'No price: not counted' : ''}
                  {c.setName ? `${c.price === null ? ' · ' : ''}${c.setName}` : ''}
                </small>
              </div>
              {c.prices && (
                <select
                  className="lang-select"
                  aria-label="Price language"
                  value={c.lang ?? 'EU'}
                  onChange={(e) => onLangChange(c.uid, e.target.value as PriceLang)}
                >
                  {PRICE_LANGS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              <PriceInput card={c} onPriceChange={onPriceChange} />
              <button
                type="button"
                className={c.pinned ? 'pin active' : 'pin'}
                title="Pin: include in every combination"
                aria-pressed={c.pinned}
                onClick={() => onTogglePin(c.uid)}
              >
                📌
              </button>
              <button type="button" className="remove" title="Remove" onClick={() => onRemove(c.uid)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="totals">
        <span>
          Total: <strong>{formatEur(total)}</strong>
        </span>
        <span>Optional: {optional}</span>
      </div>
      {optional > MAX_OPTIONAL_PER_SIDE && (
        <p className="error">
          Too many optional cards ({optional} &gt; {MAX_OPTIONAL_PER_SIDE}). Pin some or remove others.
        </p>
      )}
    </section>
  );
}
