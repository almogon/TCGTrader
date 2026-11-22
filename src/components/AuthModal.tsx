import { useEffect, useRef, useState, type FormEvent } from 'react';
import { loadAuth, saveAuth } from '../api';

const DEFAULT_HOST = 'pokemon-tcg-api.p.rapidapi.com';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se llama tras guardar o borrar, para que la búsqueda recargue lo que dependa de la API. */
  onSaved: () => void;
}

/** Modal para guardar en localStorage un host y una API key propios de RapidAPI. */
export default function AuthModal({ open, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState('');
  const [key, setKey] = useState('');
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      const saved = loadAuth();
      setHost(saved.host);
      setKey(saved.key);
      setHasSaved(Boolean(saved.host || saved.key));
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveAuth({ host, key });
    onSaved();
    onClose();
  }

  function onClear() {
    saveAuth({ host: '', key: '' });
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
          Usa tus propias credenciales de RapidAPI. Se guardan solo en este navegador y sustituyen a las del
          servidor. Deja un campo vacío para usar el valor por defecto.
        </p>
        <label>
          Host
          <input
            type="text"
            placeholder={DEFAULT_HOST}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          API key
          <input
            type="password"
            placeholder="x-rapidapi-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="auth-actions">
          {hasSaved && (
            <button type="button" className="danger" onClick={onClear}>
              Borrar
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Guardar
          </button>
        </div>
      </form>
    </dialog>
  );
}
