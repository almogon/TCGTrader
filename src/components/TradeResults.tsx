import { useEffect, useState } from 'react';
import { formatEur } from '../api';
import type { Card, TradeResult } from '../types';

interface Props {
  result: TradeResult;
  tolerancePct: number;
  stale: boolean;
}

function CardList({ cards }: { cards: Card[] }) {
  return (
    <ul className="res-cards">
      {cards.map((c) => (
        <li key={c.uid}>
          <span>
            {c.pinned && <span title="Fija">📌 </span>}
            {c.name}
          </span>
          <span>{c.price !== null ? formatEur(c.price) : '—'}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TradeResults({ result, tolerancePct, stale }: Props) {
  const { options, bestDiffPct, error } = result;
  // Emparejamientos marcados para el PDF; por defecto todos, y se reinicia con cada resultado nuevo.
  const [selected, setSelected] = useState<Set<number>>(() => new Set(options.map((_, i) => i)));
  useEffect(() => setSelected(new Set(options.map((_, i) => i))), [options]);
  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <section className="results">
      <div className="results-head">
        <h2>Resultados</h2>
        {options.length > 0 && (
          <button type="button" className="no-print" disabled={selected.size === 0} onClick={() => window.print()}>
            Descargar PDF
          </button>
        )}
      </div>
      {stale && (
        <p className="warn">Resultados desactualizados: las cartas o los ajustes han cambiado. Pulsa Trade de nuevo.</p>
      )}
      {options.length === 0 ? (
        <p className="error">
          {error ??
            (bestDiffPct !== null
              ? `Ninguna combinación dentro de ±${tolerancePct} %. La más cercana difiere un ${bestDiffPct.toFixed(1)} %`
              : 'No hay combinaciones posibles.')}
        </p>
      ) : (
        <div className={stale ? 'stale' : ''}>
          {options.map((o, i) => {
            const balanced = Math.abs(o.diffPct) < 0.5;
            const verdict = balanced
              ? 'Equilibrado'
              : o.diff > 0
                ? `Ganas ${formatEur(o.diff)}`
                : `Pierdes ${formatEur(-o.diff)}`;
            const cls = balanced ? 'even' : o.diff > 0 ? 'gain' : 'loss';
            return (
              <article key={i} className={selected.has(i) ? 'option' : 'option no-print'}>
                <div className="option-cols">
                  <div>
                    <h3>Doy</h3>
                    <CardList cards={o.give.cards} />
                    <p className="side-total">{formatEur(o.give.total)}</p>
                  </div>
                  <div>
                    <h3>Recibo</h3>
                    <CardList cards={o.receive.cards} />
                    <p className="side-total">{formatEur(o.receive.total)}</p>
                  </div>
                </div>
                <div className="option-foot no-print">
                  <p className={`verdict ${cls}`}>
                    {verdict} ({o.diff > 0 ? '+' : ''}
                    {formatEur(o.diff)} · {o.diffPct.toFixed(1)} %)
                  </p>
                  <label className="option-pick">
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                    Descargar
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
