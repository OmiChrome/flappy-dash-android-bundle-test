// Benchmark: a seeded 60 s autopilot run. Records every frame time on the UI thread,
// then shows avg fps, 1% low, percentiles and dropped frames. Results can be shared.
import Constants from 'expo-constants';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameCanvas, type Bench } from '../game/GameCanvas';
import { benchStats, formatBench, type BenchStats } from '../lib/benchStats';
import { isExpoGo } from '../lib/observe';
import { BubbleText, Chip, FluffyButton, Label, Panel } from '../ui/kit';
import { goBack } from '../ui/Screen';
import { colors, font } from '../ui/theme';

const SECONDS = 60;
const SEED = 1234;

function deviceLine(): string {
  const c = Platform.constants as unknown as Record<string, unknown>;
  if (Platform.OS === 'android') return `${c.Manufacturer ?? ''} ${c.Model ?? ''} · Android ${c.Release ?? Platform.Version}`.trim();
  if (Platform.OS === 'ios') return `iOS ${Platform.Version}`;
  return typeof navigator !== 'undefined' ? navigator.userAgent.split(') ')[0].replace('Mozilla/5.0 (', '') : 'web';
}

export default function BenchScreen() {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [run, setRun] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [fps, setFps] = useState(0);
  const [result, setResult] = useState<{ stats: BenchStats; score: number } | null>(null);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setLeft(Math.max(0, SECONDS - Math.floor((Date.now() - start) / 1000))), 500);
    return () => clearInterval(t);
  }, [run]);

  const bench = useMemo<Bench>(() => ({
    seconds: SECONDS,
    seed: SEED,
    onDone: (times, score) => {
      const stats = benchStats(times);
      // one line for the emulator CI (bench/emulator-bench.sh reads it from logcat)
      console.log(`RESULT framework=expo | avg ${stats.avgFps.toFixed(1)} fps | 1% low ${stats.low1Fps.toFixed(0)} | dropped ${stats.droppedPct.toFixed(1)}% | p50 ${stats.p50.toFixed(1)} | p95 ${stats.p95.toFixed(1)} | p99 ${stats.p99.toFixed(1)} | max ${stats.worst.toFixed(1)} ms | frames ${stats.frames} | display ${stats.refreshHz} Hz`);
      setResult({ stats, score });
    },
  }), []);

  const meta = {
    app: `Flappy Dash ${Constants.expoConfig?.version ?? ''} (Expo / React Native${isExpoGo ? ', Expo Go' : ''}${__DEV__ ? ', DEV build' : ''})`,
    device: deviceLine(),
    'bot score': result?.score ?? 0,
  };

  return (
    <View style={styles.root}>
      {!result && (
        <GameCanvas key={run} mode="play" skin={0} active={focused} bench={bench} onFps={(f) => setFps(f)} />
      )}
      {!result && (
        <View style={[styles.hud, { top: insets.top + 14 }]} pointerEvents="none">
          <Chip text={`Benchmark · ${left}s`} tone="sun" />
          <Chip text={`${fps} fps`} />
        </View>
      )}
      {result && (
        <Animated.View entering={FadeIn} style={[styles.result, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
          <BubbleText size={38} edge={colors.lilacDeep} style={styles.center}>Benchmark</BubbleText>
          <Animated.View entering={FadeInDown.springify().damping(14)}>
            <Panel>
              <View style={styles.bigRow}>
                <View style={styles.bigCell}>
                  <Text style={styles.big}>{result.stats.avgFps.toFixed(1)}</Text>
                  <Label>avg fps</Label>
                </View>
                <View style={styles.bigCell}>
                  <Text style={styles.big}>{result.stats.low1Fps.toFixed(0)}</Text>
                  <Label>1% low</Label>
                </View>
                <View style={styles.bigCell}>
                  <Text style={styles.big}>{result.stats.droppedPct.toFixed(1)}%</Text>
                  <Label>dropped</Label>
                </View>
              </View>
              <View style={styles.sep} />
              <Text style={styles.line}>Display ≈ {result.stats.refreshHz} Hz · {result.stats.frames} frames in {result.stats.seconds.toFixed(1)} s</Text>
              <Text style={styles.line}>Frame time p50 {result.stats.p50.toFixed(1)} · p95 {result.stats.p95.toFixed(1)} · p99 {result.stats.p99.toFixed(1)} · max {result.stats.worst.toFixed(1)} ms</Text>
              <Text style={styles.line}>Dropped {result.stats.dropped} · janky (&gt;2×) {result.stats.jank}</Text>
              <Text style={styles.small}>{meta.device}</Text>
              <Text style={styles.small}>{meta.app}</Text>
              {(__DEV__ || isExpoGo) && <Text style={styles.warn}>Dev / Expo Go builds are slower. Use the release APK for real numbers.</Text>}
            </Panel>
          </Animated.View>
          <View style={styles.gap}>
            <FluffyButton label="Share results" icon="↗" tone="mint" onPress={() => Share.share({ message: formatBench(result.stats, meta) }).catch(() => {})} />
            <View style={styles.row}>
              <FluffyButton label="Run again" tone="lilac" onPress={() => { setResult(null); setLeft(SECONDS); setRun((r) => r + 1); }} style={styles.flex} />
              <FluffyButton label="Done" tone="white" onPress={() => (router.canGoBack() ? goBack() : router.replace('/'))} style={styles.flex} />
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  result: { flex: 1, paddingHorizontal: 20, gap: 16, justifyContent: 'center' },
  center: { textAlign: 'center' },
  bigRow: { flexDirection: 'row' },
  bigCell: { flex: 1, alignItems: 'center' },
  big: { fontFamily: font.bold, fontSize: 32, color: colors.ink },
  sep: { height: 2, backgroundColor: '#F4ECFB', marginVertical: 12, borderRadius: 1 },
  line: { fontFamily: font.regular, fontSize: 14, color: colors.ink, marginBottom: 4 },
  small: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  warn: { fontFamily: font.semi, fontSize: 12, color: colors.pinkDeep, marginTop: 8 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
