/** Alerts screen - what the header bell opens. */
import { h } from '../core/dom.js';
import { computeAlerts } from '../data/alerts.js';
import * as repo from '../data/repository.js';

export function AlertsScreen({ navigate }) {
  const alerts = computeAlerts(repo.getPasses());

  const body =
    alerts.length === 0
      ? h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty__icon', 'aria-hidden': 'true', text: '✓' }),
          h('h2', { class: 'empty__title', text: 'Nothing needs attention' }),
          h('p', { class: 'empty__text', text: 'Your passes are up to date.' }),
          h('button', {
            class: 'btn btn--auto',
            type: 'button',
            onClick: () => navigate('/'),
            text: 'Back to my pass',
          })
        )
      : h(
          'ul',
          { class: 'passlist' },
          ...alerts.map((alert) =>
            h(
              'li',
              { class: 'passitem' },
              h(
                'div',
                { class: 'passitem__top' },
                h('h2', { class: 'passitem__title', text: alert.title }),
                h('span', {
                  class: ['chip', alert.level === 'error' ? 'chip--rejected' : alert.level === 'warn' ? 'chip--pending' : 'chip--expired'],
                  text: alert.level === 'error' ? 'Action needed' : alert.level === 'warn' ? 'Soon' : 'Info',
                })
              ),
              h('p', { class: 'passitem__meta', text: alert.detail }),
              alert.passId
                ? h(
                    'div',
                    { class: 'passitem__actions' },
                    h('button', {
                      class: 'btn btn--sm',
                      type: 'button',
                      onClick: () => navigate(`/pass/${alert.passId}/edit`),
                      text: 'Edit pass',
                    })
                  )
                : null
            )
          )
        );

  return h(
    'div',
    { class: 'container container--wide' },
    h(
      'div',
      { class: 'page-head' },
      h('h1', null, 'Alerts'),
      h('p', { text: 'Reminders worked out from the passes stored on this device.' })
    ),
    body
  );
}
