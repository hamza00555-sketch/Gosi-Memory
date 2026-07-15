/**
 * Game audio through WebAudio (not <audio> elements): after a single
 * AudioContext.resume() inside the start-button gesture, any decoded buffer
 * can be played at any later moment — which is exactly what autoplay policies
 * on iOS/Android require. (Platform trap: every sound must trace back to a
 * user gesture; unlock() is called synchronously inside the tap, before any
 * await.)
 */

let ctx: AudioContext | null = null;
let muted = false;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  void ctx.resume();
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}

export function preloadSound(url: string): void {
  if (!ctx || buffers.has(url)) return;
  const audioCtx = ctx;
  buffers.set(
    url,
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => audioCtx.decodeAudioData(buf))
      .catch(() => null), // a broken sound must never break the game
  );
}

export function playSound(url: string, volume = 1): void {
  if (!ctx || muted) return;
  preloadSound(url);
  void buffers.get(url)?.then((buffer) => {
    if (!buffer || !ctx || muted) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
  });
}
