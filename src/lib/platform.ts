/**
 * Platform sniffing kept in one place. WebAR's hardest problems are platform
 * quirks; detect them BEFORE the visitor taps and fails (Holoform lesson).
 */

/** Browsers embedded inside apps block getUserMedia — warn before frustration. */
export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  return /FBAN|FBAV|Instagram|WhatsApp|Snapchat|TikTok|Twitter|Line\/|MicroMessenger|; wv\)/i.test(
    ua,
  );
}

export function isIOS(ua: string = navigator.userAgent): boolean {
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    // iPadOS 13+ masquerades as macOS but has touch.
    (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  );
}

export function hasCameraSupport(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}
