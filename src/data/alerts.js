/**
 * Alerts derived from the stored passes.
 *
 * Nothing here is stored - it is recomputed from the records on every
 * change, which is what keeps the header badge and the alerts screen
 * showing the same thing.
 */
import { today, daysBetween, formatDate, compareDates } from '../core/dates.js';
import { effectiveStatus } from './schema.js';

const EXPIRY_WINDOW_DAYS = 7;

/**
 * @param {Array<object>} passes
 * @returns {Array<{id:string, level:'error'|'warn'|'info', title:string, detail:string, passId?:string}>}
 */
export function computeAlerts(passes, now = today()) {
  const alerts = [];

  for (const pass of passes) {
    const status = effectiveStatus(pass, now);

    if (status === 'expired') {
      alerts.push({
        id: `expired-${pass.id}`,
        level: 'error',
        title: `${pass.title} has expired`,
        detail: `It ended on ${formatDate(pass.endDate)}.`,
        passId: pass.id,
      });
      continue;
    }

    if (status === 'pending') {
      alerts.push({
        id: `pending-${pass.id}`,
        level: 'info',
        title: `${pass.title} is awaiting approval`,
        detail: 'Update its status once the pass is approved.',
        passId: pass.id,
      });
      continue;
    }

    if (status === 'rejected') {
      alerts.push({
        id: `rejected-${pass.id}`,
        level: 'error',
        title: `${pass.title} was not approved`,
        detail: 'Edit the pass or add a replacement.',
        passId: pass.id,
      });
      continue;
    }

    if (status === 'confirmed' && pass.endDate && compareDates(pass.startDate || '', now) <= 0) {
      const left = daysBetween(now, pass.endDate);
      if (left >= 0 && left <= EXPIRY_WINDOW_DAYS) {
        alerts.push({
          id: `expiring-${pass.id}`,
          level: 'warn',
          title:
            left === 0
              ? `${pass.title} ends today`
              : `${pass.title} ends in ${left} ${left === 1 ? 'day' : 'days'}`,
          detail: `Valid until ${formatDate(pass.endDate)}.`,
          passId: pass.id,
        });
      }
    }
  }

  const order = { error: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/** Alerts that warrant the header badge (not the purely informational ones). */
export function alertBadgeCount(alerts) {
  return alerts.filter((alert) => alert.level !== 'info').length;
}

export { EXPIRY_WINDOW_DAYS };
