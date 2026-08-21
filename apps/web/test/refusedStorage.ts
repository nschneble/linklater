type StorageMethod = 'clear' | 'getItem' | 'setItem' | 'removeItem';
type StorageArea = 'localStorage' | 'sessionStorage';

interface InstalledRefusal {
  restore: () => void;
  assertReached: () => void;
}

/**
 * Stands a substitute store in front of `store` whose `method` throws.
 *
 * A whole substitute is installed, rather than the method being patched,
 * because patching does not take: jsdom hands out a `Storage` proxy whose
 * methods are neither the prototype's nor writable through the instance.
 * Assigning over one of those names stores an item under that name
 * instead, and the real method goes on answering. A test written that way
 * passes without ever reaching the arm it names, which is the shape every
 * best-effort `catch` here is meant to be pinned by.
 */
function installRefusal(
  method: StorageMethod,
  store: StorageArea,
): InstalledRefusal {
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

  return {
    restore: () => {
      if (original) Object.defineProperty(window, store, original);
      else Reflect.deleteProperty(window, store);
    },
    assertReached: () => {
      if (refusals > 0) return;
      throw new Error(
        `withRefusedStorage: nothing called window.${store}.${method}, so the refusal was never reached`,
      );
    },
  };
}

/**
 * Runs a block against a web storage area that refuses one method,
 * `sessionStorage` unless `store` names the other one.
 *
 * @throws {Error} When nothing under `run` called the refusing method.
 *   It counts calls without telling which caller arrived, so it catches a
 *   refusal aimed at the wrong area — easy, since `store` defaults — but
 *   a render path reading the same key satisfies it just as the code
 *   under test would. The value assertion still carries the claim.
 */
export function withRefusedStorage(
  method: StorageMethod,
  run: () => void,
  store: StorageArea = 'sessionStorage',
) {
  const refusal = installRefusal(method, store);
  try {
    run();
  } finally {
    refusal.restore();
  }

  // after the finally, so a real failure inside run() is never masked
  refusal.assertReached();
}

/**
 * `withRefusedStorage` for a block that has to await something, such as a
 * module re-import whose evaluation must land while the store is refusing.
 *
 * @throws {Error} When nothing anywhere under `run` called the refusing
 *   method, with the same limit its sync twin documents.
 */
export async function withRefusedStorageAsync(
  method: StorageMethod,
  run: () => Promise<void>,
  store: StorageArea = 'sessionStorage',
) {
  const refusal = installRefusal(method, store);
  try {
    await run();
  } finally {
    refusal.restore();
  }

  // after the finally, so a real failure inside run() is never masked
  refusal.assertReached();
}
