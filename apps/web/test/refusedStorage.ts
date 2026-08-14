/**
 * Runs a block against a `sessionStorage` that refuses one method.
 *
 * A whole substitute store is stood in front of the accessor, rather than
 * the method being patched, because patching does not take: jsdom hands
 * out a `Storage` proxy whose methods are neither the prototype's nor
 * writable through the instance. Assigning over one of those names stores
 * an item under that name instead, and the real method goes on answering.
 * A test written that way passes without ever reaching the arm it names,
 * which is the shape every best-effort `catch` here is meant to be pinned
 * by.
 */
export function withRefusedStorage(
  method: 'getItem' | 'setItem' | 'removeItem',
  run: () => void,
) {
  const real = window.sessionStorage;
  const substitute = {
    getItem: (key: string) => real.getItem(key),
    setItem: (key: string, value: string) => real.setItem(key, value),
    removeItem: (key: string) => real.removeItem(key),
    clear: () => real.clear(),
    key: (index: number) => real.key(index),
    get length() {
      return real.length;
    },
  };
  (substitute as Record<string, unknown>)[method] = () => {
    throw new DOMException('SecurityError');
  };

  const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: substitute as Storage,
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(window, 'sessionStorage', original);
    else Reflect.deleteProperty(window, 'sessionStorage');
  }
}
