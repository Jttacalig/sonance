import { EqualizerPreset } from '../types/music';

export const EQ_FREQUENCIES = [
  { key: 0, label: '60 Hz', name: 'Sub-Bass' },
  { key: 1, label: '230 Hz', name: 'Bass' },
  { key: 2, label: '910 Hz', name: 'Mid' },
  { key: 3, label: '3.6 kHz', name: 'High Mid' },
  { key: 4, label: '14 kHz', name: 'Treble' },
];

export const BUILT_IN_EQ_PRESETS: EqualizerPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    bands: [0, 0, 0, 0, 0],
  },
  {
    id: 'bass_boost',
    name: 'Bass Booster',
    bands: [8, 5, 1, 0, -2],
  },
  {
    id: 'vocal_boost',
    name: 'Vocal Booster',
    bands: [-2, 1, 6, 4, 1],
  },
  {
    id: 'hip_hop',
    name: 'Hip-Hop',
    bands: [7, 4, -1, 3, 4],
  },
  {
    id: 'rock',
    name: 'Rock',
    bands: [5, 3, -1, 4, 6],
  },
  {
    id: 'pop',
    name: 'Pop',
    bands: [-1, 2, 5, 3, -1],
  },
  {
    id: 'electronic',
    name: 'Electronic',
    bands: [6, 4, 0, 3, 5],
  },
  {
    id: 'acoustic',
    name: 'Acoustic',
    bands: [3, 2, 2, 4, 5],
  },
  {
    id: 'jazz',
    name: 'Jazz',
    bands: [4, 2, -2, 2, 4],
  },
  {
    id: 'dance',
    name: 'Dance',
    bands: [6, 7, 2, -1, 2],
  },
  {
    id: 'deep',
    name: 'Deep Bass',
    bands: [9, 6, 1, -2, -3],
  },
  {
    id: 'classical',
    name: 'Classical',
    bands: [4, 2, -1, 3, 4],
  },
];

export interface WallpaperPreset {
  id: string;
  name: string;
  colors: [string, string, string];
  secondaryColors: [string, string, string];
}

export const LIQUID_WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'neon_liquid',
    name: 'Neon Liquid',
    colors: ['#FF007A', '#7928CA', '#00F2FE'],
    secondaryColors: ['#4FACFE', '#00F2FE', '#000000'],
  },
  {
    id: 'sunset_violet',
    name: 'Sunset Violet',
    colors: ['#FF512F', '#DD2476', '#4B1248'],
    secondaryColors: ['#FF9A8B', '#FF6A88', '#1A0B2E'],
  },
  {
    id: 'midnight_dream',
    name: 'Midnight Dream',
    colors: ['#1A2A6C', '#B21F1F', '#FDBB2D'],
    secondaryColors: ['#0F2027', '#203A43', '#2C5364'],
  },
  {
    id: 'aurora_green',
    name: 'Aurora Emerald',
    colors: ['#00F260', '#0575E6', '#000428'],
    secondaryColors: ['#11998E', '#38EF7D', '#0B1D28'],
  },
  {
    id: 'cyber_ember',
    name: 'Cyber Ember',
    colors: ['#FF416C', '#8A2387', '#E94057'],
    secondaryColors: ['#F27121', '#E94057', '#0F0C20'],
  },
  {
    id: 'deep_space',
    name: 'Deep Cosmos',
    colors: ['#654EA3', '#EAAFC8', '#1E130C'],
    secondaryColors: ['#2C3E50', '#3498DB', '#0A0A16'],
  },
];
