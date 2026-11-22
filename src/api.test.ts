import { describe, expect, it } from 'vitest';
import { migrateAuthV1 } from './api';

describe('migrateAuthV1', () => {
  it('host vacío + key: conserva la key para tcggo', () => {
    expect(migrateAuthV1({ host: '', key: ' abc ' })).toEqual({ hostId: 'tcggo', keys: { tcggo: 'abc' } });
  });

  it('host de TCGGO + key: conserva la key', () => {
    expect(migrateAuthV1({ host: 'pokemon-tcg-api.p.rapidapi.com', key: 'abc' })).toEqual({
      hostId: 'tcggo',
      keys: { tcggo: 'abc' },
    });
  });

  it('host distinto: descarta la key', () => {
    expect(migrateAuthV1({ host: 'otro.p.rapidapi.com', key: 'abc' })).toEqual({ hostId: 'tcggo', keys: {} });
  });

  it('sin key: no guarda nada', () => {
    expect(migrateAuthV1({ host: '', key: '' })).toEqual({ hostId: 'tcggo', keys: {} });
  });

  it('basura o null: valores por defecto', () => {
    for (const raw of [null, undefined, 'x', 42, [], { host: 5, key: {} }]) {
      expect(migrateAuthV1(raw)).toEqual({ hostId: 'tcggo', keys: {} });
    }
  });
});
