import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';
import { Bird, Ground, MedalIcon, Parallax, Pipes, Sky, THEMES } from './src/art';
import { WORLD_H, canRestart, createState, flap, medalFor, resetState, step, type GameState } from './src/game';

const BEST_KEY = 'flappy.best.v1';
const buzz = (fn: () => Promise<void>) => { if (Platform.OS !== 'web') fn().catch(() => {}); };

export default function App() {
  const { width: sw, height: sh } = useWindowDimensions();
  const worldW = Math.max(280, Math.min(520, (sw / sh) * WORLD_H));
  const scale = sh / WORLD_H;
  const state = useRef<GameState>(createState(worldW));
  const [, render] = useReducer((n: number) => n + 1, 0);
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY).then((v) => {
      const n = Number(v) || 0;
      bestRef.current = n;
      setBest(n);
    }).catch(() => {});
  }, []);

  // keep world width in sync with window size (rotation / web resize)
  useEffect(() => {
    const s = state.current;
    s.width = worldW;
    s.birdX = worldW * 0.3;
  }, [worldW]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      const s = state.current;
      const ev = step(s, dt);
      if (ev.scored) buzz(() => Haptics.selectionAsync());
      if (ev.died) {
        buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
        if (s.score > bestRef.current) {
          bestRef.current = s.score;
          s.newBest = true;
          setBest(s.score);
          AsyncStorage.setItem(BEST_KEY, String(s.score)).catch(() => {});
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onTap = useCallback(() => {
    const s = state.current;
    if (s.phase === 'dead') {
      if (canRestart(s)) resetState(s);
      return;
    }
    if (flap(s)) buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) onTap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTap]);

  const s = state.current;
  const theme = THEMES[Math.floor(s.score / 10) % THEMES.length];
  const dead = s.phase === 'dead';
  const medal = medalFor(s.score);

  return (
    <View style={[styles.root, { backgroundColor: theme.skyBottom }]}>
      <StatusBar hidden />
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTap}
        accessibilityRole="button"
        accessibilityLabel="Flap"
      >
        <View style={{ width: sw, height: sh }} pointerEvents="none">
          <Svg width={sw} height={sh} viewBox={`0 0 ${worldW} ${WORLD_H}`} preserveAspectRatio="xMidYMid slice">
            <Sky w={worldW} theme={theme} />
            <Parallax w={worldW} time={s.time} scroll={s.scroll} theme={theme} />
            <Pipes pipes={s.pipes} />
            <Ground w={worldW} scroll={s.scroll} />
            <Bird x={s.birdX} y={s.y} vy={s.vy} time={s.time} flapAt={s.flapAt} dead={dead} />
          </Svg>

          {s.phase === 'playing' && (
            <Text style={[styles.score, { top: sh * 0.09, fontSize: 64 * Math.min(scale, 1.4) }]}>{s.score}</Text>
          )}

          {s.phase === 'ready' && (
            <View style={[styles.center, { top: sh * 0.12 }]}>
              <Text style={[styles.title, { fontSize: 54 * Math.min(scale, 1.3) }]}>FLAPPY</Text>
              <Text style={[styles.title2, { fontSize: 30 * Math.min(scale, 1.3) }]}>DASH</Text>
              <Text style={styles.best}>BEST {best}</Text>
              <Text style={[styles.hint, { opacity: 0.55 + 0.45 * Math.sin(s.time * 5) }]}>TAP TO FLY</Text>
            </View>
          )}

          {dead && (
            <View style={[styles.center, { top: sh * 0.16 }]}>
              <Text style={[styles.title, { fontSize: 44 * Math.min(scale, 1.3) }]}>GAME OVER</Text>
              <View style={styles.panel}>
                <View style={styles.row}>
                  <View style={styles.medalBox}>
                    {medal !== 'none' ? <MedalIcon kind={medal} /> : <Text style={styles.noMedal}>—</Text>}
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>SCORE</Text>
                    <Text style={styles.big}>{s.score}</Text>
                    <Text style={styles.label}>BEST {s.newBest ? '★ NEW' : ''}</Text>
                    <Text style={styles.big}>{best}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.hint, { opacity: canRestart(s) ? 1 : 0.3 }]}>TAP TO RETRY</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const outline = { textShadowColor: '#3B2A1A', textShadowRadius: 0 } as const;
const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', ...(Platform.OS === 'web' ? { userSelect: 'none' as const } : null) },
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  score: { position: 'absolute', alignSelf: 'center', color: '#fff', fontWeight: '900', textShadowColor: '#3B2A1A', textShadowOffset: { width: 3, height: 4 }, textShadowRadius: 1 },
  title: { color: '#FFD93B', fontWeight: '900', letterSpacing: 4, textShadowColor: '#3B2A1A', textShadowOffset: { width: 4, height: 5 }, textShadowRadius: 1 },
  title2: { color: '#fff', fontWeight: '900', letterSpacing: 14, marginTop: -4, textShadowColor: '#3B2A1A', textShadowOffset: { width: 3, height: 4 }, textShadowRadius: 1 },
  best: { marginTop: 14, color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2, ...outline, textShadowOffset: { width: 2, height: 2 } },
  hint: { marginTop: 22, color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 3, textShadowColor: '#3B2A1A', textShadowOffset: { width: 2, height: 3 }, textShadowRadius: 1 },
  panel: { marginTop: 18, backgroundColor: '#FFF6D6', borderColor: '#3B2A1A', borderWidth: 4, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 22, minWidth: 250 },
  row: { flexDirection: 'row', alignItems: 'center' },
  medalBox: { width: 72, alignItems: 'center', justifyContent: 'center' },
  noMedal: { fontSize: 32, color: '#B8A878', fontWeight: '900' },
  col: { flex: 1, alignItems: 'flex-end' },
  label: { color: '#C2621F', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  big: { color: '#3B2A1A', fontWeight: '900', fontSize: 30, marginBottom: 4 },
});
