/**
 * Hash router.
 *
 * Hash routing is deliberate: the same build has to work from the WebView
 * origin inside the Capacitor Android/iOS shells and from a static host
 * with no rewrite rules, and neither can serve deep paths.
 *
 * Programmatic navigation goes through history.pushState and resolves the
 * new screen directly, so `await navigate(...)` is finished when it
 * returns. popstate / hashchange cover the cases we did not initiate -
 * the browser back button, the Android hardware back button, and a hash
 * typed into the address bar - and are de-duplicated against the hash we
 * last resolved.
 */

/** Turn '/pass/:id/edit' into a matcher. */
function compile(pattern) {
  const keys = [];
  const source = pattern
    .replace(/\/$/, '')
    // Escape regex metacharacters. '/' is not one of them, so the
    // parameter pass below matches a plain '/:name'.
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:([A-Za-z0-9_]+)/g, (_match, key) => {
      keys.push(key);
      return '/([^/]+)';
    });
  return { regex: new RegExp(`^${source || '\\/'}$`), keys };
}

export function createRouter({ routes, notFound, onNavigate }) {
  const compiled = routes.map((route) => ({ ...route, ...compile(route.path) }));

  /** @type {null | (() => boolean | Promise<boolean>)} */
  let guard = null;
  let current = null;
  /** The hash whose screen is currently on display. */
  let lastHash = null;

  const currentHash = () => window.location.hash || '#/';

  /** replaceState/pushState a hash. Neither fires popstate or hashchange. */
  function setHash(hash, replace) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }

  function parse(hash) {
    const raw = (hash || '').replace(/^#/, '') || '/';
    const [pathPart, queryPart] = raw.split('?');
    const path = pathPart.replace(/\/+$/, '') || '/';
    const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
    return { path, query };
  }

  function match(path) {
    for (const route of compiled) {
      const found = route.regex.exec(path);
      if (!found) continue;
      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(found[index + 1]);
      });
      return { route, params };
    }
    return null;
  }

  async function resolve() {
    lastHash = currentHash();
    const { path, query } = parse(lastHash);
    const found = match(path);
    const route = found ? found.route : { ...notFound, path };
    const params = found ? found.params : { path };
    current = { path, query, params, route };
    await onNavigate(current);
  }

  /**
   * Register a confirmation for the screen now on display - an edit form
   * with unsaved changes. Returning false cancels the navigation.
   */
  function setGuard(fn) {
    guard = fn;
  }

  function clearGuard() {
    guard = null;
  }

  async function allowedToLeave() {
    if (!guard) return true;
    const ok = await guard();
    if (ok) guard = null; // it agreed once; do not ask again for this move
    return ok;
  }

  /**
   * @param {string} path  '/passes' or '#/passes'
   * @param {{ replace?: boolean }} [options]
   */
  async function navigate(path, { replace = false } = {}) {
    const target = path.startsWith('#') ? path : `#${path}`;
    if (currentHash() === target) return;
    if (!(await allowedToLeave())) return;

    setHash(target, replace);
    await resolve();
  }

  /**
   * A hash change we did not initiate - the browser back button, Android's
   * hardware back, or a hash typed into the address bar.
   *
   * When a guard is armed the URL is put back first and the question asked
   * second, so the address bar never advertises a screen that is not on
   * display. If the user agrees to leave, the move they asked for is then
   * carried out for real.
   */
  async function onExternalChange() {
    const incoming = currentHash();
    if (incoming === lastHash) return; // our own pushState, already resolved

    if (guard) {
      setHash(lastHash || '#/', true);
      if (!(await allowedToLeave())) return;
      await navigate(incoming);
      return;
    }

    await resolve();
  }

  function start() {
    window.addEventListener('popstate', onExternalChange);
    window.addEventListener('hashchange', onExternalChange);
    if (!window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#/`
      );
    }
    return resolve();
  }

  /** Detach listeners. Used by tests and by any future teardown path. */
  function destroy() {
    window.removeEventListener('popstate', onExternalChange);
    window.removeEventListener('hashchange', onExternalChange);
    guard = null;
    current = null;
    lastHash = null;
  }

  return {
    start,
    destroy,
    navigate,
    setGuard,
    clearGuard,
    back: () => window.history.back(),
    get current() {
      return current;
    },
  };
}
