// Colours for characters (skins) and sky themes. Shared by the Skia renderer and the UI.

export type Skin = {
  id: string;
  name: string;
  body: string; // main fluff
  shade: string; // fluff edge / gradient end
  belly: string;
  wing: string;
  line: string; // outline
  beak: string;
  /** what unlocks it */
  unlock: { kind: 'free' } | { kind: 'best'; value: number } | { kind: 'stars'; value: number } | { kind: 'games'; value: number };
};

export const SKINS: Skin[] = [
  { id: 'puff', name: 'Puff', body: '#FFE27A', shade: '#FFC94A', belly: '#FFF6CF', wing: '#FFD25E', line: '#6B4A2B', beak: '#FF9A55', unlock: { kind: 'free' } },
  { id: 'berry', name: 'Berry', body: '#FFB3CF', shade: '#FF8DB5', belly: '#FFE6EF', wing: '#FF9DC0', line: '#7A3553', beak: '#FF8A65', unlock: { kind: 'best', value: 5 } },
  { id: 'minty', name: 'Minty', body: '#A8EBCF', shade: '#79D9B4', belly: '#E3FAF0', wing: '#8FE2C2', line: '#2E6650', beak: '#FFB067', unlock: { kind: 'games', value: 10 } },
  { id: 'bluebell', name: 'Bluebell', body: '#AFCBFF', shade: '#86ABFA', belly: '#E6EEFF', wing: '#9ABBFF', line: '#34467E', beak: '#FFB067', unlock: { kind: 'best', value: 20 } },
  { id: 'lilac', name: 'Lilac', body: '#D7BDFF', shade: '#B996F7', belly: '#F3EAFF', wing: '#C8A8FC', line: '#4E3478', beak: '#FF9E7A', unlock: { kind: 'stars', value: 40 } },
  { id: 'cocoa', name: 'Cocoa', body: '#D9A77F', shade: '#BD8459', belly: '#F6E2CF', wing: '#C99367', line: '#4D2E19', beak: '#FFB067', unlock: { kind: 'best', value: 40 } },
];

export type Theme = {
  name: string;
  sky: [string, string, string];
  orb: string;
  orbGlow: string;
  orbY: number;
  moon: boolean;
  hillFar: string;
  hillNear: string;
  cloud: string;
  pillar: [string, string]; // body gradient
  pillarLine: string;
  cap: string;
  capShade: string;
  floor: string;
  floorShade: string;
};

export const THEME_LIST: Theme[] = [
  {
    name: 'Morning',
    sky: ['#8FD3FF', '#C9ECFF', '#FFF1F7'],
    orb: '#FFF2A8', orbGlow: '#FFF8D6', orbY: 120, moon: false,
    hillFar: '#C8EBD9', hillNear: '#A6E0C3', cloud: '#FFFFFF',
    pillar: ['#FFC7DE', '#F7A8CB'], pillarLine: '#C76E98', cap: '#FFFFFF', capShade: '#F2E3F4',
    floor: '#FFFFFF', floorShade: '#EADCF5',
  },
  {
    name: 'Sunset',
    sky: ['#FFA9A3', '#FFCB9A', '#FFE8C2'],
    orb: '#FFE08A', orbGlow: '#FFD0A0', orbY: 330, moon: false,
    hillFar: '#F5B9B5', hillNear: '#EE9EA6', cloud: '#FFF0E6',
    pillar: ['#C9B6FF', '#AE96F5'], pillarLine: '#7A62C2', cap: '#FFF6F0', capShade: '#F3DCD8',
    floor: '#FFF6F0', floorShade: '#F2D3CF',
  },
  {
    name: 'Twilight',
    sky: ['#7F7CD9', '#B49BE8', '#F2B8D8'],
    orb: '#FFE9F5', orbGlow: '#E8C9F5', orbY: 130, moon: true,
    hillFar: '#9F8FDC', hillNear: '#8A79D0', cloud: '#EBDDFF',
    pillar: ['#9EE6D3', '#7DD3BE'], pillarLine: '#3F8F7C', cap: '#F7F1FF', capShade: '#DCCDF3',
    floor: '#F4EEFF', floorShade: '#D8C8F2',
  },
  {
    name: 'Starry',
    sky: ['#1E2459', '#3A3C8C', '#6E5BAF'],
    orb: '#FFF7D1', orbGlow: '#B8B6F2', orbY: 110, moon: true,
    hillFar: '#3A3F86', hillNear: '#2E3270', cloud: '#7D7BC9',
    pillar: ['#FFD39A', '#F5B76E'], pillarLine: '#A7672A', cap: '#E9E5FF', capShade: '#B9B3EA',
    floor: '#E2DCFF', floorShade: '#ACA3E6',
  },
];

export const RIBBON_COLORS = {
  sprout: { a: '#B8F2C9', b: '#5CC98A', label: 'Sprout' },
  bloom: { a: '#FFD0E4', b: '#F27BAE', label: 'Bloom' },
  rainbow: { a: '#FFE89A', b: '#F5A623', label: 'Rainbow' },
  cosmic: { a: '#D9CCFF', b: '#8A6DF0', label: 'Cosmic' },
} as const;

export function unlockText(s: Skin): string {
  switch (s.unlock.kind) {
    case 'free': return 'Unlocked';
    case 'best': return `Score ${s.unlock.value}`;
    case 'stars': return `${s.unlock.value} stars total`;
    case 'games': return `Play ${s.unlock.value} games`;
  }
}

export function isUnlocked(s: Skin, stats: { best: number; totalStars: number; games: number }): boolean {
  switch (s.unlock.kind) {
    case 'free': return true;
    case 'best': return stats.best >= s.unlock.value;
    case 'stars': return stats.totalStars >= s.unlock.value;
    case 'games': return stats.games >= s.unlock.value;
  }
}
