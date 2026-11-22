import { useEffect, useMemo, useRef, useState } from 'react';
import type { EpisodeInfo } from '../types';

interface Props {
  episodes: EpisodeInfo[];
  value: string | number | null;
  onChange: (id: string | number | null) => void;
  disabled?: boolean;
}

function Logo({ src }: { src: string | null }) {
  return src ? <img src={src} alt="" loading="lazy" /> : <span className="ep-logo-empty" />;
}

export default function EpisodePicker({ episodes, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => episodes.find((e) => e.id === value) ?? null, [episodes, value]);

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return episodes;
    return episodes.filter((e) => e.name.toLowerCase().includes(f) || (e.code ?? '').toLowerCase().includes(f));
  }, [episodes, filter]);

  useEffect(() => {
    if (!open) return;
    filterRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id: string | number | null) {
    onChange(id);
    setOpen(false);
    setFilter('');
  }

  return (
    <div className="ep-picker" ref={rootRef}>
      <button
        type="button"
        className="ep-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <>
            <Logo src={selected.logo} />
            <span className="ep-name">{selected.name}</span>
          </>
        ) : (
          <span className="ep-name">All sets</span>
        )}
        <span className="ep-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="ep-panel">
          <input
            ref={filterRef}
            type="search"
            placeholder="Filter by name or code…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul role="listbox">
            <li>
              <button type="button" className={value === null ? 'ep-opt active' : 'ep-opt'} onClick={() => pick(null)}>
                <span className="ep-logo-empty" />
                <span className="ep-name">All sets</span>
              </button>
            </li>
            {visible.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={e.id === value ? 'ep-opt active' : 'ep-opt'}
                  onClick={() => pick(e.id)}
                >
                  <Logo src={e.logo} />
                  <span className="ep-name">{e.name}</span>
                  {e.code && <small className="muted">{e.code}</small>}
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="muted ep-none">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
