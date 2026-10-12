/**
 * Create / edit a pass.
 *
 * One screen serves both: in edit mode every control is prepopulated from
 * the stored record and each field can be changed on its own. Saving
 * writes through the repository, which validates again before it persists,
 * so nothing invalid can reach storage.
 */
import { h } from '../core/dom.js';
import { monthBounds, today, formatMonth } from '../core/dates.js';
import { ROUTE_TYPES, SERVICE_TYPES, emptyPass, STATUSES, STATUS_LABELS } from '../data/schema.js';
import { validatePass, passWarnings, LIMITS } from '../data/validation.js';
import * as repo from '../data/repository.js';
import { field, switchField } from '../ui/field.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';

const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

export function EditorScreen({ navigate, params, router }) {
  const isEdit = Boolean(params.id);
  const existing = isEdit ? repo.getPass(params.id) : null;

  if (isEdit && !existing) {
    return missingPass(navigate);
  }

  const original = existing || emptyPass(repo.getProfile());
  /** Working copy - nothing is written until Save succeeds. */
  const draft = { ...original, stops: [...original.stops] };

  let saving = false;
  let dirty = false;
  let submitted = false;

  const fields = {};
  const errorSummary = h('div', { hidden: true, tabindex: '-1' });

  // ---- change tracking -------------------------------------------------
  function markDirty() {
    if (dirty) return;
    dirty = true;
    router.setGuard(async () => {
      if (!dirty) return true;
      return confirmDialog({
        title: 'Discard your changes?',
        body: 'This pass has edits that have not been saved yet.',
        confirmText: 'Discard',
        cancelText: 'Keep editing',
        danger: true,
      });
    });
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  function clearDirty() {
    dirty = false;
    router.clearGuard();
    window.removeEventListener('beforeunload', onBeforeUnload);
  }

  function onBeforeUnload(event) {
    if (!dirty) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  }

  /** Bind a field to a draft key and revalidate it once the form was submitted. */
  function bind(key, config) {
    const created = field({
      ...config,
      name: key,
      value: draft[key] ?? '',
      onInput: (value) => {
        draft[key] = value;
        markDirty();
        if (submitted) validateNow();
      },
    });
    fields[key] = created;
    created.control.addEventListener('blur', () => {
      if (submitted) validateNow();
    });
    return created.wrapper;
  }

  // ---- fields ----------------------------------------------------------
  const titleField = bind('title', {
    label: 'Pass name',
    hint: 'A label you will recognise, such as "October 2026 - Thane".',
    attrs: { maxlength: String(LIMITS.titleMax), autocomplete: 'off', enterkeyhint: 'next' },
  });

  const nameField = bind('name', {
    label: 'Name',
    required: true,
    attrs: { maxlength: String(LIMITS.nameMax), autocomplete: 'name', autocapitalize: 'characters' },
  });

  const employeeIdField = bind('employeeId', {
    label: 'Employee ID',
    required: true,
    attrs: {
      maxlength: String(LIMITS.employeeIdMax),
      inputmode: 'numeric',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });

  const busStopField = bind('busStop', {
    label: 'Bus stop name',
    required: true,
    hint: 'Where you board.',
    attrs: { maxlength: '80', autocomplete: 'off' },
  });

  const destinationField = bind('destination', {
    label: 'Destination',
    required: true,
    attrs: { maxlength: '80', autocomplete: 'off' },
  });

  const routeTypeField = bind('routeType', {
    label: 'Route type',
    type: 'select',
    required: true,
    options: ROUTE_TYPES,
  });

  const serviceTypeField = bind('serviceType', {
    label: 'Service',
    type: 'select',
    options: SERVICE_TYPES,
  });

  const returnField = switchField({
    name: 'returnTrip',
    label: 'Return journey included',
    checked: draft.returnTrip,
    onChange: (checked) => {
      draft.returnTrip = checked;
      markDirty();
    },
  });

  const startField = bind('startDate', {
    label: 'Start date',
    type: 'date',
    required: true,
    attrs: { max: '2100-12-31' },
  });

  const endField = bind('endDate', {
    label: 'End date',
    type: 'date',
    required: true,
    attrs: { max: '2100-12-31' },
  });

  const inTimeField = bind('inTime', {
    label: 'Office in time',
    type: 'time',
    required: true,
  });

  const outTimeField = bind('outTime', {
    label: 'Office out time',
    type: 'time',
    required: true,
  });

  const statusField = bind('status', {
    label: 'Status',
    type: 'select',
    required: true,
    options: STATUS_OPTIONS,
  });

  const notesField = bind('notes', {
    label: 'Notes',
    type: 'textarea',
    hint: 'Optional. Anything you want to remember about this pass.',
    attrs: { maxlength: String(LIMITS.notesMax), rows: '3' },
  });

  // ---- stops (repeatable) ----------------------------------------------
  const stopList = h('ul', { class: 'stoplist' });
  const stopsError = h('p', { class: 'field__error', hidden: true });

  function renderStops() {
    stopList.replaceChildren(
      ...draft.stops.map((stop, index) => {
        const input = h('input', {
          class: 'input',
          type: 'text',
          value: stop,
          maxlength: String(LIMITS.stopMax),
          'aria-label': `Stop ${index + 1}`,
          placeholder: `Stop ${index + 1}`,
          onInput: (event) => {
            draft.stops[index] = event.target.value;
            markDirty();
          },
        });
        return h(
          'li',
          { class: 'stoplist__row' },
          input,
          h('button', {
            class: 'icon-btn',
            type: 'button',
            'aria-label': `Remove stop ${index + 1}`,
            onClick: () => {
              draft.stops.splice(index, 1);
              markDirty();
              renderStops();
              if (submitted) validateNow();
            },
            text: '×',
          })
        );
      }),
      draft.stops.length === 0
        ? h('li', { class: 'field__hint', text: 'No intermediate stops added.' })
        : null
    );
  }
  renderStops();

  const addStopBtn = h('button', {
    class: 'btn btn--secondary btn--sm btn--auto',
    type: 'button',
    onClick: () => {
      if (draft.stops.length >= LIMITS.maxStops) {
        toastError(`You can add at most ${LIMITS.maxStops} stops.`);
        return;
      }
      draft.stops.push('');
      markDirty();
      renderStops();
      const inputs = stopList.querySelectorAll('input');
      inputs[inputs.length - 1]?.focus();
    },
    text: '+ Add stop',
  });

  // ---- date shortcut ----------------------------------------------------
  const thisMonthBtn = h('button', {
    class: 'btn btn--secondary btn--sm btn--auto',
    type: 'button',
    onClick: () => {
      const bounds = monthBounds(draft.startDate && draft.startDate.length === 10 ? draft.startDate : today());
      draft.startDate = bounds.start;
      draft.endDate = bounds.end;
      fields.startDate.value = bounds.start;
      fields.endDate.value = bounds.end;
      markDirty();
      if (submitted) validateNow();
      toastSuccess(`Dates set to ${formatMonth(bounds.start)}.`);
    },
    text: 'Use the whole month',
  });

  // ---- validation -------------------------------------------------------
  function validateNow() {
    const errors = validatePass(draft);
    const warnings = passWarnings(draft);

    for (const [key, created] of Object.entries(fields)) {
      created.setError(errors[key] || '');
    }

    if (errors.stops) {
      stopsError.textContent = errors.stops;
      stopsError.hidden = false;
    } else {
      stopsError.hidden = true;
    }

    // A warning only shows where there is no hard error on that field.
    for (const [key, message] of Object.entries(warnings)) {
      if (!errors[key] && fields[key]) {
        const hint = fields[key].wrapper.querySelector('.field__hint');
        if (hint) hint.textContent = message;
      }
    }

    const count = Object.keys(errors).length;
    if (count > 0) {
      errorSummary.replaceChildren(
        h(
          'p',
          { class: 'banner banner--error' },
          h('span', { class: 'banner__icon', 'aria-hidden': 'true', text: '⚠' }),
          h('span', {
            text: `${count} ${count === 1 ? 'field needs' : 'fields need'} attention before this pass can be saved.`,
          })
        )
      );
      errorSummary.hidden = false;
    } else {
      errorSummary.hidden = true;
    }

    return errors;
  }

  function focusFirstError(errors) {
    const firstKey = Object.keys(errors)[0];
    const target = fields[firstKey]?.control;
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      errorSummary.focus();
    }
  }

  // ---- save -------------------------------------------------------------
  const saveBtn = h('button', { class: 'btn', type: 'submit' }, isEdit ? 'Save changes' : 'Add pass');

  function setSaving(on) {
    saving = on;
    saveBtn.disabled = on;
    saveBtn.replaceChildren();
    if (on) {
      saveBtn.append(
        h('span', { class: 'btn__spinner', 'aria-hidden': 'true' }),
        document.createTextNode('Saving…')
      );
    } else {
      saveBtn.textContent = isEdit ? 'Save changes' : 'Add pass';
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (saving) return; // guards against a double tap submitting twice

    submitted = true;
    const errors = validateNow();
    if (Object.keys(errors).length > 0) {
      toastError('Please correct the highlighted fields.');
      focusFirstError(errors);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await repo.updatePass(original.id, draft);
        clearDirty();
        toastSuccess('Pass updated.');
      } else {
        const created = await repo.createPass(draft);
        await repo.setActivePass(created.id);
        clearDirty();
        toastSuccess('Pass added.');
      }
      navigate('/');
    } catch (error) {
      if (error.name === 'ValidationError') {
        for (const [key, created] of Object.entries(fields)) created.setError(error.fields[key] || '');
        focusFirstError(error.fields);
        toastError(error.message);
      } else {
        toastError(error.message || 'Could not save this pass. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  // ---- cancel / delete ---------------------------------------------------
  const cancelBtn = h('button', {
    class: 'btn btn--secondary',
    type: 'button',
    onClick: async () => {
      if (dirty) {
        const discard = await confirmDialog({
          title: 'Discard your changes?',
          body: 'This pass has edits that have not been saved yet.',
          confirmText: 'Discard',
          cancelText: 'Keep editing',
          danger: true,
        });
        if (!discard) return;
      }
      clearDirty();
      navigate(isEdit ? '/' : '/passes');
    },
    text: 'Cancel',
  });

  const deleteBtn = isEdit
    ? h('button', {
        class: 'btn btn--danger',
        type: 'button',
        onClick: async () => {
          const settings = repo.getSettings();
          const ok =
            settings.confirmBeforeDelete === false ||
            (await confirmDialog({
              title: 'Delete this pass?',
              body: `"${original.title}" will be removed from this device. This cannot be undone.`,
              confirmText: 'Delete',
              danger: true,
            }));
          if (!ok) return;
          try {
            await repo.deletePass(original.id);
            clearDirty();
            toastSuccess('Pass deleted.');
            navigate('/passes');
          } catch (error) {
            toastError(error.message || 'Could not delete this pass.');
          }
        },
        text: 'Delete',
      })
    : null;

  // ---- layout -------------------------------------------------------------
  const form = h(
    'form',
    { class: 'form', novalidate: true, onSubmit },

    errorSummary,

    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', null, 'Pass holder'),
      titleField,
      nameField,
      employeeIdField
    ),

    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', null, 'Route'),
      busStopField,
      destinationField,
      h('div', { class: 'grid-2' }, routeTypeField, serviceTypeField),
      returnField.wrapper,
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field__label' }, 'Intermediate stops'),
        stopList,
        stopsError,
        addStopBtn
      )
    ),

    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', null, 'Validity'),
      h('div', { class: 'grid-2' }, startField, endField),
      thisMonthBtn
    ),

    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', null, 'Timings'),
      h('div', { class: 'grid-2' }, inTimeField, outTimeField)
    ),

    h(
      'fieldset',
      { class: 'fieldset' },
      h('legend', null, 'Other'),
      statusField,
      notesField
    ),

    h('div', { class: 'actionbar' }, saveBtn, cancelBtn, deleteBtn)
  );

  return h(
    'div',
    { class: 'container' },
    h(
      'div',
      { class: 'page-head' },
      h('h1', null, isEdit ? 'Edit pass' : 'Add a bus pass'),
      h('p', {
        text: isEdit
          ? 'Change any field and save. Everything else stays as it is.'
          : 'These details are stored on this device only.',
      })
    ),
    form
  );
}

function missingPass(navigate) {
  return h(
    'div',
    { class: 'container' },
    h(
      'div',
      { class: 'empty' },
      h('div', { class: 'empty__icon', 'aria-hidden': 'true', text: '\u{1F50D}' }),
      h('h2', { class: 'empty__title', text: 'Pass not found' }),
      h('p', {
        class: 'empty__text',
        text: 'This pass may have been deleted on this device.',
      }),
      h('button', {
        class: 'btn btn--auto',
        type: 'button',
        onClick: () => navigate('/passes'),
        text: 'Back to all passes',
      })
    )
  );
}
