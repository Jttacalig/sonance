export type SourceType = 'youtube' | 'soundcloud' | 'direct' | 'imported';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  uri: string; // file:// local path
  artworkUri?: string; // file:// local artwork or remote URL
  sourceUrl?: string; // original source URL
  sourceType: SourceType;
  fileSize?: number; // in bytes
  dateAdded: number; // timestamp
  isFavorite?: boolean;
  playCount?: number;
  genre?: string;
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

export type DownloadStatus = 
  | 'idle' 
  | 'resolving' 
  | 'downloading' 
  | 'saving' 
  | 'completed' 
  | 'error';

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  artist: string;
  thumbnailUrl?: string;
  duration?: number;
  status: DownloadStatus;
  progress: number; // 0 to 1
  bytesDownloaded: number;
  totalBytes: number;
  errorMessage?: string;
  trackId?: string;
  createdAt: number;
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
  cobaltApiUrl: string;
  autoDownloadThumbnails: boolean;
  sleepTimerMinutes: number | null;
  enableHaptics: boolean;
  activeEqPresetId?: string;
  customEqBands?: [number, number, number, number, number];
  playerBackgroundTheme?: PlayerBackgroundTheme;
}
