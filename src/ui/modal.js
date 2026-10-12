/**
 * Accessible confirmation dialog.
 *
 * Deliberately not window.confirm(): that blocks the WebView thread on
 * Android and iOS and looks like a browser prompt rather than part of the
 * app. This traps focus, closes on Escape and on backdrop click, and
 * restores focus to whatever opened it.
 */
import { h, trapFocus, focusables } from '../core/dom.js';

let openCount = 0;

export const isModalOpen = () => openCount > 0;

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.body]
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText]
 * @param {boolean} [options.danger]
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title,
  body = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;
    const titleId = `modal-title-${Date.now()}`;

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      release();
      document.removeEventListener('keydown', onKeydown, true);
      overlay.remove();
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.removeProperty('overflow');
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
      resolve(result);
    };

    const confirmBtn = h('button', {
      class: ['btn', danger ? 'btn--danger' : ''],
      type: 'button',
      onClick: () => finish(true),
      text: confirmText,
    });

    const panel = h(
      'div',
      {
        class: 'modal__panel',
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        onClick: (event) => event.stopPropagation(),
      },
      h('h2', { class: 'modal__title', id: titleId, text: title }),
      body ? h('p', { class: 'modal__body', text: body }) : null,
      h(
        'div',
        { class: 'modal__actions' },
        h('button', {
          class: 'btn btn--secondary',
          type: 'button',
          onClick: () => finish(false),
          text: cancelText,
        }),
        confirmBtn
      )
    );

    const overlay = h('div', { class: 'modal scrim is-open', onClick: () => finish(false) }, panel);

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };

    document.body.appendChild(overlay);
    openCount += 1;
    document.body.style.overflow = 'hidden'; // stop the page scrolling behind
    document.addEventListener('keydown', onKeydown, true);
    const release = trapFocus(panel);

    const first = focusables(panel)[0];
    (first || panel).focus();
  });
}
