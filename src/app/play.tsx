// Gameplay screen: canvas + HUD, ready prompt, pause, and game-over card.
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EV_FLAP, EV_HIT, EV_LAND, EV_SCORE, EV_STAR, EV_THEME, POINTS_PER_THEME, THEMES, ribbonFor } from '../game/engine';
import { GameCanvas, type GameEvent, type GameHandle } from '../game/GameCanvas';
import { SKINS, THEME_LIST } from '../game/look';
import { buzz, play } from '../lib/sfx';
import { recordRun, useData, type RunResult } from '../lib/store';
import { BirdIcon, BubbleText, Chip, FluffyButton, Label, Panel, RibbonBadge } from '../ui/kit';
import { colors, font } from '../ui/theme';

function goMenu() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

type Over = { score: number; stars: number; result: RunResult };

export default function Play() {
  const d = useData();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const game = useRef<GameHandle>(null);
  const skinIdx = Math.max(0, SKINS.findIndex((s) => s.id === d.skin));

  const [phase, setPhase] = useState<'ready' | 'playing' | 'dead'>('ready');
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<Over | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [fps, setFps] = useState<{ fps: number; worst: number } | null>(null);
  const startedAt = useRef(0);
  const diedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onEvent = useCallback((e: GameEvent) => {
    if (e.ev & EV_FLAP) {
      play('flap');
      buzz('light');
      if (startedAt.current === 0) {
        startedAt.current = Date.now();
        setPhase('playing');
      }
    }
    if (e.ev & (EV_SCORE | EV_STAR)) {
      setScore(e.score);
      setStars(e.stars);
    }
    if (e.ev & EV_STAR) play('star');
    else if (e.ev & EV_SCORE) {
      play('score');
      buzz('select');
    }
    if (e.ev & EV_THEME) {
      const t = THEME_LIST[Math.floor(e.score / POINTS_PER_THEME) % THEMES];
      play('theme');
      setBanner(`${t.name} skies!`);
      later(() => setBanner(null), 1800);
    }
    if (e.ev & EV_HIT) {
      play('hit');
      buzz('error');
      diedAt.current = Date.now();
      setPhase('dead');
      const seconds = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
      const result = recordRun(e.score, e.stars, e.flaps, seconds);
      later(() => {
        setOver({ score: e.score, stars: e.stars, result });
        if (result.newBest && e.score > 0) {
          play('best');
          buzz('success');
        }
      }, 750);
    }
    if (e.ev & EV_LAND && !(e.ev & EV_HIT)) play('land');
  }, []);

  const restart = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    game.current?.restart();
    startedAt.current = 0;
    setOver(null);
    setScore(0);
    setStars(0);
    setBanner(null);
    setPaused(false);
    setPhase('ready');
  }, []);

  // pause when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && phase === 'playing') setPaused(true);
    });
    return () => sub.remove();
  }, [phase]);

  // keyboard on web: space / up / enter flap, P / Esc pause
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter' || e.code === 'KeyW') {
        e.preventDefault();
        if (over) {
          if (Date.now() - diedAt.current > 900) restart();
        } else if (!paused) game.current?.flap();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (phase === 'playing') setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [over, paused, phase, restart]);

  return (
    <View style={styles.root}>
      <GameCanvas
        ref={game}
        mode="play"
        skin={skinIdx}
        paused={paused}
        active={focused}
        onEvent={onEvent}
        onFps={d.showFps ? (f, w) => setFps({ fps: f, worst: w }) : undefined}
      />

      {/* HUD */}
      <View style={[styles.hud, { top: insets.top + 14 }]} pointerEvents="box-none">
        <View style={styles.hudSide}>
          {phase !== 'ready' && <Chip text={`⭐ ${stars}`} />}
        </View>
        {phase !== 'ready' && !over ? (
          <Animated.View key={score} entering={ZoomIn.springify().damping(12)}>
            <BubbleText size={64} edge={colors.lilacDeep}>{score}</BubbleText>
          </Animated.View>
        ) : <View />}
        <View style={[styles.hudSide, styles.right]}>
          {phase === 'playing' && !paused && (
            <FluffyButton icon="❚❚" tone="white" size="sm" onPress={() => setPaused(true)} accessibilityLabel="Pause" />
          )}
        </View>
      </View>

      {banner && (
        <Animated.View entering={FadeInDown} exiting={FadeOut} style={[styles.banner, { top: insets.top + 100 }]} pointerEvents="none">
          <Text style={styles.bannerText}>{banner}</Text>
        </Animated.View>
      )}

      {phase === 'ready' && <ReadyHint best={d.best} />}

      {paused && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.dim}>
          <Panel style={styles.card}>
            <BubbleText size={40} color={colors.ink} edge={colors.panelEdge} style={styles.center}>Paused</BubbleText>
            <Text style={styles.pauseScore}>Score {score} · ⭐ {stars}</Text>
            <View style={styles.gap}>
              <FluffyButton label="Resume" icon="▶" tone="mint" size="lg" onPress={() => setPaused(false)} />
              <View style={styles.row}>
                <FluffyButton label="Restart" tone="lilac" onPress={restart} style={styles.flex} />
                <FluffyButton label="Menu" tone="white" onPress={goMenu} style={styles.flex} />
              </View>
            </View>
          </Panel>
        </Animated.View>
      )}

      {over && <GameOver over={over} skin={skinIdx} onRetry={restart} />}

      {fps && (
        <View style={[styles.fps, { bottom: insets.bottom + 8 }]} pointerEvents="none">
          <Text style={styles.fpsText}>{fps.fps} fps · worst {fps.worst} ms</Text>
        </View>
      )}
    </View>
  );
}

function ReadyHint({ best }: { best: number }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0, { duration: 450 })), -1);
  }, [bob]);
  const hand = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * 10 }, { scale: 1 - bob.value * 0.08 }] }));
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut.duration(150)} style={styles.ready} pointerEvents="none">
      <BubbleText size={40} edge={colors.pinkDeep}>Get ready!</BubbleText>
      <View style={styles.readyGap} />
      <Animated.Text style={[styles.hand, hand]}>👆</Animated.Text>
      <Text style={styles.readyText}>Tap anywhere to flap</Text>
      {Platform.OS === 'web' && <Text style={styles.readySub}>or press Space</Text>}
      {best > 0 && <Text style={styles.readySub}>Best: {best}</Text>}
    </Animated.View>
  );
}

function GameOver({ over, skin, onRetry }: { over: Over; skin: number; onRetry: () => void }) {
  const ribbon = ribbonFor(over.score);
  const { result } = over;
  const best = Math.max(result.prevBest, over.score);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.dim}>
      <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.cardWrap}>
        <BubbleText size={46} edge={colors.pinkDeep} style={styles.center}>Game over</BubbleText>
        <Panel style={styles.card}>
          <View style={styles.overRow}>
            <View style={styles.badge}>
              {ribbon !== 'none' ? <RibbonBadge kind={ribbon} size={78} /> : <BirdIcon skin={skin} size={70} angle={20} />}
            </View>
            <View style={styles.overNums}>
              <Label>Score</Label>
              <Text style={styles.big}>{over.score}</Text>
              <Label>Best</Label>
              <Text style={styles.mid}>{best}</Text>
            </View>
          </View>
          <View style={styles.chips}>
            {result.newBest && over.score > 0 && <Chip text="✨ New best!" tone="sun" />}
            {result.rank !== null && result.rank <= 10 && <Chip text={`#${result.rank} on your board`} tone="lilac" />}
            <Chip text={`⭐ ${over.stars} collected`} />
          </View>
          {ribbon !== 'none' && <Text style={styles.ribbonText}>{ribbon[0].toUpperCase() + ribbon.slice(1)} ribbon earned</Text>}
        </Panel>
        <View style={styles.gap}>
          <FluffyButton label="Play again" icon="↻" tone="pink" size="lg" onPress={onRetry} />
          <View style={styles.row}>
            <FluffyButton label="Menu" tone="white" onPress={goMenu} style={styles.flex} />
            <FluffyButton label="Board" icon="🏆" tone="lilac" onPress={() => router.push('/leaderboard')} style={styles.flex} />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  hudSide: { width: 90, paddingTop: 8 },
  right: { alignItems: 'flex-end' },
  banner: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  bannerText: { fontFamily: font.bold, fontSize: 18, color: colors.ink },
  ready: { position: 'absolute', left: 0, right: 0, top: '16%', alignItems: 'center' },
  readyGap: { height: '26%' },
  hand: { fontSize: 44 },
  readyText: { fontFamily: font.bold, fontSize: 20, color: '#fff', textShadowColor: colors.lilacDeep, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, marginTop: 4 },
  readySub: { fontFamily: font.semi, fontSize: 15, color: colors.ink, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(74,55,99,0.28)', justifyContent: 'center', paddingHorizontal: 24 },
  cardWrap: { gap: 14 },
  card: {},
  center: { textAlign: 'center' },
  pauseScore: { fontFamily: font.semi, fontSize: 17, color: colors.inkSoft, textAlign: 'center', marginVertical: 12 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  overRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 96, alignItems: 'center' },
  overNums: { flex: 1, alignItems: 'flex-end' },
  big: { fontFamily: font.bold, fontSize: 44, color: colors.ink, marginBottom: 2, includeFontPadding: false },
  mid: { fontFamily: font.bold, fontSize: 28, color: colors.ink, includeFontPadding: false },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  ribbonText: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 8 },
  fps: { position: 'absolute', left: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  fpsText: { color: '#fff', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12 },
});
