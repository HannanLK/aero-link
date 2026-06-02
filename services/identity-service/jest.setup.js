// Stub browser globals accessed by transitive dependencies during module load
// in jest-environment-node (Node.js 22+)
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = globalThis.localStorage;
}
