/**
 * Form field factory.
 *
 * Builds label + control + hint + error as one unit with the aria wiring
 * already correct, so every form in the app reports errors the same way
 * to both sighted users and screen readers.
 */
import { h } from '../core/dom.js';

let seq = 0;
const nextId = (name) => `f-${name}-${(seq += 1)}`;

/**
 * @param {object} config
 * @param {string} config.name
 * @param {string} config.label
 * @param {string} [config.type]        input type, or 'select' / 'textarea'
 * @param {string} [config.value]
 * @param {boolean} [config.required]
 * @param {string} [config.hint]
 * @param {Array<string|{value:string,label:string}>} [config.options]  for select
 * @param {Record<string,string>} [config.attrs]  extra attributes on the control
 * @param {(value:string, event:Event) => void} [config.onInput]
 */
export function field(config) {
  const {
    name,
    label,
    type = 'text',
    value = '',
    required = false,
    hint = '',
    options = [],
    attrs = {},
    onInput,
  } = config;

  const id = nextId(name);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : null].filter(Boolean);

  const shared = {
    id,
    name,
    class: type === 'select' ? 'select' : type === 'textarea' ? 'textarea' : 'input',
    required: required || undefined,
    'aria-describedby': describedBy.length ? describedBy.join(' ') : undefined,
    ...attrs,
  };

  let control;
  if (type === 'select') {
    control = h(
      'select',
      shared,
      ...options.map((option) => {
        const optionValue = typeof option === 'string' ? option : option.value;
        const optionLabel = typeof option === 'string' ? option : option.label;
        return h('option', { value: optionValue, selected: optionValue === value || undefined }, optionLabel);
      })
    );
    control.value = value;
  } else if (type === 'textarea') {
    control = h('textarea', shared);
    control.value = value;
  } else {
    control = h('input', { ...shared, type });
    control.value = value;
  }

  if (onInput) {
    const eventName = type === 'select' ? 'change' : 'input';
    control.addEventListener(eventName, (event) => onInput(event.target.value, event));
  }

  const errorNode = h('p', { class: 'field__error', id: errorId, hidden: true });

  const wrapper = h(
    'div',
    { class: 'field' },
    h(
      'label',
      { class: 'field__label', for: id },
      label,
      required ? h('span', { class: 'field__req', 'aria-hidden': 'true', text: '*' }) : null
    ),
    control,
    hint ? h('p', { class: 'field__hint', id: hintId, text: hint }) : null,
    errorNode
  );

  /** Show or clear the validation message for this field. */
  function setError(message) {
    if (message) {
      errorNode.textContent = message;
      errorNode.hidden = false;
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', [errorId, ...describedBy].join(' '));
    } else {
      errorNode.textContent = '';
      errorNode.hidden = true;
      control.removeAttribute('aria-invalid');
      if (describedBy.length) {
        control.setAttribute('aria-describedby', describedBy.join(' '));
      } else {
        control.removeAttribute('aria-describedby');
      }
    }
  }

  return {
    wrapper,
    control,
    setError,
    get value() {
      return control.value;
    },
    set value(next) {
      control.value = next;
    },
  };
}

/** A checkbox styled as a switch row. */
export function switchField({ name, label, checked = false, onChange }) {
  const id = nextId(name);
  const input = h('input', {
    type: 'checkbox',
    id,
    name,
    checked: checked || undefined,
  });
  if (onChange) input.addEventListener('change', (event) => onChange(event.target.checked, event));

  const wrapper = h(
    'label',
    { class: 'switch', for: id },
    input,
    h('span', { class: 'switch__text', text: label })
  );

  return {
    wrapper,
    control: input,
    setError: () => {},
    get value() {
      return input.checked;
    },
    set value(next) {
      input.checked = Boolean(next);
    },
  };
}
