/**
 * Cobalt API and audio extraction endpoints
 * Multiple public instances configured for redundancy and uptime
 */
export const DEFAULT_COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.api.scnr.me',
  'https://cobalt.synap.tech',
  'https://cobalt.api.timetravelers.eu',
  'https://cobalt.canine.tools',
  'https://cobalt.shyim.net',
  'https://cobalt.pervert.icu',
];

export type AudioFormat = 'm4a' | 'mp3' | 'flac' | 'opus' | 'wav';

export interface AudioFormatOption {
  id: AudioFormat;
  label: string;
  tag: string;
  extension: string;
  bitrate: string;
  description: string;
  recommended?: boolean;
}

export const AUDIO_FORMAT_OPTIONS: AudioFormatOption[] = [
  {
    id: 'm4a',
    label: 'M4A / AAC',
    tag: 'Apple Native',
    extension: 'm4a',
    bitrate: '256 kbps',
    description: 'Hardware accelerated, pristine fidelity for iOS & Sonance Player',
    recommended: true,
  },
  {
    id: 'mp3',
    label: 'MP3',
    tag: 'High Fidelity',
    extension: 'mp3',
    bitrate: '320 kbps',
    description: 'Universal compatibility across all devices and players',
  },
  {
    id: 'flac',
    label: 'FLAC',
    tag: 'Lossless',
    extension: 'flac',
    bitrate: '1411 kbps',
    description: 'Studio master quality with zero audio data loss',
  },
  {
    id: 'wav',
    label: 'WAV',
    tag: 'Uncompressed',
    extension: 'wav',
    bitrate: '1411 kbps',
    description: 'Raw uncompressed PCM audio fidelity',
  },
  {
    id: 'opus',
    label: 'AAC+ / HE',
    tag: 'Ultra Efficient',
    extension: 'm4a',
    bitrate: '160 kbps',
    description: 'High-efficiency Apple native AAC audio for compact storage',
  },
];

export const QUICK_SEARCH_CHIPS = [
  { label: '🔥 Top Hits', query: 'Top Billboard Songs 2026' },
  { label: '🎧 Lofi Beats', query: 'Lofi hip hop beats to chill relax study' },
  { label: '⚡ Pop & Dance', query: 'Top Pop Music Hits' },
  { label: '🎸 Rock Classics', query: 'Greatest Rock Classics' },
  { label: '🌊 R&B & Soul', query: 'R&B Soul Chill Music' },
  { label: '🎹 Piano & Acoustic', query: 'Peaceful Piano Acoustic Music' },
  { label: '🌙 Night Vibes', query: 'Late night drive synthwave lofi' },
];

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
