// Sound effects + haptics. Players are created once and restarted on each play.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { getData } from './store';

const SOURCES = {
  flap: require('../../assets/sfx/flap.wav'),
  score: require('../../assets/sfx/score.wav'),
  star: require('../../assets/sfx/star.wav'),
  hit: require('../../assets/sfx/hit.wav'),
  land: require('../../assets/sfx/land.wav'),
  click: require('../../assets/sfx/click.wav'),
  best: require('../../assets/sfx/best.wav'),
  theme: require('../../assets/sfx/theme.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

const VOLUME: Record<Sfx, number> = { flap: 0.45, score: 0.7, star: 0.7, hit: 0.8, land: 0.6, click: 0.5, best: 0.8, theme: 0.5 };

let players: Partial<Record<Sfx, AudioPlayer>> = {};
let ready = false;

export function initSfx(): void {
  if (ready) return;
  ready = true;
  // mix with the player's own music instead of stopping it
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  for (const k of Object.keys(SOURCES) as Sfx[]) {
    try {
      const p = createAudioPlayer(SOURCES[k]);
      p.volume = VOLUME[k];
      players[k] = p;
    } catch {
      // audio unavailable (e.g. headless web) - stay silent
    }
  }
}

export function play(name: Sfx): void {
  if (!getData().sound) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // ignore
  }
}

const canBuzz = Platform.OS !== 'web';
export function buzz(kind: 'light' | 'select' | 'error' | 'success'): void {
  if (!canBuzz || !getData().haptics) return;
  const run = () => {
    switch (kind) {
      case 'light': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'select': return Haptics.selectionAsync();
      case 'error': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'success': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  run().catch(() => {});
}

export function disposeSfx(): void {
  for (const p of Object.values(players)) p?.remove();
  players = {};
  ready = false;
}
