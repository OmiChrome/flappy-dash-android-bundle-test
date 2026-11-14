// Leaderboard: top runs on this device, plus lifetime stats and ribbons.
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SKINS } from '../game/look';
import { useData, type Run } from '../lib/store';
import { BirdIcon, FluffyButton, Label, Panel, RibbonBadge } from '../ui/kit';
import { Screen } from '../ui/Screen';
import { colors, font } from '../ui/theme';

const PODIUM = ['#FFD36B', '#D9DEE8', '#F2B48A'];

function when(at: number): string {
  const d = new Date(at);
  const days = Math.floor((Date.now() - at) / 86400000);
  if (days <= 0) return `Today ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString();
}

function Row({ run, rank }: { run: Run; rank: number }) {
  const skin = Math.max(0, SKINS.findIndex((s) => s.id === run.skin));
  const podium = rank <= 3;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(rank, 10) * 40).duration(300)} style={[styles.row, podium && styles.rowTop]}>
      <View style={[styles.rank, { backgroundColor: podium ? PODIUM[rank - 1] : '#F4ECFB' }]}>
        <Text style={styles.rankText}>{rank === 1 ? '👑' : rank}</Text>
      </View>
      <BirdIcon skin={skin} size={42} />
      <View style={styles.who}>
        <Text style={styles.name} numberOfLines={1}>{run.name}</Text>
        <Text style={styles.date}>{when(run.at)} · ⭐ {run.stars}</Text>
      </View>
      <Text style={[styles.score, podium && styles.scoreTop]}>{run.score}</Text>
    </Animated.View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

export default function Leaderboard() {
  const d = useData();
  const [tab, setTab] = useState<'runs' | 'stats'>('runs');
  const mins = Math.round(d.playSeconds / 60);
  return (
    <Screen title="Leaderboard">
      <View style={styles.tabs}>
        {(['runs', 'stats'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'runs' ? 'Top runs' : 'My stats'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'runs' ? (
        d.runs.length === 0 ? (
          <Panel style={styles.empty}>
            <View style={styles.emptyIn}>
              <BirdIcon skin={0} size={90} />
              <Text style={styles.emptyTitle}>No runs yet</Text>
              <Text style={styles.emptyText}>Fly through the cotton candy towers and your best runs will land here.</Text>
              <FluffyButton label="Play" icon="▶" tone="sun" onPress={() => router.replace('/play')} />
            </View>
          </Panel>
        ) : (
          <FlatList
            data={d.runs}
            keyExtractor={(r, i) => `${r.at}-${i}`}
            renderItem={({ item, index }) => <Row run={item} rank={index + 1} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        <View style={styles.statsWrap}>
          <Panel>
            <View style={styles.grid}>
              <Stat label="Best" value={d.best} />
              <Stat label="Games" value={d.games} />
              <Stat label="Average" value={d.games ? (d.totalScore / d.games).toFixed(1) : '0'} />
              <Stat label="Stars" value={d.totalStars} />
              <Stat label="Flaps" value={d.totalFlaps} />
              <Stat label="Minutes" value={mins} />
            </View>
          </Panel>
          <Panel>
            <Label>Ribbons</Label>
            <View style={styles.ribbons}>
              {(['sprout', 'bloom', 'rainbow', 'cosmic'] as const).map((k, i) => {
                const need = [10, 20, 30, 50][i];
                const got = d.best >= need;
                return (
                  <View key={k} style={[styles.ribbon, !got && styles.ribbonOff]}>
                    <RibbonBadge kind={k} size={54} />
                    <Text style={styles.ribbonText}>{got ? k : `${need}`}</Text>
                  </View>
                );
              })}
            </View>
          </Panel>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, padding: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff', shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontFamily: font.semi, fontSize: 16, color: colors.inkSoft },
  tabTextOn: { color: colors.ink },
  list: { gap: 8, paddingBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22, paddingVertical: 8, paddingHorizontal: 10 },
  rowTop: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F7E6A8' },
  rank: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  who: { flex: 1 },
  name: { fontFamily: font.semi, fontSize: 17, color: colors.ink },
  date: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },
  score: { fontFamily: font.bold, fontSize: 26, color: colors.ink, minWidth: 44, textAlign: 'right' },
  scoreTop: { color: colors.pinkDeep },
  empty: { marginTop: 20 },
  emptyIn: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  emptyTitle: { fontFamily: font.bold, fontSize: 24, color: colors.ink },
  emptyText: { fontFamily: font.regular, fontSize: 15, color: colors.inkSoft, textAlign: 'center', marginBottom: 8 },
  statsWrap: { gap: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '33.33%', alignItems: 'center', paddingVertical: 10 },
  statValue: { fontFamily: font.bold, fontSize: 28, color: colors.ink },
  statLabel: { fontSize: 12 },
  ribbons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  ribbon: { alignItems: 'center' },
  ribbonOff: { opacity: 0.3 },
  ribbonText: { fontFamily: font.semi, fontSize: 12, color: colors.inkSoft, textTransform: 'capitalize' },
});
