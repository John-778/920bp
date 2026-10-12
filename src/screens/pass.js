/**
 * Home: the pass itself.
 *
 * Keeps the original two-state layout - a QR panel and a details panel
 * swapped by one button - but the toggle is now a labelled segmented
 * control, the data comes from the store, and the card reflects the real
 * status of the record (including a pass whose dates have passed).
 */
import { h } from '../core/dom.js';
import { formatDate, formatTime, today, daysBetween } from '../core/dates.js';
import {
  effectiveStatus,
  isCurrentlyValid,
  routeLine,
  STATUS_LABELS,
} from '../data/schema.js';
import * as repo from '../data/repository.js';
import { toastSuccess, toastError } from '../ui/toast.js';

const QR_FALLBACK = 'assets/qr-default.png';

export function PassScreen({ navigate }) {
  const passes = repo.getPasses();
  const settings = repo.getSettings();

  if (passes.length === 0) {
    return emptyState(navigate);
  }

  const active = repo.getActivePass() || passes[0];
  let view = settings.defaultView === 'details' ? 'details' : 'qr';

  const panel = h('div', { class: 'pass-card__panel' });

  const qrButton = segmentButton('QR Code', 'qr');
  const detailsButton = segmentButton('Details', 'details');

  function segmentButton(label, key) {
    return h('button', {
      class: 'segmented__btn',
      type: 'button',
      role: 'tab',
      id: `seg-${key}`,
      'aria-selected': String(view === key),
      'aria-controls': 'passPanel',
      onClick: () => setView(key),
      text: label,
    });
  }

  function setView(next) {
    if (view === next) return;
    view = next;
    qrButton.setAttribute('aria-selected', String(view === 'qr'));
    detailsButton.setAttribute('aria-selected', String(view === 'details'));
    renderPanel();
    // Remember the preference, but a failure here must not break the toggle.
    repo.updateSettings({ defaultView: view }).catch(() => {});
  }

  function renderPanel() {
    panel.replaceChildren(view === 'qr' ? qrPanel(active) : detailsPanel(active));
  }

  renderPanel();

  const status = effectiveStatus(active);

  const container = h(
    'div',
    { class: 'container' },

    passes.length > 1 ? passSwitcher(passes, active, navigate) : null,

    routeCard(active),

    h(
      'div',
      { class: 'segmented', role: 'tablist', 'aria-label': 'Pass view' },
      qrButton,
      detailsButton
    ),

    h(
      'section',
      {
        class: ['pass-card', `pass-card--${status}`],
        'aria-labelledby': 'passStatusHeading',
      },
      h('span', { class: 'pass-card__flag', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'pass-card__heading' },
        h('h2', { class: 'pass-card__status', id: 'passStatusHeading', text: STATUS_LABELS[status] }),
        h('p', { class: 'pass-card__validity', text: validityLine(active) })
      ),
      h('div', { class: 'pass-card__panel', id: 'passPanel', role: 'tabpanel' }, panel)
    ),

    validityBanner(active),

    h(
      'div',
      { class: 'btn-row' },
      h('button', {
        class: 'btn',
        type: 'button',
        onClick: () => navigate(`/pass/${active.id}/edit`),
        text: 'Edit this pass',
      }),
      h('button', {
        class: 'btn btn--secondary',
        type: 'button',
        onClick: () => navigate('/passes'),
        text: 'All passes',
      })
    )
  );

  return container;
}

function validityLine(pass) {
  if (!pass.startDate || !pass.endDate) return 'Validity not set';
  return `Valid ${formatDate(pass.startDate)} to ${formatDate(pass.endDate)}`;
}

/** A plain-language note about where this pass sits relative to today. */
function validityBanner(pass) {
  const now = today();
  const status = effectiveStatus(pass);

  if (status === 'expired') {
    return banner('warn', `This pass ended on ${formatDate(pass.endDate)}. Edit it or add a new one.`);
  }
  if (status === 'pending') {
    return banner('info', 'This pass is marked as pending. Change its status once it is approved.');
  }
  if (status === 'rejected') {
    return banner('error', 'This pass is marked as not approved.');
  }
  if (pass.startDate && pass.startDate > now) {
    const days = daysBetween(now, pass.startDate);
    return banner('info', `This pass starts in ${days} ${days === 1 ? 'day' : 'days'}.`);
  }
  if (isCurrentlyValid(pass)) {
    const left = daysBetween(now, pass.endDate);
    if (left <= 7) {
      return banner(
        'warn',
        left === 0
          ? 'This pass ends today.'
          : `This pass ends in ${left} ${left === 1 ? 'day' : 'days'}.`
      );
    }
  }
  return null;
}

function banner(kind, text) {
  const icons = { info: 'ℹ', warn: '⚠', error: '⚠' };
  return h(
    'p',
    { class: ['banner', `banner--${kind}`] },
    h('span', { class: 'banner__icon', 'aria-hidden': 'true', text: icons[kind] }),
    h('span', { text })
  );
}

function routeCard(pass) {
  return h(
    'section',
    { class: 'route-card', 'aria-label': 'Route and timings' },
    h('p', { class: 'route-card__stop', text: pass.busStop || 'Boarding stop not set' }),
    h('p', {
      class: 'route-card__arrow',
      'aria-hidden': 'true',
      text: pass.returnTrip ? '⇌' : '↓',
    }),
    h('span', { class: 'visually-hidden', text: pass.returnTrip ? 'to and from' : 'to' }),
    h('p', { class: 'route-card__stop', text: pass.destination || 'Destination not set' }),
    h(
      'p',
      { class: 'route-card__times' },
      h('span', { text: `Office In Time – ${pass.inTime || '--:--'}` }),
      h('span', { text: `Office Out Time – ${pass.outTime || '--:--'}` })
    )
  );
}

function qrPanel(pass) {
  const img = h('img', {
    src: pass.qrImage || QR_FALLBACK,
    alt: `Scannable pass code for ${pass.name || 'this pass'}`,
    width: '290',
    height: '290',
    decoding: 'async',
  });

  img.addEventListener('error', () => {
    if (img.src.endsWith(QR_FALLBACK)) return;
    img.src = QR_FALLBACK;
  });

  return h(
    'div',
    { class: 'pass-qr' },
    h('div', { class: 'pass-qr__frame' }, img),
    h('p', {
      class: 'pass-qr__caption',
      text: pass.qrImage ? 'Your saved pass code' : 'Default pass code image',
    })
  );
}

function detailsPanel(pass) {
  const items = [
    ['Name', pass.name],
    ['Employee ID', pass.employeeId],
    ['Bus Stop Name', pass.busStop],
    ['Route Type', pass.routeType],
    ['Start Date', formatDate(pass.startDate)],
    ['End Date', formatDate(pass.endDate)],
    ['Office In Time', formatTime(pass.inTime)],
    ['Office Out Time', formatTime(pass.outTime)],
  ];

  return h(
    'div',
    { class: 'pass-details' },
    h(
      'dl',
      { class: 'deflist' },
      ...items.map(([label, value]) =>
        h(
          'div',
          { class: 'deflist__item' },
          h('dt', { class: 'deflist__label', text: label }),
          h('dd', { class: 'deflist__value', text: value || '—' })
        )
      ),
      h(
        'div',
        { class: 'deflist__item deflist__item--full' },
        h('dt', { class: 'deflist__label', text: 'Route' }),
        h('dd', { class: 'deflist__value', text: routeLine(pass) })
      ),
      pass.stops.length
        ? h(
            'div',
            { class: 'deflist__item deflist__item--full' },
            h('dt', { class: 'deflist__label', text: `Stops (${pass.stops.length})` }),
            h('dd', { class: 'deflist__value', text: pass.stops.join(' → ') })
          )
        : null,
      pass.notes
        ? h(
            'div',
            { class: 'deflist__item deflist__item--full' },
            h('dt', { class: 'deflist__label', text: 'Notes' }),
            h('dd', { class: 'deflist__value', text: pass.notes })
          )
        : null
    )
  );
}

function passSwitcher(passes, active, navigate) {
  const select = h(
    'select',
    {
      class: 'select',
      'aria-label': 'Choose which pass to show',
      onChange: async (event) => {
        const id = event.target.value;
        try {
          await repo.setActivePass(id);
          toastSuccess('Switched pass.');
        } catch (error) {
          toastError(error.message);
        }
      },
    },
    ...passes.map((pass) =>
      h('option', { value: pass.id, selected: pass.id === active.id || undefined },
        `${pass.title} — ${STATUS_LABELS[effectiveStatus(pass)]}`)
    )
  );
  select.value = active.id;

  return h(
    'div',
    { class: 'pass-switcher' },
    select,
    h('button', {
      class: 'btn btn--secondary btn--auto btn--sm',
      type: 'button',
      onClick: () => navigate('/passes'),
      text: 'Manage',
    })
  );
}

function emptyState(navigate) {
  return h(
    'div',
    { class: 'container' },
    h(
      'div',
      { class: 'empty' },
      h('div', { class: 'empty__icon', 'aria-hidden': 'true', text: '\u{1F68D}' }),
      h('h2', { class: 'empty__title', text: 'No bus pass yet' }),
      h('p', {
        class: 'empty__text',
        text: 'Add your pass details once and they stay on this device, ready to show offline.',
      }),
      h('button', {
        class: 'btn btn--auto',
        type: 'button',
        onClick: () => navigate('/apply'),
        text: 'Add a bus pass',
      })
    )
  );
}
