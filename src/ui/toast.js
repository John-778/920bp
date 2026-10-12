/** Transient feedback messages, announced to screen readers. */
import { h } from '../core/dom.js';

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = h('div', {
    class: 'toasts',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });
  document.body.appendChild(container);
  return container;
}

const ICONS = { success: '✓', error: '⚠', info: 'ℹ' };

/**
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'info', duration?: number }} [options]
 */
export function toast(message, { type = 'info', duration } = {}) {
  const root = ensureContainer();

  // Errors stay long enough to read and act on; confirmations are brief.
  const ms = duration ?? (type === 'error' ? 6000 : 3200);

  const node = h(
    'div',
    { class: ['toast', `toast--${type}`] },
    h('span', { class: 'toast__icon', 'aria-hidden': 'true', text: ICONS[type] || ICONS.info }),
    h('span', { class: 'toast__body', text: message }),
    h('button', {
      class: 'toast__close',
      type: 'button',
      'aria-label': 'Dismiss notification',
      onClick: () => dismiss(node),
      text: '×',
    })
  );

  root.appendChild(node);

  // Keep at most three on screen so the stack cannot cover the whole page.
  while (root.children.length > 3) dismiss(root.firstElementChild, true);

  const timer = setTimeout(() => dismiss(node), ms);
  node.addEventListener('mouseenter', () => clearTimeout(timer));
  return () => dismiss(node);
}

function dismiss(node, immediate = false) {
  if (!node || !node.parentNode) return;
  if (immediate) {
    node.remove();
    return;
  }
  node.classList.add('is-leaving');
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 400); // fallback if the animation is disabled
}

export const toastSuccess = (message) => toast(message, { type: 'success' });
export const toastError = (message) => toast(message, { type: 'error' });
