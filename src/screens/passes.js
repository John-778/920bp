/**
 * All passes, with their status - the screen the drawer's old
 * "Request Status" item pointed at.
 */
import { h } from '../core/dom.js';
import { formatDate } from '../core/dates.js';
import { effectiveStatus, routeLine, STATUS_LABELS } from '../data/schema.js';
import * as repo from '../data/repository.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Pending' },
  { key: 'expired', label: 'Expired' },
  { key: 'rejected', label: 'Rejected' },
];

/** Survives a re-render so the chosen filter is not lost on every store change. */
let activeFilter = 'all';

export function PassesScreen({ navigate }) {
  const passes = repo.getPasses();
  const counts = repo.countByStatus();
  const settings = repo.getSettings();

  const list = h('ul', { class: 'passlist' });

  const filterBar = h(
    'div',
    { class: 'filters', role: 'group', 'aria-label': 'Filter passes by status' },
    ...FILTERS.map((filter) =>
      h('button', {
        class: 'filter-btn',
        type: 'button',
        'aria-pressed': String(activeFilter === filter.key),
        onClick: (event) => {
          activeFilter = filter.key;
          for (const button of filterBar.children) button.setAttribute('aria-pressed', 'false');
          event.currentTarget.setAttribute('aria-pressed', 'true');
          paint();
        },
        text: `${filter.label} (${counts[filter.key] ?? 0})`,
      })
    )
  );

  function paint() {
    const visible = passes.filter(
      (pass) => activeFilter === 'all' || effectiveStatus(pass) === activeFilter
    );

    if (visible.length === 0) {
      list.replaceChildren(
        h(
          'li',
          null,
          h(
            'div',
            { class: 'empty' },
            h('h2', { class: 'empty__title', text: passes.length === 0 ? 'No passes yet' : 'Nothing matches that filter' }),
            h('p', {
              class: 'empty__text',
              text:
                passes.length === 0
                  ? 'Add your first bus pass to see it here.'
                  : 'Try a different status filter.',
            }),
            passes.length === 0
              ? h('button', {
                  class: 'btn btn--auto',
                  type: 'button',
                  onClick: () => navigate('/apply'),
                  text: 'Add a bus pass',
                })
              : null
          )
        )
      );
      return;
    }

    list.replaceChildren(
      ...visible.map((pass) => passCard(pass, pass.id === settings.activePassId, navigate))
    );
  }

  paint();

  return h(
    'div',
    { class: 'container container--wide' },
    h(
      'div',
      { class: 'page-head' },
      h('h1', null, 'All passes'),
      h('p', { text: 'View, edit or remove any pass stored on this device.' })
    ),
    filterBar,
    list,
    h('div', { style: { marginTop: 'var(--s-5)' } },
      h('button', {
        class: 'btn',
        type: 'button',
        onClick: () => navigate('/apply'),
        text: '+ Add a bus pass',
      })
    )
  );
}

function passCard(pass, isActive, navigate) {
  const status = effectiveStatus(pass);

  const setActiveBtn = isActive
    ? null
    : h('button', {
        class: 'btn btn--secondary btn--sm',
        type: 'button',
        onClick: async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            await repo.setActivePass(pass.id);
            toastSuccess(`"${pass.title}" is now the pass shown on the home screen.`);
          } catch (error) {
            toastError(error.message || 'Could not switch to that pass.');
            button.disabled = false;
          }
        },
        text: 'Show on home',
      });

  return h(
    'li',
    { class: ['passitem', isActive ? 'is-active' : ''] },
    h(
      'div',
      { class: 'passitem__top' },
      h('h2', { class: 'passitem__title', text: pass.title }),
      isActive ? h('span', { class: 'chip chip--active', text: 'On home' }) : null,
      h('span', { class: ['chip', `chip--${status}`], text: STATUS_LABELS[status].replace(' Pass', '') })
    ),
    h(
      'p',
      { class: 'passitem__meta' },
      h('span', { text: routeLine(pass) }),
      h('br'),
      h('span', { text: `${formatDate(pass.startDate)} – ${formatDate(pass.endDate)}` }),
      h('br'),
      h('span', { text: `In ${pass.inTime} · Out ${pass.outTime} · Route ${pass.routeType}` })
    ),
    h(
      'div',
      { class: 'passitem__actions' },
      h('button', {
        class: 'btn btn--sm',
        type: 'button',
        onClick: () => navigate(`/pass/${pass.id}/edit`),
        text: 'Edit',
      }),
      setActiveBtn,
      h('button', {
        class: 'btn btn--danger btn--sm',
        type: 'button',
        onClick: async (event) => {
          const button = event.currentTarget;
          const settings = repo.getSettings();
          const ok =
            settings.confirmBeforeDelete === false ||
            (await confirmDialog({
              title: 'Delete this pass?',
              body: `"${pass.title}" will be removed from this device. This cannot be undone.`,
              confirmText: 'Delete',
              danger: true,
            }));
          if (!ok) return;
          button.disabled = true;
          try {
            await repo.deletePass(pass.id);
            toastSuccess('Pass deleted.');
          } catch (error) {
            toastError(error.message || 'Could not delete this pass.');
            button.disabled = false;
          }
        },
        text: 'Delete',
      })
    )
  );
}
