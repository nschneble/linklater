/**
 * Runs a block against a web storage area that refuses one method,
 * `sessionStorage` unless `store` names the other one.
 *
 * A whole substitute store is stood in front of the accessor, rather than
 * the method being patched, because patching does not take: jsdom hands
 * out a `Storage` proxy whose methods are neither the prototype's nor
 * writable through the instance. Assigning over one of those names stores
 * an item under that name instead, and the real method goes on answering.
 * A test written that way passes without ever reaching the arm it names,
 * which is the shape every best-effort `catch` here is meant to be pinned
 * by.
 *
 * @throws {Error} When `run` never reached the refusing method. `store`
 *   defaults, so a refusal aimed at the wrong area is otherwise a silent
 *   pass against a store that still works.
 */
export function withRefusedStorage(
  method: 'getItem' | 'setItem' | 'removeItem',
  run: () => void,
  store: 'localStorage' | 'sessionStorage' = 'sessionStorage',
) {
  const real = window[store];
  let refusals = 0;
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
    refusals += 1;
    throw new DOMException('SecurityError');
  };

  const original = Object.getOwnPropertyDescriptor(window, store);
  Object.defineProperty(window, store, {
    configurable: true,
    value: substitute as Storage,
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(window, store, original);
    else Reflect.deleteProperty(window, store);
  }

  // after the finally, so a real failure inside run() is never masked
  if (refusals === 0) {
    throw new Error(
      `withRefusedStorage: nothing called window.${store}.${method}, so the refusal was never reached`,
    );
  }
}
