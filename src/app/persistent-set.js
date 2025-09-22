const MEMORY_FALLBACK = new Map();

function getStorage(storage) {
  if (!storage || typeof storage !== 'object') {
    return null;
  }
  try {
    const testKey = '__persistent-set-test__';
    storage.setItem(testKey, 'ok');
    storage.removeItem(testKey);
    return storage;
  } catch (error) {
    if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      console.warn('[PersistentSet] LocalStorage nicht verfügbar, nutze Speicher im Arbeitsspeicher.', error);
    }
    return null;
  }
}

function readFromStorage(storage, key) {
  if (!storage) {
    return MEMORY_FALLBACK.get(key) || [];
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      console.warn('[PersistentSet] Konnte gespeicherte Daten nicht lesen.', error);
    }
    return [];
  }
}

function writeToStorage(storage, key, values) {
  if (!storage) {
    MEMORY_FALLBACK.set(key, values);
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(values));
  } catch (error) {
    if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      console.warn('[PersistentSet] Speichern fehlgeschlagen, nutze Speicher im Arbeitsspeicher.', error);
    }
    MEMORY_FALLBACK.set(key, values);
  }
}

export function createPersistentSet(key, options = {}) {
  const storageKey = String(key || 'persistent-set');
  const storage = getStorage(options.storage || (typeof window !== 'undefined' ? window.localStorage : null));
  const maxEntries = typeof options.maxEntries === 'number' && options.maxEntries > 0 ? options.maxEntries : 64;
  const values = new Set(readFromStorage(storage, storageKey));

  function persist() {
    const list = Array.from(values).slice(-maxEntries);
    writeToStorage(storage, storageKey, list);
  }

  return {
    add(value) {
      if (value === undefined || value === null) {
        return false;
      }
      const beforeSize = values.size;
      values.add(String(value));
      if (values.size !== beforeSize) {
        persist();
        return true;
      }
      return false;
    },
    has(value) {
      if (value === undefined || value === null) {
        return false;
      }
      return values.has(String(value));
    },
    delete(value) {
      if (value === undefined || value === null) {
        return false;
      }
      const removed = values.delete(String(value));
      if (removed) {
        persist();
      }
      return removed;
    },
    clear() {
      if (values.size === 0) {
        return;
      }
      values.clear();
      persist();
    },
    toArray() {
      return Array.from(values);
    }
  };
}

export default createPersistentSet;
