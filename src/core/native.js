/**
 * Capacitor bridge.
 *
 * Every native plugin is imported lazily and guarded, so the exact same
 * bundle runs in a plain browser (where these are no-ops) and inside the
 * Android / iOS shells (where they drive real platform UI).
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'web' | 'android' | 'ios'
export const isAndroid = () => platform() === 'android';
export const isIOS = () => platform() === 'ios';

/**
 * Apply platform chrome: status bar colour, splash dismissal, keyboard
 * behaviour, and the Android hardware back button.
 *
 * @param {{ onBack: () => boolean }} options  onBack returns true when the
 *        app handled the press itself (a drawer or modal was open).
 */
export async function initNative({ onBack }) {
  document.documentElement.dataset.platform = platform();

  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark }); // light text on our dark UI
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: '#6200ea' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (error) {
    console.warn('[native] status bar unavailable', error);
  }

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');

    // setResizeMode is an iOS-only method; on Android the plugin answers
    // UNIMPLEMENTED. Android resizing comes from windowSoftInputMode=
    // adjustResize in the manifest instead, so only ask on iOS.
    if (isIOS()) {
      await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    }

    // Nudge the focused control into view once the keyboard height is known.
    Keyboard.addListener('keyboardDidShow', () => {
      const active = document.activeElement;
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  } catch (error) {
    console.warn('[native] keyboard plugin unavailable', error);
  }

  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (onBack()) return; // a drawer/modal consumed the press
      if (canGoBack || window.location.hash.replace('#', '') !== '/') {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (error) {
    console.warn('[native] app plugin unavailable', error);
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (error) {
    console.warn('[native] splash screen unavailable', error);
  }
}
