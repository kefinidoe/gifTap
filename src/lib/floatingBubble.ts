import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface FloatingBubbleTapEvent {
  url: string;
  fromBubble: boolean;
}

interface FloatingBubblePlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  startOverlay(): Promise<{ running: boolean }>;
  stopOverlay(): Promise<{ running: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
  getPendingLink(): Promise<FloatingBubbleTapEvent>;
  addListener(
    eventName: 'bubbleTapped',
    listenerFunc: (event: FloatingBubbleTapEvent) => void
  ): Promise<PluginListenerHandle>;
}

const FloatingBubble = registerPlugin<FloatingBubblePlugin>('FloatingBubble');

const STORAGE_KEY = 'giftap_floating_bubble_enabled';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function getFloatingBubbleEnabledPref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setFloatingBubbleEnabledPref(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota/privacy mode errors
  }
}

export async function getOverlayState(): Promise<{
  isAndroidNative: boolean;
  permissionGranted: boolean;
  running: boolean;
}> {
  const isAndroidNative = isNativeAndroid();
  if (!isAndroidNative) {
    return {
      isAndroidNative: false,
      permissionGranted: false,
      running: getFloatingBubbleEnabledPref(),
    };
  }

  try {
    const [{ granted }, { running }] = await Promise.all([
      FloatingBubble.checkPermission(),
      FloatingBubble.isRunning(),
    ]);
    return {
      isAndroidNative: true,
      permissionGranted: granted,
      running,
    };
  } catch {
    return {
      isAndroidNative: true,
      permissionGranted: false,
      running: false,
    };
  }
}

export async function requestOverlayPermission(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const res = await FloatingBubble.requestPermission();
    return Boolean(res.granted);
  } catch {
    return false;
  }
}

export async function toggleFloatingBubble(nextEnabled: boolean): Promise<{
  enabled: boolean;
  permissionGranted: boolean;
  needsPermission: boolean;
}> {
  if (!isNativeAndroid()) {
    setFloatingBubbleEnabledPref(nextEnabled);
    return {
      enabled: nextEnabled,
      permissionGranted: false,
      needsPermission: false,
    };
  }

  if (!nextEnabled) {
    await FloatingBubble.stopOverlay().catch(() => {});
    setFloatingBubbleEnabledPref(false);
    const { granted } = await FloatingBubble.checkPermission().catch(() => ({ granted: false }));
    return {
      enabled: false,
      permissionGranted: granted,
      needsPermission: false,
    };
  }

  let { granted } = await FloatingBubble.checkPermission().catch(() => ({ granted: false }));
  if (!granted) {
    const req = await FloatingBubble.requestPermission().catch(() => ({ granted: false }));
    granted = Boolean(req.granted);
  }

  if (!granted) {
    setFloatingBubbleEnabledPref(false);
    return {
      enabled: false,
      permissionGranted: false,
      needsPermission: true,
    };
  }

  await FloatingBubble.startOverlay();
  setFloatingBubbleEnabledPref(true);
  return {
    enabled: true,
    permissionGranted: true,
    needsPermission: false,
  };
}

export async function syncFloatingBubbleOnLaunch(): Promise<void> {
  if (!isNativeAndroid()) return;
  if (!getFloatingBubbleEnabledPref()) return;
  try {
    const { granted } = await FloatingBubble.checkPermission();
    if (granted) {
      await FloatingBubble.startOverlay();
    }
  } catch {
    // Ignore startup sync error
  }
}

export async function consumePendingBubbleLink(): Promise<FloatingBubbleTapEvent | null> {
  if (!isNativeAndroid()) return null;
  try {
    const res = await FloatingBubble.getPendingLink();
    if (res.fromBubble || res.url) {
      return res;
    }
    return null;
  } catch {
    return null;
  }
}

export async function addBubbleTapListener(
  callback: (event: FloatingBubbleTapEvent) => void
): Promise<(() => void) | null> {
  if (!isNativeAndroid()) return null;
  try {
    const handle = await FloatingBubble.addListener('bubbleTapped', callback);
    return () => {
      handle.remove().catch(() => {});
    };
  } catch {
    return null;
  }
}
