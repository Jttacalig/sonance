export type SourceType =
  | 'youtube'
  | 'soundcloud'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'facebook'
  | 'spotify'
  | 'reddit'
  | 'twitch'
  | 'direct'
  | 'imported'
  | 'audius'
  | 'gdrive'
  | 'dropbox'
  | 'onedrive'
  | 'webdav'
  | 'cloud';

export type CloudProviderType = 'gdrive' | 'dropbox' | 'onedrive' | 'webdav' | 'icloud';

export interface CloudAccountInfo {
  provider: CloudProviderType;
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  serverUrl?: string; // for WebDAV
  connectedAt: number;
}

export interface UnifiedCloudItem {
  id: string;
  name: string;
  provider: CloudProviderType;
  mimeType?: string;
  size?: number;
  modifiedTime?: string;
  isFolder: boolean;
  path?: string; // provider specific path (e.g. Dropbox /music/song.mp3 or WebDAV path)
  downloadUrl?: string; // direct download or stream link if available
}

export interface NormalizedTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  durationText: string;
  thumbnailUrl: string;
  source: SourceType;
  sourceId: string;
  sourceUrl: string;
  compatibilityType?: 'official_audio' | 'music_video' | 'lyrics' | 'live' | 'remix' | 'standard';
  badgeLabel?: string;
  viewCount?: string;
  score?: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  uri: string; // file:// local path or https:// remote stream URL
  artworkUri?: string; // file:// local artwork or remote URL
  sourceUrl?: string; // original source URL
  sourceType: SourceType;
  fileSize?: number; // in bytes
  format?: string; // m4a, mp3, flac, wav
  bitrate?: number; // in kbps
  dateAdded: number; // timestamp
  isFavorite?: boolean;
  playCount?: number;
  genre?: string;
  streamHeaders?: Record<string, string>; // optional HTTP headers for cloud streams (Google Drive, WebDAV, etc.)
  isCloudStream?: boolean; // indicator if playing remotely with 0 device storage
  cloudProvider?: CloudProviderType;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  coverUri?: string;
  createdAt: number;
  updatedAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface EqualizerPreset {
  id: string;
  name: string;
  bands: [number, number, number, number, number]; // gain in dB (-12 to +12) for 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz
  isCustom?: boolean;
}

export type PlayerBackgroundType = 'artwork_aura' | 'preset' | 'custom';

export interface PlayerBackgroundTheme {
  type: PlayerBackgroundType;
  presetId?: string;
  customImageUri?: string;
  blurIntensity: number; // 0 to 100
  dimness: number; // 0 to 0.8
}

export interface PlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number; // in seconds
  duration: number; // in seconds
  playbackRate: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  volume: number;
  isLoading: boolean;
}

import { AudioFormat } from '../constants/endpoints';

export interface AppSettings {
  preferredAudioQuality: AudioFormat;
  autoDownloadThumbnails: boolean;
  sleepTimerMinutes: number | null;
  enableHaptics: boolean;
  activeEqPresetId?: string;
  customEqBands?: [number, number, number, number, number];
  playerBackgroundTheme?: PlayerBackgroundTheme;
}
