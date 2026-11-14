// Main menu: live fluffy sky with the chosen bird bobbing, character picker, play.
import { router, useIsFocused } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameCanvas } from '../game/GameCanvas';
import { SKINS, isUnlocked, unlockText } from '../game/look';
import { play } from '../lib/sfx';
import { update, useData } from '../lib/store';
import { BubbleText, FluffyButton } from '../ui/kit';
import { colors, font } from '../ui/theme';

export default function Menu() {
  const d = useData();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const idx = Math.max(0, SKINS.findIndex((s) => s.id === d.skin));
  const skin = SKINS[idx];
  const stats = useMemo(() => ({ best: d.best, totalStars: d.totalStars, games: d.games }), [d.best, d.totalStars, d.games]);
  const unlocked = isUnlocked(skin, stats);
  const unlockedCount = SKINS.filter((s) => isUnlocked(s, stats)).length;

  const cycle = (dir: number) => {
    const next = SKINS[(idx + dir + SKINS.length) % SKINS.length];
    play('click');
    update({ skin: next.id });
  };

  return (
    <View style={styles.root}>
      <GameCanvas mode="menu" skin={idx} active={focused} />

      <View style={[styles.top, { paddingTop: insets.top + 36 }]} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.duration(500)}>
          <View style={styles.titleBox}>
            <BubbleText size={62} edge={colors.pinkDeep}>Flappy</BubbleText>
            <BubbleText size={46} color={colors.sun} edge={colors.lilacDeep} style={styles.dash}>Dash</BubbleText>
          </View>
        </Animated.View>
        <Pressable onPress={() => router.push('/settings')} style={styles.hello} accessibilityRole="button" accessibilityLabel="Change name">
          <Text style={styles.helloText}>Hi, {d.name} ✎</Text>
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 26 }]} pointerEvents="box-none">
        <Animated.View entering={FadeInUp.delay(120).duration(450)} style={styles.picker}>
          <FluffyButton icon="‹" tone="white" size="sm" onPress={() => cycle(-1)} accessibilityLabel="Previous character" />
          <View style={styles.pickName}>
            <Text style={styles.skinName}>{skin.name}</Text>
            <Text style={styles.skinSub}>{unlocked ? `${unlockedCount}/${SKINS.length} friends` : `🔒 ${unlockText(skin)}`}</Text>
          </View>
          <FluffyButton icon="›" tone="white" size="sm" onPress={() => cycle(1)} accessibilityLabel="Next character" />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(450)} style={styles.stats}>
          <Text style={styles.stat}>🏅 Best {d.best}</Text>
          <Text style={styles.stat}>⭐ {d.totalStars}</Text>
          <Text style={styles.stat}>🎮 {d.games}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(280).duration(450)} style={styles.actions}>
          <FluffyButton
            label={unlocked ? 'Play' : 'Locked'}
            icon={unlocked ? '▶' : '🔒'}
            tone="sun"
            size="lg"
            disabled={!unlocked}
            onPress={() => router.push('/play')}
            style={styles.play}
          />
          <View style={styles.row}>
            <FluffyButton label="Leaderboard" icon="🏆" tone="lilac" onPress={() => router.push('/leaderboard')} style={styles.flex} />
            <FluffyButton icon="⚙" tone="white" onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  titleBox: { alignItems: 'center', transform: [{ rotate: '-4deg' }] },
  dash: { marginTop: -10, letterSpacing: 10 },
  hello: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  helloText: { fontFamily: font.semi, color: colors.ink, fontSize: 15 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 14 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 30, padding: 8 },
  pickName: { alignItems: 'center', flex: 1 },
  skinName: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  skinSub: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  stat: { fontFamily: font.semi, fontSize: 15, color: colors.ink, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  actions: { gap: 10 },
  play: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
