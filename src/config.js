/**
 * Build-time configuration.
 *
 * Values are injected by Vite (see vite.config.js). Nothing secret belongs
 * here: everything in this file ships inside the client bundle and inside
 * the Android and iOS app packages, where it is readable by anyone who
 * unpacks the app.
 */
export const APP_VERSION = __APP_VERSION__;
export const BUILD_TIME = __BUILD_TIME__;

/** Canonical origin, used for the canonical link and social metadata. */
export const SITE_URL = import.meta.env.VITE_SITE_URL || '';
