// The game view. Simulation, input and drawing all run on the UI thread:
//  - useFrameCallback advances the engine with fixed steps,
//  - a derived value records the frame as one Skia picture,
//  - a touch-down gesture worklet flaps with no JS-thread round trip.
// React only hears about discrete events (score, death, ...) via scheduleOnRN.
import { Canvas, Picture, createPicture } from '@shopify/react-native-skia';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useManualGesture } from 'react-native-gesture-handler';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { runOnUI, scheduleOnRN } from 'react-native-worklets';
import { DEAD, PLAYING, WORLD_H, advance, createState, flap, resetState, setWidth, takeEvents, type GameState } from './engine';
import { drawScene, getResources } from './render';

export type GameEvent = { ev: number; score: number; stars: number; flaps: number; phase: number; time: number };
export type GameHandle = { flap: () => void; restart: () => void };

/** Benchmark mode: seeded autopilot run; every frame time is recorded on the UI thread. */
export type Bench = { seconds: number; seed: number; onDone: (frameMs: number[], score: number) => void };

type Props = {
  mode: 'menu' | 'play';
  bench?: Bench;
  skin: number;
  paused?: boolean;
  active?: boolean; // false stops the frame loop entirely (screen not focused)
  onEvent?: (e: GameEvent) => void;
  onFps?: (fps: number, worstMs: number) => void;
};

export const GameCanvas = forwardRef<GameHandle, Props>(function GameCanvas(
  { mode, skin, paused = false, active = true, onEvent, onFps, bench },
  ref,
) {
  const res = useMemo(getResources, []);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const state = useSharedValue<GameState | null>(null);
  const tickSV = useSharedValue(0);
  const sizeSV = useSharedValue({ w: 0, h: 0 });
  const skinSV = useSharedValue(skin);
  const pausedSV = useSharedValue(paused);
  const inputSV = useSharedValue(mode === 'play');
  const fpsSV = useSharedValue({ frames: 0, ms: 0, worst: 0 });
  const benchSeconds = bench?.seconds ?? 0;
  const benchSeed = bench?.seed ?? 0;
  const benchSV = useSharedValue({ on: false, until: 0, elapsed: 0, n: 0, times: [] as number[] });

  useEffect(() => { skinSV.value = skin; }, [skin, skinSV]);
  useEffect(() => { pausedSV.value = paused; }, [paused, pausedSV]);
  useEffect(() => { inputSV.value = mode === 'play'; }, [mode, inputSV]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((old) => (old.w === width && old.h === height ? old : { w: width, h: height }));
  }, []);

  useEffect(() => {
    if (!size.h) return;
    const worldW = size.w / (size.h / WORLD_H);
    const menu = mode === 'menu';
    sizeSV.value = { w: size.w, h: size.h };
    runOnUI((ww: number, secs: number, seed: number) => {
      'worklet';
      if (secs > 0) {
        if (!state.value || !benchSV.value.on) {
          // fresh deterministic run; preallocate room for 144 Hz frames
          state.value = createState(ww, seed);
          state.value.bot = true;
          const times: number[] = new Array(Math.ceil(secs * 150));
          benchSV.value = { on: true, until: secs * 1000, elapsed: 0, n: 0, times };
        } else setWidth(state.value, ww);
        return;
      }
      if (!state.value) state.value = createState(ww);
      else setWidth(state.value, ww);
      if (menu) state.value.birdX = ww * 0.5;
    })(worldW, benchSeconds, benchSeed);
  }, [size, mode, sizeSV, state, benchSeconds, benchSeed, benchSV]);

  // latest callbacks, called from the UI thread
  const evRef = useRef(onEvent);
  evRef.current = onEvent;
  const fpsRef = useRef(onFps);
  fpsRef.current = onFps;
  const emitEvent = useCallback((ev: number, score: number, stars: number, flaps: number, phase: number, time: number) => {
    evRef.current?.({ ev, score, stars, flaps, phase, time });
  }, []);
  const emitFps = useCallback((fps: number, worst: number) => fpsRef.current?.(fps, worst), []);
  const benchRef = useRef(bench);
  benchRef.current = bench;
  const emitBench = useCallback((times: number[], score: number) => benchRef.current?.onDone(times, score), []);
  const fpsOn = useSharedValue(!!onFps);
  const hasFps = !!onFps;
  useEffect(() => { fpsOn.value = hasFps; }, [hasFps, fpsOn]);

  const frame = useFrameCallback((fi) => {
    'worklet';
    const s = state.value;
    if (!s) return;
    const dtMs = fi.timeSincePreviousFrame ?? 0;
    if (pausedSV.value) return;
    advance(s, dtMs / 1000);
    const ev = takeEvents(s);
    if (ev) scheduleOnRN(emitEvent, ev, s.score, s.stars, s.flaps, s.phase, s.time);
    tickSV.value = tickSV.value + 1;
    const b = benchSV.value;
    if (b.on && dtMs > 0) {
      if (b.n < b.times.length) b.times[b.n++] = dtMs;
      b.elapsed += dtMs;
      if (b.elapsed >= b.until) {
        b.on = false;
        scheduleOnRN(emitBench, b.times.slice(0, b.n), s.score);
      }
    }
    if (fpsOn.value && dtMs > 0) {
      const f = fpsSV.value;
      f.frames += 1;
      f.ms += dtMs;
      if (dtMs > f.worst) f.worst = dtMs;
      if (f.ms >= 500) {
        scheduleOnRN(emitFps, Math.round((f.frames * 1000) / f.ms), Math.round(f.worst));
        f.frames = 0;
        f.ms = 0;
        f.worst = 0;
      }
    }
  }, false);

  useEffect(() => {
    frame.setActive(active);
  }, [active, frame]);

  const picture = useDerivedValue(() => {
    // eslint-disable-next-line no-unused-expressions -- subscribe: redraw on every simulated frame
    tickSV.value;
    const s = state.value;
    const sz = sizeSV.value;
    const sk = skinSV.value;
    return createPicture((c) => {
      'worklet';
      if (s && sz.h > 0) drawScene(c, s, res, sk, sz.w, sz.h);
    });
  });

  const gesture = useManualGesture({
    onTouchesDown: () => {
      'worklet';
      const s = state.value;
      if (!s || !inputSV.value || pausedSV.value) return;
      if (s.phase !== DEAD) flap(s);
    },
  });

  useImperativeHandle(ref, () => ({
    flap: () => {
      runOnUI(() => {
        'worklet';
        const s = state.value;
        if (s && !pausedSV.value && s.phase !== DEAD) flap(s);
      })();
    },
    restart: () => {
      runOnUI(() => {
        'worklet';
        const s = state.value;
        if (s) resetState(s);
      })();
    },
  }), [state, pausedSV]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} onLayout={onLayout} accessibilityRole="button" accessibilityLabel={mode === 'play' ? 'Tap to flap' : undefined}>
        {size.h > 0 && (
          <Canvas style={StyleSheet.absoluteFill}>
            <Picture picture={picture} />
          </Canvas>
        )}
      </View>
    </GestureDetector>
  );
});

export { PLAYING };
