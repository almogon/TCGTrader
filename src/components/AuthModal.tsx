import { useEffect, useRef, useState, type FormEvent } from 'react';
import { loadAuth, saveAuth } from '../api';
import { HOST_CATALOG, isHostId, type HostId } from '../hostCatalog';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se llama tras guardar o borrar, para que la búsqueda recargue lo que dependa de la API. */
  onSaved: () => void;
}

/** Modal para elegir el host y guardar en localStorage una API key propia por host. */
export default function AuthModal({ open, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [hostId, setHostId] = useState<HostId>(loadAuth().hostId);
  const [keys, setKeys] = useState<Partial<Record<HostId, string>>>({});
  const [savedKeys, setSavedKeys] = useState<Partial<Record<HostId, string>>>({});

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      const saved = loadAuth();
      setHostId(saved.hostId);
      setKeys(saved.keys);
      setSavedKeys(saved.keys);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveAuth({ hostId, keys });
    onSaved();
    onClose();
  }

  function onClear() {
    const rest = { ...savedKeys };
    delete rest[hostId];
    saveAuth({ hostId, keys: rest });
    onSaved();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="auth-modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form onSubmit={onSubmit}>
        <h2>Authenticate</h2>
        <p className="muted">
          Choose the API host. The key is stored only in this browser, per host, and replaces the server key.
        </p>
        <label>
          Host
          <select
            value={hostId}
            onChange={(e) => {
              if (isHostId(e.target.value)) setHostId(e.target.value);
            }}
          >
            {Object.values(HOST_CATALOG).map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          API key
          <input
            type="password"
            placeholder="Empty = server key"
            value={keys[hostId] ?? ''}
            onChange={(e) => setKeys((k) => ({ ...k, [hostId]: e.target.value }))}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="auth-actions">
          {Boolean(savedKeys[hostId]) && (
            <button type="button" className="danger" onClick={onClear}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
