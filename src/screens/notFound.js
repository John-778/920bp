/** In-app 404, shown for any hash route that does not exist. */
import { h } from '../core/dom.js';

export function NotFoundScreen({ navigate, params }) {
  const attempted = params?.path || window.location.hash || '';

  return h(
    'div',
    { class: 'container' },
    h(
      'div',
      { class: 'notfound' },
      h('p', { class: 'notfound__code', 'aria-hidden': 'true', text: '404' }),
      h('h1', { style: { marginTop: 0, fontSize: '22px' } }, 'That page does not exist'),
      h('p', {
        style: { color: 'var(--c-muted)', maxWidth: '38ch', margin: '0 auto var(--s-6)' },
        text: attempted
          ? `There is nothing at "${attempted}". It may have been renamed or removed.`
          : 'The page you were looking for could not be found.',
      }),
      h(
        'div',
        { class: 'btn-row' },
        h('button', {
          class: 'btn',
          type: 'button',
          onClick: () => navigate('/'),
          text: 'Go to my pass',
        }),
        h('button', {
          class: 'btn btn--secondary',
          type: 'button',
          onClick: () => navigate('/passes'),
          text: 'All passes',
        })
      )
    )
  );
}
