type ShopSound = 'gift' | 'success';

type ChimeNote = {
  frequency: number;
  start: number;
  duration: number;
  volume: number;
};

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

/** Warm up only in response to a real user action; produces no sound by itself. */
export function primeShopSound() {
  try {
    const context = getAudioContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  } catch {
    // Audio can be unavailable in some embedded browsers.
  }
}

const chimes: Record<ShopSound, ChimeNote[]> = {
  gift: [
    { frequency: 659.25, start: 0, duration: 0.19, volume: 0.035 },
    { frequency: 783.99, start: 0.1, duration: 0.22, volume: 0.032 },
    { frequency: 987.77, start: 0.2, duration: 0.32, volume: 0.028 },
  ],
  success: [
    { frequency: 523.25, start: 0, duration: 0.17, volume: 0.032 },
    { frequency: 659.25, start: 0.11, duration: 0.19, volume: 0.03 },
    { frequency: 783.99, start: 0.22, duration: 0.3, volume: 0.026 },
  ],
};

/** Short, soft UI chimes generated locally; no audio file or network request. */
export function playShopSound(sound: ShopSound) {
  try {
    const context = getAudioContext();
    if (!context) return;
    primeShopSound();

    const now = context.currentTime + 0.015;
    for (const note of chimes[sound]) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const startAt = now + note.start;
      const endAt = startAt + note.duration;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, startAt);
      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.exponentialRampToValueAtTime(note.volume, startAt + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.025);
    }
  } catch {
    // Some embedded browsers disable Web Audio; the shop still works silently.
  }
}
