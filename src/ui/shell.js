/**
 * The application chrome: header, navigation drawer, page outlet, footer.
 *
 * Keeps the original layout (purple bar, hamburger on the left, bell on
 * the right, TCS mark in the footer) but every control now has a real
 * destination and real keyboard and screen-reader behaviour.
 */
import { h, render, clear, trapFocus } from '../core/dom.js';

export const NAV_ITEMS = [
  { path: '/', icon: '\u{1F3E0}', label: 'My Pass' },
  { path: '/passes', icon: '\u{1F4CB}', label: 'All Passes & Status' },
  { path: '/apply', icon: '\u{1F68D}', label: 'Add a Bus Pass' },
  { path: '/alerts', icon: '\u{1F514}', label: 'Alerts' },
  { path: '/settings', icon: '⚙️', label: 'Settings' },
];

export function createShell({ root, onNavigate }) {
  let drawerOpen = false;
  let releaseTrap = null;
  let lastFocused = null;

  // --- Header ---------------------------------------------------------
  const menuBtn = h('button', {
    class: 'icon-btn',
    type: 'button',
    id: 'menuButton',
    'aria-label': 'Open navigation menu',
    'aria-expanded': 'false',
    'aria-controls': 'navDrawer',
    onClick: () => toggleDrawer(),
    text: '☰',
  });

  const titleEl = h('h1', { class: 'app-header__title', id: 'pageTitle' }, 'Digital Bus Pass');

  const bellBtn = h('button', {
    class: 'icon-btn icon-btn--badge',
    type: 'button',
    id: 'alertsButton',
    'aria-label': 'Alerts',
    dataset: { count: '0' },
    onClick: () => onNavigate('/alerts'),
    text: '\u{1F514}',
  });

  const header = h(
    'header',
    { class: 'app-header' },
    h('div', { class: 'app-header__bar' }, menuBtn, titleEl, bellBtn)
  );

  // --- Drawer ---------------------------------------------------------
  const drawerName = h('div', { class: 'navdrawer__name' }, 'Bus Pass');
  const drawerId = h('div', { class: 'navdrawer__id' }, 'Personal organiser');

  const closeBtn = h('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': 'Close navigation menu',
    onClick: () => closeDrawer(),
    text: '×',
  });

  const navList = h('ul', { class: 'navdrawer__list' });

  /** @type {Map<string, HTMLAnchorElement>} */
  const navLinks = new Map();

  for (const item of NAV_ITEMS) {
    const link = h(
      'a',
      {
        class: 'navlink',
        href: `#${item.path}`,
        onClick: (event) => {
          event.preventDefault();
          closeDrawer();
          onNavigate(item.path);
        },
      },
      h('span', { class: 'navlink__icon', 'aria-hidden': 'true', text: item.icon }),
      h('span', { class: 'navlink__text', text: item.label })
    );
    navLinks.set(item.path, link);
    navList.appendChild(h('li', null, link));
  }

  const drawer = h(
    'nav',
    {
      class: 'navdrawer',
      id: 'navDrawer',
      'aria-label': 'Main navigation',
      'aria-hidden': 'true',
    },
    h(
      'div',
      { class: 'navdrawer__head' },
      h('div', { class: 'navdrawer__who' }, drawerName, drawerId),
      closeBtn
    ),
    navList,
    h(
      'div',
      { class: 'navdrawer__foot' },
      h('div', null, 'Digital Bus Pass'),
      h('div', { id: 'drawerVersion' }, '')
    )
  );

  const scrim = h('div', { class: 'scrim', onClick: () => closeDrawer(), 'aria-hidden': 'true' });

  // --- Main + footer --------------------------------------------------
  const outlet = h('main', { class: 'app-main', id: 'main', tabindex: '-1' });

  const footer = buildFooter(onNavigate);

  const app = h('div', { class: 'app' }, header, outlet, footer);

  render(
    root,
    h('a', { class: 'skip-link', href: '#main' }, 'Skip to main content'),
    scrim,
    drawer,
    app
  );

  // --- Drawer behaviour -----------------------------------------------
  function openDrawer() {
    if (drawerOpen) return;
    drawerOpen = true;
    lastFocused = document.activeElement;
    drawer.classList.add('is-open');
    scrim.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    releaseTrap = trapFocus(drawer);
    closeBtn.focus();
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.removeProperty('overflow');
    if (releaseTrap) {
      releaseTrap();
      releaseTrap = null;
    }
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  const toggleDrawer = () => (drawerOpen ? closeDrawer() : openDrawer());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawerOpen) {
      event.preventDefault();
      closeDrawer();
    }
  });

  return {
    outlet,
    openDrawer,
    closeDrawer,
    isDrawerOpen: () => drawerOpen,

    setTitle(text) {
      titleEl.textContent = text;
    },

    /** Mark the current route in the drawer. */
    setActive(path) {
      for (const [itemPath, link] of navLinks) {
        if (itemPath === path) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    },

    setIdentity({ name, employeeId }) {
      drawerName.textContent = name || 'Bus Pass';
      drawerId.textContent = employeeId ? `Employee ID ${employeeId}` : 'Personal organiser';
    },

    setAlertCount(count) {
      bellBtn.dataset.count = String(count);
      bellBtn.setAttribute(
        'aria-label',
        count > 0 ? `Alerts, ${count} needing attention` : 'Alerts, none'
      );
    },

    setVersion(text) {
      const node = drawer.querySelector('#drawerVersion');
      if (node) node.textContent = text;
    },

    /** Swap the page content and move focus for assistive tech. */
    mount(node) {
      clear(outlet);
      outlet.appendChild(node);
      outlet.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    },
  };
}

function buildFooter(onNavigate) {
  const year = new Date().getFullYear();

  const links = [
    { label: 'My Pass', path: '/' },
    { label: 'All Passes', path: '/passes' },
    { label: 'Settings', path: '/settings' },
  ];

  return h(
    'footer',
    { class: 'app-footer' },
    h('img', {
      class: 'app-footer__logo',
      src: 'assets/tcs-logo.png',
      alt: 'Tata Consultancy Services',
      width: '600',
      height: '143',
      loading: 'lazy',
      decoding: 'async',
    }),
    h(
      'ul',
      { class: 'app-footer__links' },
      ...links.map((link) =>
        h(
          'li',
          null,
          h('a', {
            href: `#${link.path}`,
            onClick: (event) => {
              event.preventDefault();
              onNavigate(link.path);
            },
            text: link.label,
          })
        )
      )
    ),
    h(
      'p',
      { class: 'app-footer__note' },
      `© ${year} — personal bus pass organiser. `,
      h('br'),
      'Stores your pass details on this device only. Not an official Tata Consultancy Services application.'
    )
  );
}
