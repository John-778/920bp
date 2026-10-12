/**
 * Settings: profile defaults, preferences, backup/restore and app info.
 */
import { h } from '../core/dom.js';
import * as repo from '../data/repository.js';
import { field, switchField } from '../ui/field.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { isNative, platform } from '../core/native.js';
import { APP_VERSION, BUILD_TIME } from '../config.js';

export function SettingsScreen({ navigate }) {
  const profile = repo.getProfile();
  const settings = repo.getSettings();

  // ---- Profile ---------------------------------------------------------
  const profileFields = {
    name: field({
      name: 'name',
      label: 'Name',
      value: profile.name,
      hint: 'Used to prefill new passes.',
      attrs: { autocomplete: 'name', maxlength: '60' },
    }),
    employeeId: field({
      name: 'employeeId',
      label: 'Employee ID',
      value: profile.employeeId,
      attrs: { inputmode: 'numeric', maxlength: '15', spellcheck: 'false' },
    }),
    defaultBusStop: field({
      name: 'defaultBusStop',
      label: 'Usual bus stop',
      value: profile.defaultBusStop,
      attrs: { maxlength: '80' },
    }),
    defaultDestination: field({
      name: 'defaultDestination',
      label: 'Usual destination',
      value: profile.defaultDestination,
      attrs: { maxlength: '80' },
    }),
    email: field({
      name: 'email',
      label: 'Email',
      type: 'email',
      value: profile.email,
      attrs: { autocomplete: 'email', inputmode: 'email', maxlength: '120' },
    }),
    phone: field({
      name: 'phone',
      label: 'Phone',
      type: 'tel',
      value: profile.phone,
      attrs: { autocomplete: 'tel', inputmode: 'tel', maxlength: '20' },
    }),
  };

  const saveProfileBtn = h('button', { class: 'btn', type: 'submit' }, 'Save profile');

  const profileForm = h(
    'form',
    {
      class: 'form',
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (saveProfileBtn.disabled) return;
        saveProfileBtn.disabled = true;

        const patch = Object.fromEntries(
          Object.entries(profileFields).map(([key, created]) => [key, created.value.trim()])
        );

        try {
          await repo.updateProfile(patch);
          for (const created of Object.values(profileFields)) created.setError('');
          toastSuccess('Profile saved.');
        } catch (error) {
          if (error.name === 'ValidationError') {
            for (const [key, created] of Object.entries(profileFields)) {
              created.setError(error.fields[key] || '');
            }
            const firstKey = Object.keys(error.fields)[0];
            profileFields[firstKey]?.control.focus();
            toastError(error.message);
          } else {
            toastError(error.message || 'Could not save your profile.');
          }
        } finally {
          saveProfileBtn.disabled = false;
        }
      },
    },
    h('div', { class: 'grid-2' }, profileFields.name.wrapper, profileFields.employeeId.wrapper),
    h('div', { class: 'grid-2' }, profileFields.defaultBusStop.wrapper, profileFields.defaultDestination.wrapper),
    h('div', { class: 'grid-2' }, profileFields.email.wrapper, profileFields.phone.wrapper),
    saveProfileBtn
  );

  // ---- Preferences -----------------------------------------------------
  const defaultViewField = field({
    name: 'defaultView',
    label: 'Open the pass showing',
    type: 'select',
    value: settings.defaultView,
    options: [
      { value: 'qr', label: 'QR code' },
      { value: 'details', label: 'Details' },
    ],
    onInput: async (value) => {
      try {
        await repo.updateSettings({ defaultView: value });
        toastSuccess('Preference saved.');
      } catch (error) {
        toastError(error.message || 'Could not save that preference.');
      }
    },
  });

  const confirmDeleteSwitch = switchField({
    name: 'confirmBeforeDelete',
    label: 'Ask before deleting a pass',
    checked: settings.confirmBeforeDelete !== false,
    onChange: async (checked) => {
      try {
        await repo.updateSettings({ confirmBeforeDelete: checked });
        toastSuccess('Preference saved.');
      } catch (error) {
        toastError(error.message || 'Could not save that preference.');
      }
    },
  });

  // ---- Backup ----------------------------------------------------------
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    'aria-label': 'Choose a backup file to restore',
    tabindex: '-1',
    onChange: async (event) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // allow re-picking the same file
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toastError('That file is too large to be a pass backup.');
        return;
      }

      try {
        const text = await file.text();
        const payload = JSON.parse(text);

        const merge = await confirmDialog({
          title: 'Restore passes',
          body: 'Keep the passes already on this device and add the ones in the file, or replace everything with the file?',
          confirmText: 'Keep and add',
          cancelText: 'Replace all',
        });

        const result = await repo.importData(payload, { merge });
        toastSuccess(
          `Restored ${result.imported} ${result.imported === 1 ? 'pass' : 'passes'}` +
            (result.skipped ? `, skipped ${result.skipped} unreadable.` : '.')
        );
        navigate('/passes');
      } catch (error) {
        toastError(
          error instanceof SyntaxError
            ? 'That file is not valid JSON.'
            : error.message || 'Could not restore from that file.'
        );
      }
    },
  });

  const exportBtn = h('button', {
    class: 'btn btn--secondary btn--sm btn--auto',
    type: 'button',
    onClick: async () => {
      const data = JSON.stringify(repo.exportData(), null, 2);
      const filename = `bus-pass-backup-${new Date().toISOString().slice(0, 10)}.json`;

      // A WebView will not write to the device's download folder, so on a
      // phone we put the backup on the clipboard instead of silently failing.
      if (isNative()) {
        try {
          await navigator.clipboard.writeText(data);
          toastSuccess('Backup copied to the clipboard. Paste it somewhere safe.');
        } catch {
          toastError('Could not copy the backup. Check clipboard permission.');
        }
        return;
      }

      try {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = h('a', { href: url, download: filename });
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toastSuccess('Backup downloaded.');
      } catch (error) {
        toastError(error.message || 'Could not create the backup file.');
      }
    },
    text: 'Export backup',
  });

  const importBtn = h('button', {
    class: 'btn btn--secondary btn--sm btn--auto',
    type: 'button',
    onClick: () => fileInput.click(),
    text: 'Restore backup',
  });

  const resetBtn = h('button', {
    class: 'btn btn--danger btn--sm btn--auto',
    type: 'button',
    onClick: async () => {
      const ok = await confirmDialog({
        title: 'Erase all data?',
        body: 'Every pass, your profile and your preferences will be removed from this device, and the sample pass restored. This cannot be undone.',
        confirmText: 'Erase everything',
        danger: true,
      });
      if (!ok) return;
      try {
        await repo.resetAll();
        toastSuccess('All data erased.');
        navigate('/');
      } catch (error) {
        toastError(error.message || 'Could not erase the data.');
      }
    },
    text: 'Erase all data',
  });

  // ---- Info -------------------------------------------------------------
  const counts = repo.countByStatus();

  return h(
    'div',
    { class: 'container container--wide' },
    h(
      'div',
      { class: 'page-head' },
      h('h1', null, 'Settings'),
      h('p', { text: 'Defaults for new passes, backup, and app information.' })
    ),

    h('section', { class: 'card' }, h('h2', { style: { marginTop: 0, fontSize: '17px' } }, 'Profile'), profileForm),

    h(
      'section',
      { class: 'card' },
      h('h2', { style: { marginTop: 0, fontSize: '17px' } }, 'Preferences'),
      defaultViewField.wrapper,
      confirmDeleteSwitch.wrapper
    ),

    h(
      'section',
      { class: 'card' },
      h('h2', { style: { marginTop: 0, fontSize: '17px' } }, 'Your data'),
      h('p', { class: 'field__hint', style: { marginBottom: 'var(--s-3)' } },
        'Passes are stored only on this device. Nothing is uploaded anywhere.'),
      h(
        'div',
        { class: 'setting-row' },
        h(
          'div',
          { class: 'setting-row__text' },
          h('div', { class: 'setting-row__title', text: 'Backup' }),
          h('div', { class: 'setting-row__desc', text: 'Save a copy of every pass as a JSON file.' })
        ),
        exportBtn
      ),
      h(
        'div',
        { class: 'setting-row' },
        h(
          'div',
          { class: 'setting-row__text' },
          h('div', { class: 'setting-row__title', text: 'Restore' }),
          h('div', { class: 'setting-row__desc', text: 'Load passes from a backup file.' })
        ),
        importBtn
      ),
      h(
        'div',
        { class: 'setting-row' },
        h(
          'div',
          { class: 'setting-row__text' },
          h('div', { class: 'setting-row__title', text: 'Erase' }),
          h('div', { class: 'setting-row__desc', text: 'Remove everything stored on this device.' })
        ),
        resetBtn
      ),
      fileInput
    ),

    h(
      'section',
      { class: 'card' },
      h('h2', { style: { marginTop: 0, fontSize: '17px' } }, 'About'),
      kv('Version', APP_VERSION),
      kv('Built', BUILD_TIME.slice(0, 10)),
      kv('Platform', platform()),
      kv('Storage', repo.isPersistent() ? 'Working' : 'Unavailable on this device'),
      kv('Passes stored', String(counts.all)),
      h('p', { class: 'field__hint', style: { marginTop: 'var(--s-3)' } },
        'A personal organiser for your own bus pass details. Not affiliated with, or an official application of, Tata Consultancy Services.')
    )
  );
}

function kv(key, value) {
  return h(
    'div',
    { class: 'kv' },
    h('span', { class: 'kv__k', text: key }),
    h('span', { class: 'kv__v', text: value })
  );
}
