/** Tiny synchronous pub/sub used to keep every screen in sync with the store. */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const channels = new Map();

  return {
    /**
     * @param {string} name
     * @param {Function} handler
     * @returns {() => void} unsubscribe
     */
    on(name, handler) {
      if (!channels.has(name)) channels.set(name, new Set());
      channels.get(name).add(handler);
      return () => channels.get(name)?.delete(handler);
    },

    emit(name, payload) {
      const handlers = channels.get(name);
      if (!handlers) return;
      // Copy first: a handler may unsubscribe itself while we iterate.
      for (const handler of Array.from(handlers)) {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[events] handler for "${name}" failed`, error);
        }
      }
    },

    clear() {
      channels.clear();
    },
  };
}
