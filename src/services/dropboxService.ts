import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { storageService, MUSIC_DIR } from './storageService';
import { fileImportService } from './fileImportService';
import { Track, UnifiedCloudItem } from '../types/music';
import { sanitizeFileName } from '../utils/urlUtils';

const DROPBOX_STORAGE_KEY = 'sonance_dropbox_tokens';
const DROPBOX_USER_KEY = 'sonance_dropbox_user';
const DROPBOX_SYNCED_FOLDERS_KEY = 'sonance_dropbox_synced_folders';

export interface DropboxTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
}

export interface DropboxUser {
  id: string;
  name: string;
  email: string;
  profilePhotoUrl?: string;
}

export interface DropboxFolderSyncRecord {
  path: string;
  name: string;
  lastSynced: number;
  trackCount: number;
}

class DropboxService {
  private tokens: DropboxTokens | null = null;
  private user: DropboxUser | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const [savedTokens, savedUser] = await Promise.all([
        AsyncStorage.getItem(DROPBOX_STORAGE_KEY),
        AsyncStorage.getItem(DROPBOX_USER_KEY),
      ]);
      if (savedTokens) this.tokens = JSON.parse(savedTokens);
      if (savedUser) this.user = JSON.parse(savedUser);
      this.initialized = true;
    } catch (e) {
      console.warn('Failed to initialize Dropbox service:', e);
    }
  }

  async isConnected(): Promise<boolean> {
    await this.init();
    return !!this.tokens?.accessToken;
  }

  async getUser(): Promise<DropboxUser | null> {
    await this.init();
    return this.user;
  }

  async saveTokens(tokens: DropboxTokens): Promise<void> {
    this.tokens = tokens;
    await AsyncStorage.setItem(DROPBOX_STORAGE_KEY, JSON.stringify(tokens));
    await this.fetchAndCacheUser();
  }

  async disconnect(): Promise<void> {
    this.tokens = null;
    this.user = null;
    await Promise.all([
      AsyncStorage.removeItem(DROPBOX_STORAGE_KEY),
      AsyncStorage.removeItem(DROPBOX_USER_KEY),
    ]);
  }

  async getAccessToken(): Promise<string | null> {
    await this.init();
    return this.tokens?.accessToken || null;
  }

  async fetchAndCacheUser(): Promise<DropboxUser | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const user: DropboxUser = {
          id: data.account_id,
          name: data.name?.display_name || 'Dropbox User',
          email: data.email || '',
          profilePhotoUrl: data.profile_photo_url,
        };
        this.user = user;
        await AsyncStorage.setItem(DROPBOX_USER_KEY, JSON.stringify(user));
        return user;
      }
    } catch (e) {
      console.warn('Failed to fetch Dropbox user profile:', e);
    }
    return null;
  }

  /**
   * Lists items in a Dropbox folder. Path is empty string '' for root.
   */
  async listFolder(path = ''): Promise<UnifiedCloudItem[]> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Not connected to Dropbox');

    const formattedPath = path === '/' || path === '' ? '' : path.startsWith('/') ? path : `/${path}`;

    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: formattedPath,
        recursive: false,
        include_media_info: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Dropbox list failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const entries = data.entries || [];

    const audioExtensions = ['mp3', 'm4a', 'flac', 'wav', 'aac', 'ogg', 'opus', 'alac'];

    const items: UnifiedCloudItem[] = [];

    for (const entry of entries) {
      const isFolder = entry['.tag'] === 'folder';
      const name = entry.name;
      const ext = name.split('.').pop()?.toLowerCase() || '';

      if (isFolder || audioExtensions.includes(ext)) {
        items.push({
          id: entry.id,
          name,
          provider: 'dropbox',
          isFolder,
          path: entry.path_lower || entry.path_display,
          size: entry.size,
          modifiedTime: entry.server_modified,
        });
      }
    }

    // Sort folders first, then files alphabetically
    return items.sort((a, b) => {
      if (a.isFolder === b.isFolder) {
        return a.name.localeCompare(b.name);
      }
      return a.isFolder ? -1 : 1;
    });
  }

  /**
   * Gets a direct temporary streaming URL for an audio file (valid for 4 hours, streamable with 0 MB storage).
   */
  async getTemporaryLink(path: string): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Not connected to Dropbox');

    const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });

    if (!res.ok) {
      throw new Error(`Failed to resolve Dropbox stream URL (${res.status})`);
    }

    const data = await res.json();
    return data.link;
  }

  /**
   * Creates a streamable Track object ready to be played with 0 MB storage.
   */
  async getStreamableTrack(item: UnifiedCloudItem): Promise<Track> {
    if (!item.path) throw new Error('Item path missing');
    const directUrl = await this.getTemporaryLink(item.path);
    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);

    const track: Track = {
      id: `dropbox_${item.id.replace(/:/g, '_')}`,
      title: title || item.name,
      artist: artist || 'Dropbox',
      album: 'Dropbox Stream',
      duration: 0,
      uri: directUrl,
      sourceUrl: `https://www.dropbox.com/home${item.path}`,
      sourceType: 'dropbox',
      fileSize: item.size,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
      isCloudStream: true,
      cloudProvider: 'dropbox',
    };

    return track;
  }

  /**
   * Recursively scans a Dropbox folder and syncs all songs into Sonance with 0 MB local storage taken.
   */
  async syncFolderRecursively(
    folderPath: string,
    folderName = 'Dropbox Music',
    onProgress?: (scannedFolders: number, addedTracks: number) => void
  ): Promise<{ syncedCount: number; newTracks: Track[] }> {
    await storageService.initStorage();
    const token = await this.getAccessToken();
    if (!token) throw new Error('Not connected to Dropbox');

    const existingTracks = await storageService.getAllTracks();
    const existingIds = new Set(existingTracks.map((t) => t.id));

    const newTracks: Track[] = [];
    const queue: string[] = [folderPath];
    const visited = new Set<string>();
    let scannedFolders = 0;

    while (queue.length > 0 && scannedFolders < 50) {
      const currentPath = queue.shift()!;
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);
      scannedFolders++;

      try {
        const items = await this.listFolder(currentPath);
        for (const item of items) {
          if (item.isFolder) {
            if (item.path && !visited.has(item.path)) {
              queue.push(item.path);
            }
          } else {
            // Audio file
            const trackId = `dropbox_${item.id.replace(/:/g, '_')}`;
            if (!existingIds.has(trackId) && item.path) {
              const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);
              
              // Resolve initial stream URL
              let initialStreamUri = '';
              try {
                initialStreamUri = await this.getTemporaryLink(item.path);
              } catch {
                initialStreamUri = `https://api.dropboxapi.com/2/files/download`;
              }

              const track: Track = {
                id: trackId,
                title: title || item.name,
                artist: artist || folderName || 'Dropbox',
                album: folderName || 'Dropbox Stream',
                duration: 0,
                uri: initialStreamUri,
                sourceUrl: item.path,
                sourceType: 'dropbox',
                fileSize: item.size,
                format: ext || 'mp3',
                dateAdded: Date.now(),
                isFavorite: false,
                playCount: 0,
                isCloudStream: true,
                cloudProvider: 'dropbox',
              };

              existingIds.add(trackId);
              newTracks.push(track);
            }
          }
        }

        if (onProgress) {
          onProgress(scannedFolders, newTracks.length);
        }
      } catch (err) {
        console.warn(`Failed to scan Dropbox folder ${currentPath}:`, err);
      }
    }

    if (newTracks.length > 0) {
      await storageService.saveTracks([...existingTracks, ...newTracks]);
    }

    // Save folder sync record
    await this.saveSyncedFolder({
      path: folderPath,
      name: folderName,
      lastSynced: Date.now(),
      trackCount: newTracks.length,
    });

    return {
      syncedCount: newTracks.length,
      newTracks,
    };
  }

  async getSyncedFolders(): Promise<DropboxFolderSyncRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(DROPBOX_SYNCED_FOLDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async saveSyncedFolder(folder: DropboxFolderSyncRecord): Promise<void> {
    try {
      const list = await this.getSyncedFolders();
      const idx = list.findIndex((f) => f.path === folder.path);
      if (idx >= 0) {
        list[idx] = folder;
      } else {
        list.push(folder);
      }
      await AsyncStorage.setItem(DROPBOX_SYNCED_FOLDERS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save Dropbox synced folder:', e);
    }
  }

  /**
   * Downloads audio file for offline listening (optional).
   */
  async downloadFile(item: UnifiedCloudItem, onProgress?: (progress: number) => void): Promise<Track> {
    const token = await this.getAccessToken();
    if (!token || !item.path) throw new Error('Dropbox credentials or item path missing');

    await storageService.initStorage();
    const directUrl = await this.getTemporaryLink(item.path);
    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);
    const safeTitle = sanitizeFileName(title);
    const trackId = `dropbox_offline_${item.id.replace(/:/g, '_')}_${Date.now()}`;
    const destUri = `${MUSIC_DIR}${trackId}_${safeTitle}.${ext || 'mp3'}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      directUrl,
      destUri,
      {},
      (progressEvent) => {
        if (progressEvent.totalBytesExpectedToWrite > 0 && onProgress) {
          const p = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
          onProgress(Math.min(1, Math.max(0, p)));
        }
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    if (!downloadResult || !downloadResult.uri) {
      throw new Error('Dropbox download failed');
    }

    let duration = 0;
    let fileSize = item.size || 0;
    try {
      const fileInfo = await FileSystem.getInfoAsync(destUri);
      if (fileInfo.exists && fileInfo.size) fileSize = fileInfo.size;
      const probePlayer = createAudioPlayer(destUri);
      if (probePlayer.duration) duration = Math.round(probePlayer.duration);
      probePlayer.remove();
    } catch (e) {
      console.warn('Audio probing warning:', e);
    }

    const track: Track = {
      id: trackId,
      title: title || item.name,
      artist: artist || 'Dropbox',
      duration: duration || 180,
      uri: destUri,
      sourceType: 'imported',
      fileSize,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
      cloudProvider: 'dropbox',
    };

    await storageService.saveTrack(track);
    return track;
  }
}

export const dropboxService = new DropboxService();
