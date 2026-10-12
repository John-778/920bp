import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRouter } from '../src/core/router.js';

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/passes', name: 'passes' },
  { path: '/pass/:id/edit', name: 'edit' },
  { path: '/alerts', name: 'alerts' },
];

const NOT_FOUND = { name: '404' };

/** Routers created by a test, torn down afterwards so their listeners go away. */
const live = [];

function setup() {
  const seen = [];
  const router = createRouter({
    routes: ROUTES,
    notFound: NOT_FOUND,
    onNavigate: (ctx) => {
      seen.push(ctx);
    },
  });
  live.push(router);
  return { router, seen, last: () => seen[seen.length - 1] };
}

beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname);
});

afterEach(() => {
  while (live.length) live.pop().destroy();
});

describe('matching', () => {
  it('resolves the root', async () => {
    const { router, last } = setup();
    await router.start();
    expect(last().route.name).toBe('home');
  });

  it('resolves a static route', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/passes');
    expect(last().route.name).toBe('passes');
  });

  it('extracts path parameters', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/pass/abc-123/edit');
    expect(last().route.name).toBe('edit');
    expect(last().params).toEqual({ id: 'abc-123' });
  });

  it('decodes an encoded parameter', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate(`/pass/${encodeURIComponent('a b/c')}/edit`);
    expect(last().params.id).toBe('a b/c');
  });

  it('falls through to the not-found route', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/nope');
    expect(last().route.name).toBe('404');
    expect(last().path).toBe('/nope');
  });

  it('ignores a trailing slash', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/passes/');
    expect(last().route.name).toBe('passes');
  });

  it('parses the query string', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/passes?filter=pending');
    expect(last().query).toEqual({ filter: 'pending' });
    expect(last().route.name).toBe('passes');
  });

  it('does not let one route pattern swallow another', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/pass/abc/edit/extra');
    expect(last().route.name).toBe('404');
  });
});

describe('guards', () => {
  it('blocks a navigation the guard refuses', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/passes');

    router.setGuard(() => false);
    await router.navigate('/alerts');

    expect(last().route.name).toBe('passes');
  });

  it('allows the navigation when the guard agrees, then forgets itself', async () => {
    const { router, last } = setup();
    await router.start();

    const guard = vi.fn(() => true);
    router.setGuard(guard);

    await router.navigate('/alerts');
    expect(last().route.name).toBe('alerts');
    expect(guard).toHaveBeenCalledTimes(1);

    // The guard is cleared once it has let a navigation through.
    await router.navigate('/passes');
    expect(guard).toHaveBeenCalledTimes(1);
    expect(last().route.name).toBe('passes');
  });

  it('awaits an async guard', async () => {
    const { router, last } = setup();
    await router.start();
    router.setGuard(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return false;
    });
    await router.navigate('/alerts');
    expect(last().route.name).toBe('home');
  });

  it('can be cleared explicitly', async () => {
    const { router, last } = setup();
    await router.start();
    router.setGuard(() => false);
    router.clearGuard();
    await router.navigate('/alerts');
    expect(last().route.name).toBe('alerts');
  });
});

describe('navigation', () => {
  it('does nothing when already on the target route', async () => {
    const { router, seen } = setup();
    await router.start();
    const before = seen.length;
    await router.navigate('/');
    expect(seen.length).toBe(before);
  });

  it('accepts a path with or without the leading hash', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('#/alerts');
    expect(last().route.name).toBe('alerts');
  });
});

describe('external navigation (back button, typed hash)', () => {
  /** Simulate the browser changing the hash itself. */
  async function externalGoTo(hash) {
    window.history.pushState(null, '', `${window.location.pathname}${hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  it('resolves the new route when nothing is guarding', async () => {
    const { router, last } = setup();
    await router.start();
    await externalGoTo('#/alerts');
    expect(last().route.name).toBe('alerts');
  });

  it('puts the URL back immediately when the guard refuses', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/passes');

    router.setGuard(() => false);
    await externalGoTo('#/alerts');

    expect(last().route.name).toBe('passes');
    // The address bar must not advertise a screen that is not on display.
    expect(window.location.hash).toBe('#/passes');
  });

  it('completes the move the user asked for once the guard agrees', async () => {
    const { router, last } = setup();
    await router.start();
    await router.navigate('/passes');

    router.setGuard(() => true);
    await externalGoTo('#/alerts');

    expect(last().route.name).toBe('alerts');
    expect(window.location.hash).toBe('#/alerts');
  });

  it('ignores an event for the hash already on display', async () => {
    const { router, seen } = setup();
    await router.start();
    await router.navigate('/passes');
    const before = seen.length;

    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(seen.length).toBe(before);
  });

  it('stops listening once destroyed', async () => {
    const { router, seen } = setup();
    await router.start();
    const before = seen.length;
    router.destroy();
    await externalGoTo('#/alerts');
    expect(seen.length).toBe(before);
  });
});
