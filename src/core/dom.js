/**
 * Minimal DOM helpers.
 *
 * Everything in the app is built with `h()` rather than innerHTML, so any
 * value a user typed is written through textContent / setAttribute and can
 * never be parsed as markup.
 */

/** Attribute names that take a boolean rather than a string. */
const BOOLEAN_ATTRS = new Set([
  'disabled',
  'checked',
  'required',
  'readonly',
  'multiple',
  'hidden',
  'autofocus',
  'novalidate',
]);

/**
 * Create an element.
 *
 * @param {string} tag
 * @param {Object} [attrs]  Attributes. `class`, `dataset`, `style` (object),
 *                          `on*` handlers and boolean attributes are handled.
 * @param {...(Node|string|number|null|undefined|Array)} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs = null, ...children) {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;

      if (key === 'class' || key === 'className') {
        el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'text') {
        el.textContent = String(value);
      } else if (key === 'html') {
        // Only ever used with strings this module authored, never user input.
        el.innerHTML = String(value);
      } else if (BOOLEAN_ATTRS.has(key)) {
        if (value === true || value === '') el.setAttribute(key, '');
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }

  append(el, children);
  return el;
}

/** Append a nested array of children to a parent, skipping empty values. */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Remove every child of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Replace a node's children in one shot. */
export function render(node, ...children) {
  clear(node);
  return append(node, children);
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Focusable descendants, in tab order, for focus trapping. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root) {
  return qsa(FOCUSABLE, root).filter(
    (el) => !el.hasAttribute('hidden') && el.offsetParent !== null
  );
}

/**
 * Keep Tab inside `root` until the returned function is called.
 * @returns {() => void} release
 */
export function trapFocus(root) {
  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const items = focusables(root);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  root.addEventListener('keydown', onKeydown);
  return () => root.removeEventListener('keydown', onKeydown);
}
