const { TestEnvironment } = require('jest-environment-node');

class SafeNodeEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);

    // jest-environment-node v29 defines a localStorage getter that throws
    // SecurityError on Node 22+ where Web Storage APIs exist as native globals.
    // Override it before any module loading occurs.
    const store = Object.create(null);
    const noop = {
      getItem:    (k) => store[k] ?? null,
      setItem:    (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear:      () => { Object.keys(store).forEach((k) => delete store[k]); },
      key:        (i) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    };

    // Suppress the throwing getter with a plain property
    try {
      Object.defineProperty(this.global, 'localStorage', {
        value: noop, writable: true, configurable: true,
      });
      Object.defineProperty(this.global, 'sessionStorage', {
        value: noop, writable: true, configurable: true,
      });
    } catch {
      // Already defined as a non-configurable property — ignore
    }
  }
}

module.exports = SafeNodeEnvironment;
