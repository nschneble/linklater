import '@testing-library/jest-dom';

/*
 * The block below does not replace `window.localStorage`, it supplies it:
 * this environment has none, and Node's own stays off without
 * `--localstorage-file`. Every site
 * `grep -rn 'vi.spyOn(window.localStorage' src` finds rests on that, and
 * works only because a plain object is patchable where a `Storage` is
 * not. Dropping this is loud rather than quiet, since spying on nothing
 * throws.
 *
 * `window.sessionStorage` does exist here, as a proxy whose methods are
 * not `Storage.prototype`'s, so the same idiom aimed at it installs
 * without throwing and intercepts nothing at all. That is the quiet
 * direction, and why a suite that needs it to refuse stands a whole
 * substitute in front of the accessor (`test/refusedStorage.ts`).
 */
const storage: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(storage, key)
      ? storage[key]
      : null;
  },

  setItem(key: string, value: string): void {
    storage[key] = String(value);
  },

  removeItem(key: string): void {
    delete storage[key];
  },

  clear(): void {
    Object.keys(storage).forEach((key) => delete storage[key]);
  },

  key(index: number): string | null {
    return Object.keys(storage)[index] ?? null;
  },

  get length(): number {
    return Object.keys(storage).length;
  },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
