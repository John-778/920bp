/**
 * Application entry point.
 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/screens.css';

import { h, qs } from './core/dom.js';
import { createRouter } from './core/router.js';
import { initNative } from './core/native.js';
import { createShell } from './ui/shell.js';
import { toastError } from './ui/toast.js';
import { isModalOpen } from './ui/modal.js';
import * as repo from './data/repository.js';
import { computeAlerts, alertBadgeCount } from './data/alerts.js';
import { APP_VERSION, SITE_URL } from './config.js';

import { PassScreen } from './screens/pass.js';
import { PassesScreen } from './screens/passes.js';
import { EditorScreen } from './screens/editor.js';
import { AlertsScreen } from './screens/alerts.js';
import { SettingsScreen } from './screens/settings.js';
import { NotFoundScreen } from './screens/notFound.js';

const BASE_TITLE = 'Digital Bus Pass';

/**
 * `reactive: false` screens hold unsaved UI state (a half-filled form) and
 * must not be rebuilt when the store changes underneath them.
 */
const ROUTES = [
  {
    path: '/',
    view: PassScreen,
    title: 'My Pass',
    description: 'Your current bus pass, with the QR code and full journey details, available offline.',
    reactive: true,
  },
  {
    path: '/passes',
    view: PassesScreen,
    title: 'All Passes',
    description: 'Every bus pass saved on this device, with its approval status.',
    reactive: true,
  },
  {
    path: '/apply',
    view: EditorScreen,
    title: 'Add a Bus Pass',
    description: 'Record a new bus pass with its route, validity dates and timings.',
    reactive: false,
  },
  {
    path: '/pass/:id/edit',
    view: EditorScreen,
    title: 'Edit Pass',
    description: 'Change the route, dates, timings or status of a saved bus pass.',
    reactive: false,
  },
  {
    path: '/alerts',
    view: AlertsScreen,
    title: 'Alerts',
    description: 'Reminders about passes that are expiring, expired or awaiting approval.',
    reactive: true,
  },
  {
    path: '/settings',
    view: SettingsScreen,
    title: 'Settings',
    description: 'Profile defaults, backup and restore, and app information.',
    reactive: false,
  },
];

const NOT_FOUND = {
  view: NotFoundScreen,
  title: 'Page not found',
  description: 'The page you were looking for does not exist.',
  reactive: false,
};

/** Keep <title>, the meta description and the canonical URL in step. */
function setPageMeta(route, path) {
  document.title = `${route.title} · ${BASE_TITLE}`;

  const description = qs('meta[name="description"]');
  if (description) description.setAttribute('content', route.description);

  const ogTitle = qs('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', `${route.title} · ${BASE_TITLE}`);

  const ogDescription = qs('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute('content', route.description);

  if (SITE_URL) {
    const canonical = qs('link[rel="canonical"]');
    const href = `${SITE_URL.replace(/\/$/, '')}/#${path}`;
    if (canonical) canonical.setAttribute('href', href);
    const ogUrl = qs('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', href);
  }
}

function bootError(message, detail) {
  const root = qs('#app');
  if (!root) return;
  root.replaceChildren(
    h(
      'div',
      { class: 'container' },
      h(
        'div',
        { class: 'empty' },
        h('div', { class: 'empty__icon', 'aria-hidden': 'true', text: '⚠' }),
        h('h1', { class: 'empty__title', text: message }),
        h('p', { class: 'empty__text', text: detail }),
        h('button', {
          class: 'btn btn--auto',
          type: 'button',
          onClick: () => window.location.reload(),
          text: 'Try again',
        })
      )
    )
  );
}

async function start() {
  const root = qs('#app');
  if (!root) throw new Error('#app mount point is missing');

  try {
    await repo.init();
  } catch (error) {
    console.error('[boot] store failed to initialise', error);
    bootError(
      'Could not open your saved passes',
      'The app could not read this device’s storage. Closing and reopening the app usually fixes it.'
    );
    return;
  }

  let shell;
  let router;

  const navigate = (path) => router.navigate(path);

  shell = createShell({ root, onNavigate: (path) => navigate(path) });
  shell.setVersion(`Version ${APP_VERSION}`);

  router = createRouter({
    routes: ROUTES,
    notFound: NOT_FOUND,
    onNavigate: async ({ route, params, path }) => {
      setPageMeta(route, path);
      shell.setTitle(route.title);
      shell.setActive(route.path || path);

      try {
        const node = route.view({ navigate, params, router, path });
        shell.mount(node);
      } catch (error) {
        console.error('[router] screen failed to render', error);
        shell.mount(
          h(
            'div',
            { class: 'container' },
            h(
              'div',
              { class: 'empty' },
              h('h2', { class: 'empty__title', text: 'This screen could not be shown' }),
              h('p', { class: 'empty__text', text: 'Something went wrong while drawing this page.' }),
              h('button', {
                class: 'btn btn--auto',
                type: 'button',
                onClick: () => window.location.reload(),
                text: 'Reload',
              })
            )
          )
        );
      }
    },
  });

  /** Push store changes into the chrome, and re-render reactive screens. */
  function syncFromStore() {
    const passes = repo.getPasses();
    const profile = repo.getProfile();
    const alerts = computeAlerts(passes);

    shell.setIdentity({
      name: profile.name || repo.getActivePass()?.name || 'Bus Pass',
      employeeId: profile.employeeId || repo.getActivePass()?.employeeId || '',
    });
    shell.setAlertCount(alertBadgeCount(alerts));
  }

  repo.onChange(() => {
    syncFromStore();
    const current = router.current;
    if (current?.route?.reactive) {
      const node = current.route.view({ navigate, params: current.params, router, path: current.path });
      shell.mount(node);
    }
  });

  syncFromStore();

  if (!repo.isPersistent()) {
    toastError(
      'This device is not letting the app save data, so changes will be lost when you close it. Private browsing often causes this.'
    );
  }

  await router.start();

  await initNative({
    // Android hardware back: close whatever is open before leaving the screen.
    onBack: () => {
      if (isModalOpen()) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return true;
      }
      if (shell.isDrawerOpen()) {
        shell.closeDrawer();
        return true;
      }
      return false;
    },
  });

  document.documentElement.dataset.booted = 'true';
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[app] unhandled rejection', event.reason);
});

start().catch((error) => {
  console.error('[boot] failed', error);
  bootError('The app could not start', 'Please reload the page. If this keeps happening, reinstall the app.');
});
