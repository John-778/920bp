import { describe, it, expect } from 'vitest';
import { h, render, clear, focusables } from '../src/core/dom.js';

describe('h', () => {
  it('sets text content, never markup', () => {
    const el = h('div', { text: '<img src=x onerror=alert(1)>' });
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
  });

  it('treats string children as text, not HTML', () => {
    const el = h('p', null, '<script>alert(1)</script>');
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toBe('<script>alert(1)</script>');
  });

  it('skips null, undefined and false children', () => {
    const el = h('div', null, 'a', null, undefined, false, '', 'b');
    expect(el.textContent).toBe('ab');
  });

  it('flattens nested arrays of children', () => {
    const el = h('div', null, ['a', ['b', ['c']]]);
    expect(el.textContent).toBe('abc');
  });

  it('accepts a class as a string or as an array', () => {
    expect(h('div', { class: 'a b' }).className).toBe('a b');
    expect(h('div', { class: ['a', null, false, 'b'] }).className).toBe('a b');
  });

  it('omits attributes that are null, undefined or false', () => {
    const el = h('input', { disabled: false, required: undefined, placeholder: null });
    expect(el.hasAttribute('disabled')).toBe(false);
    expect(el.hasAttribute('required')).toBe(false);
    expect(el.hasAttribute('placeholder')).toBe(false);
  });

  it('writes boolean attributes as bare attributes', () => {
    const el = h('input', { disabled: true });
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.getAttribute('disabled')).toBe('');
  });

  it('wires event handlers', () => {
    let clicks = 0;
    const el = h('button', { onClick: () => (clicks += 1) });
    el.click();
    el.click();
    expect(clicks).toBe(2);
  });

  it('applies dataset and style objects', () => {
    const el = h('div', { dataset: { count: '3' }, style: { color: 'red' } });
    expect(el.dataset.count).toBe('3');
    expect(el.style.color).toBe('red');
  });
});

describe('render and clear', () => {
  it('replaces everything that was there', () => {
    const root = h('div', null, h('span', { text: 'old' }));
    render(root, h('em', { text: 'new' }));
    expect(root.children).toHaveLength(1);
    expect(root.textContent).toBe('new');
  });

  it('empties a node', () => {
    const root = h('div', null, 'a', h('b', { text: 'c' }));
    clear(root);
    expect(root.childNodes).toHaveLength(0);
  });
});

describe('focusables', () => {
  it('ignores disabled controls', () => {
    const root = h(
      'div',
      null,
      h('button', { text: 'ok' }),
      h('button', { disabled: true, text: 'no' })
    );
    document.body.appendChild(root);
    // jsdom reports offsetParent as null for everything, so this asserts the
    // disabled filter rather than the visibility filter.
    const names = focusables(root).map((el) => el.textContent);
    expect(names).not.toContain('no');
    root.remove();
  });
});
