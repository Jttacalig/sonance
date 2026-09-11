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
  'https://dl.khub.io',
  'https://cobalt-api.kavita.sh',
];

/**
 * Piped API instances — direct YouTube stream extraction (no proxy middleman)
 * Returns audioStreams[] with direct Google CDN URLs proxied through pipedproxy
 * Instance list: https://piped-instances.kavin.rocks/
 */
export const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.smnz.de',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.leptons.xyz',
  'https://pa.il.ax',
  'https://pipedapi.drgns.space',
];

/**
 * Invidious API instances — fallback YouTube stream extraction
 * Returns adaptiveFormats[] — MUST use ?local=true to avoid IP-bound 403 errors
 * Instance list: https://api.invidious.io/instances.json
 */
export const INVIDIOUS_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.fdn.fr',
  'https://invidious.private.coffee',
  'https://invidious.protokolla.fi',
  'https://yewtu.be',
  'https://invidious.drgns.space',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.no-val.org',
];

/**
 * Supported platform URL patterns for multi-platform download detection
 */
export const PLATFORM_PATTERNS: { name: string; icon: string; pattern: RegExp }[] = [
  { name: 'YouTube', icon: '🎬', pattern: /(?:youtube\.com|youtu\.be)/i },
  { name: 'SoundCloud', icon: '🔊', pattern: /soundcloud\.com/i },
  { name: 'Instagram', icon: '📸', pattern: /instagram\.com/i },
  { name: 'TikTok', icon: '🎵', pattern: /tiktok\.com/i },
  { name: 'Twitter', icon: '🐦', pattern: /(?:twitter\.com|x\.com)/i },
  { name: 'Facebook', icon: '📘', pattern: /(?:facebook\.com|fb\.watch)/i },
  { name: 'Spotify', icon: '💚', pattern: /(?:open\.spotify\.com)/i },
  { name: 'Reddit', icon: '🟠', pattern: /reddit\.com/i },
  { name: 'Twitch', icon: '💜', pattern: /(?:twitch\.tv|clips\.twitch\.tv)/i },
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
