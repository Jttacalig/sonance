import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track, Playlist, AppSettings } from '../types/music';
import { DEFAULT_COBALT_INSTANCES } from '../constants/endpoints';

const STORAGE_KEYS = {
  TRACKS: '@apple_player_tracks_v1',
  PLAYLISTS: '@apple_player_playlists_v1',
  SETTINGS: '@apple_player_settings_v1',
  FAVORITES: '@apple_player_favorites_v1',
  RECENT_SEARCHES: '@apple_player_recent_searches_v1',
  STORAGE_PERMISSION: '@apple_player_storage_permission_v1',
};

export const MUSIC_DIR = `${FileSystem.documentDirectory || ''}music/`;
export const ARTWORK_DIR = `${FileSystem.documentDirectory || ''}artworks/`;
export const WALLPAPER_DIR = `${FileSystem.documentDirectory || ''}wallpapers/`;

export const DEFAULT_SETTINGS: AppSettings = {
  preferredAudioQuality: 'm4a',
  cobaltApiUrl: DEFAULT_COBALT_INSTANCES[0],
  autoDownloadThumbnails: true,
  sleepTimerMinutes: null,
  enableHaptics: true,
  activeEqPresetId: 'flat',
  customEqBands: [0, 0, 0, 0, 0],
  playerBackgroundTheme: {
    type: 'artwork_aura',
    blurIntensity: 65,
    dimness: 0.25,
  },
};

class StorageService {
  private initialized = false;

  async initStorage(): Promise<void> {
    if (this.initialized) return;
    try {
      if (FileSystem.documentDirectory) {
        const musicInfo = await FileSystem.getInfoAsync(MUSIC_DIR);
        if (!musicInfo.exists) {
          await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true });
        }

        const artworkInfo = await FileSystem.getInfoAsync(ARTWORK_DIR);
        if (!artworkInfo.exists) {
          await FileSystem.makeDirectoryAsync(ARTWORK_DIR, { intermediates: true });
        }

        const wallpaperInfo = await FileSystem.getInfoAsync(WALLPAPER_DIR);
        if (!wallpaperInfo.exists) {
          await FileSystem.makeDirectoryAsync(WALLPAPER_DIR, { intermediates: true });
        }
      }
      this.initialized = true;
    } catch (error) {
      console.warn('StorageService init warning:', error);
    }
  }

  // --- TRACKS CRUD ---

  async getAllTracks(): Promise<Track[]> {
    await this.initStorage();
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRACKS);
      if (!data) return [];
      const tracks: Track[] = JSON.parse(data);

      // Normalize dynamic iOS app container paths
      const normalizedTracks = tracks.map(t => {
        let uri = t.uri;
        let artworkUri = t.artworkUri;

        if (uri && uri.startsWith('file://')) {
          const fileName = uri.split('/').pop()?.split('?')[0];
          if (fileName) {
            uri = `${MUSIC_DIR}${fileName}`;
          }
        }

        if (artworkUri && artworkUri.startsWith('file://')) {
          const artFileName = artworkUri.split('/').pop()?.split('?')[0];
          if (artFileName) {
            artworkUri = `${ARTWORK_DIR}${artFileName}`;
          }
        }

        return {
          ...t,
          uri,
          artworkUri,
        };
      });

      return normalizedTracks.sort((a, b) => b.dateAdded - a.dateAdded);
    } catch (error) {
      console.error('Error reading tracks from storage:', error);
      return [];
    }
  }

  async saveTrack(track: Track): Promise<void> {
    await this.initStorage();
    try {
      const tracks = await this.getAllTracks();
      const existingIndex = tracks.findIndex(t => t.id === track.id);
      if (existingIndex >= 0) {
        tracks[existingIndex] = track;
      } else {
        tracks.unshift(track);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
    } catch (error) {
      console.error('Error saving track:', error);
      throw error;
    }
  }

  async updateTrack(updatedTrack: Track): Promise<void> {
    await this.initStorage();
    try {
      const tracks = await this.getAllTracks();
      const newTracks = tracks.map(t => (t.id === updatedTrack.id ? updatedTrack : t));
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(newTracks));
    } catch (error) {
      console.error('Error updating track:', error);
      throw error;
    }
  }

  async deleteTrack(trackId: string): Promise<void> {
    await this.initStorage();
    try {
      const tracks = await this.getAllTracks();
      const trackToDelete = tracks.find(t => t.id === trackId);

      // Clean up files from disk
      if (trackToDelete) {
        if (trackToDelete.uri && trackToDelete.uri.startsWith('file://')) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(trackToDelete.uri);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(trackToDelete.uri, { idempotent: true });
            }
          } catch (e) {
            console.warn('Could not delete audio file from disk:', e);
          }
        }

        if (trackToDelete.artworkUri && trackToDelete.artworkUri.startsWith('file://')) {
          try {
            const artInfo = await FileSystem.getInfoAsync(trackToDelete.artworkUri);
            if (artInfo.exists) {
              await FileSystem.deleteAsync(trackToDelete.artworkUri, { idempotent: true });
            }
          } catch (e) {
            console.warn('Could not delete artwork file from disk:', e);
          }
        }
      }

      // Update storage
      const newTracks = tracks.filter(t => t.id !== trackId);
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(newTracks));

      // Remove from any playlists
      const playlists = await this.getAllPlaylists();
      let playlistsChanged = false;
      const updatedPlaylists = playlists.map(p => {
        if (p.trackIds.includes(trackId)) {
          playlistsChanged = true;
          return { ...p, trackIds: p.trackIds.filter(id => id !== trackId), updatedAt: Date.now() };
        }
        return p;
      });
      if (playlistsChanged) {
        await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updatedPlaylists));
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      throw error;
    }
  }

  async toggleFavorite(trackId: string): Promise<Track | null> {
    await this.initStorage();
    try {
      const tracks = await this.getAllTracks();
      let updatedTrack: Track | null = null;
      const newTracks = tracks.map(t => {
        if (t.id === trackId) {
          updatedTrack = { ...t, isFavorite: !t.isFavorite };
          return updatedTrack;
        }
        return t;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(newTracks));
      return updatedTrack;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return null;
    }
  }

  async incrementPlayCount(trackId: string): Promise<void> {
    await this.initStorage();
    try {
      const tracks = await this.getAllTracks();
      const newTracks = tracks.map(t => {
        if (t.id === trackId) {
          return { ...t, playCount: (t.playCount || 0) + 1 };
        }
        return t;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(newTracks));
    } catch (error) {
      console.warn('Error updating play count:', error);
    }
  }

  // --- PLAYLISTS CRUD ---

  async getAllPlaylists(): Promise<Playlist[]> {
    await this.initStorage();
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading playlists:', error);
      return [];
    }
  }

  async createPlaylist(name: string, description?: string): Promise<Playlist> {
    await this.initStorage();
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      description: description?.trim(),
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const playlists = await this.getAllPlaylists();
    playlists.push(newPlaylist);
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    return newPlaylist;
  }

  async updatePlaylist(playlist: Playlist): Promise<void> {
    await this.initStorage();
    const playlists = await this.getAllPlaylists();
    const updated = playlists.map(p => (p.id === playlist.id ? { ...playlist, updatedAt: Date.now() } : p));
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updated));
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    await this.initStorage();
    const playlists = await this.getAllPlaylists();
    const filtered = playlists.filter(p => p.id !== playlistId);
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(filtered));
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
    await this.initStorage();
    const playlists = await this.getAllPlaylists();
    const updated = playlists.map(p => {
      if (p.id === playlistId && !p.trackIds.includes(trackId)) {
        return { ...p, trackIds: [...p.trackIds, trackId], updatedAt: Date.now() };
      }
      return p;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updated));
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await this.initStorage();
    const playlists = await this.getAllPlaylists();
    const updated = playlists.map(p => {
      if (p.id === playlistId) {
        return { ...p, trackIds: p.trackIds.filter(id => id !== trackId), updatedAt: Date.now() };
      }
      return p;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updated));
  }

  // --- SETTINGS ---

  async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  async updateSettings(partialSettings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = { ...current, ...partialSettings };
    await this.saveSettings(updated);
    return updated;
  }

  // --- STORAGE STATS ---

  async getStorageUsage(): Promise<{ totalBytes: number; trackCount: number }> {
    const tracks = await this.getAllTracks();
    let totalBytes = 0;
    for (const track of tracks) {
      if (track.fileSize) {
        totalBytes += track.fileSize;
      }
    }
    return { totalBytes, trackCount: tracks.length };
  }

  // --- STORAGE PERMISSION ---

  async isStoragePermissionGranted(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.STORAGE_PERMISSION);
      return val === 'true';
    } catch {
      return false;
    }
  }

  async setStoragePermissionGranted(granted: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STORAGE_PERMISSION, granted ? 'true' : 'false');
    } catch (e) {
      console.warn('Error saving storage permission:', e);
    }
  }
}

export const storageService = new StorageService();
