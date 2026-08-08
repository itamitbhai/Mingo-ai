import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement ResizeObserver; cmdk (the command palette) observes element sizes.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom doesn't implement scrollIntoView either; Radix/cmdk call it when navigating items.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
