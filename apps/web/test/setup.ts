import '@testing-library/jest-dom';

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
