import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { storageService, MUSIC_DIR } from './storageService';
import { fileImportService } from './fileImportService';
import { Track, UnifiedCloudItem } from '../types/music';
import { sanitizeFileName } from '../utils/urlUtils';

const ONEDRIVE_STORAGE_KEY = 'sonance_onedrive_tokens';
const ONEDRIVE_USER_KEY = 'sonance_onedrive_user';
const ONEDRIVE_SYNCED_FOLDERS_KEY = 'sonance_onedrive_synced_folders';

export interface OneDriveTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface OneDriveUser {
  id: string;
  name: string;
  email: string;
}

export interface OneDriveFolderSyncRecord {
  id: string;
  name: string;
  lastSynced: number;
  trackCount: number;
}

class OneDriveService {
  private tokens: OneDriveTokens | null = null;
  private user: OneDriveUser | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const [savedTokens, savedUser] = await Promise.all([
        AsyncStorage.getItem(ONEDRIVE_STORAGE_KEY),
        AsyncStorage.getItem(ONEDRIVE_USER_KEY),
      ]);
      if (savedTokens) this.tokens = JSON.parse(savedTokens);
      if (savedUser) this.user = JSON.parse(savedUser);
      this.initialized = true;
    } catch (e) {
      console.warn('Failed to initialize OneDrive service:', e);
    }
  }

  async isConnected(): Promise<boolean> {
    await this.init();
    return !!this.tokens?.accessToken;
  }

  async getUser(): Promise<OneDriveUser | null> {
    await this.init();
    return this.user;
  }

  async saveTokens(tokens: OneDriveTokens): Promise<void> {
    this.tokens = tokens;
    await AsyncStorage.setItem(ONEDRIVE_STORAGE_KEY, JSON.stringify(tokens));
    await this.fetchAndCacheUser();
  }

  async disconnect(): Promise<void> {
    this.tokens = null;
    this.user = null;
    await Promise.all([
      AsyncStorage.removeItem(ONEDRIVE_STORAGE_KEY),
      AsyncStorage.removeItem(ONEDRIVE_USER_KEY),
    ]);
  }

  async getValidAccessToken(): Promise<string | null> {
    await this.init();
    if (!this.tokens) return null;
    return this.tokens.accessToken;
  }

  async fetchAndCacheUser(): Promise<OneDriveUser | null> {
    const token = await this.getValidAccessToken();
    if (!token) return null;

    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const user: OneDriveUser = {
          id: data.id,
          name: data.displayName || 'OneDrive User',
          email: data.userPrincipalName || data.mail || '',
        };
        this.user = user;
        await AsyncStorage.setItem(ONEDRIVE_USER_KEY, JSON.stringify(user));
        return user;
      }
    } catch (e) {
      console.warn('Failed to fetch OneDrive profile:', e);
    }
    return null;
  }

  /**
   * Lists items in OneDrive folder. Pass 'root' or empty string for root.
   */
  async listFolder(itemId = 'root'): Promise<UnifiedCloudItem[]> {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not connected to OneDrive');

    const endpoint =
      itemId === 'root' || !itemId
        ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
        : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/children`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OneDrive list failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const value = data.value || [];

    const audioExtensions = ['mp3', 'm4a', 'flac', 'wav', 'aac', 'ogg', 'opus', 'alac'];

    const items: UnifiedCloudItem[] = [];

    for (const item of value) {
      const isFolder = !!item.folder;
      const name = item.name;
      const ext = name.split('.').pop()?.toLowerCase() || '';

      if (isFolder || audioExtensions.includes(ext)) {
        items.push({
          id: item.id,
          name,
          provider: 'onedrive',
          isFolder,
          size: item.size,
          modifiedTime: item.lastModifiedDateTime,
          downloadUrl: item['@microsoft.graph.downloadUrl'],
        });
      }
    }

    return items.sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });
  }

  /**
   * Resolves direct download / stream link for OneDrive file.
   */
  async getStreamUrl(itemId: string): Promise<string> {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not connected to OneDrive');

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Failed to resolve OneDrive stream');
    const data = await res.json();
    const downloadUrl = data['@microsoft.graph.downloadUrl'];
    if (!downloadUrl) throw new Error('No downloadUrl found for item');
    return downloadUrl;
  }

  /**
   * Creates a streamable Track object ready to be played with 0 MB storage.
   */
  async getStreamableTrack(item: UnifiedCloudItem): Promise<Track> {
    const streamUrl = item.downloadUrl || (await this.getStreamUrl(item.id));
    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);

    const track: Track = {
      id: `onedrive_${item.id}`,
      title: title || item.name,
      artist: artist || 'OneDrive',
      album: 'OneDrive Stream',
      duration: 0,
      uri: streamUrl,
      sourceUrl: `https://onedrive.live.com/?id=${item.id}`,
      sourceType: 'onedrive',
      fileSize: item.size,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
      isCloudStream: true,
      cloudProvider: 'onedrive',
    };

    return track;
  }

  /**
   * Recursively scans a OneDrive folder and syncs all songs into Sonance with 0 MB local storage taken.
   */
  async syncFolderRecursively(
    folderId = 'root',
    folderName = 'OneDrive Music',
    onProgress?: (scannedFolders: number, addedTracks: number) => void
  ): Promise<{ syncedCount: number; newTracks: Track[] }> {
    await storageService.initStorage();
    const token = await this.getValidAccessToken();
    if (!token) throw new Error('Not connected to OneDrive');

    const existingTracks = await storageService.getAllTracks();
    const existingIds = new Set(existingTracks.map((t) => t.id));

    const newTracks: Track[] = [];
    const queue: string[] = [folderId];
    const visited = new Set<string>();
    let scannedFolders = 0;

    while (queue.length > 0 && scannedFolders < 50) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      scannedFolders++;

      try {
        const items = await this.listFolder(currentId);
        for (const item of items) {
          if (item.isFolder) {
            if (!visited.has(item.id)) {
              queue.push(item.id);
            }
          } else {
            // Audio file
            const trackId = `onedrive_${item.id}`;
            if (!existingIds.has(trackId)) {
              const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);
              const streamUrl = item.downloadUrl || '';

              const track: Track = {
                id: trackId,
                title: title || item.name,
                artist: artist || folderName || 'OneDrive',
                album: folderName || 'OneDrive Stream',
                duration: 0,
                uri: streamUrl,
                sourceUrl: item.id,
                sourceType: 'onedrive',
                fileSize: item.size,
                format: ext || 'mp3',
                dateAdded: Date.now(),
                isFavorite: false,
                playCount: 0,
                isCloudStream: true,
                cloudProvider: 'onedrive',
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
        console.warn(`Failed to scan OneDrive folder ${currentId}:`, err);
      }
    }

    if (newTracks.length > 0) {
      await storageService.saveTracks([...existingTracks, ...newTracks]);
    }

    await this.saveSyncedFolder({
      id: folderId,
      name: folderName,
      lastSynced: Date.now(),
      trackCount: newTracks.length,
    });

    return {
      syncedCount: newTracks.length,
      newTracks,
    };
  }

  async getSyncedFolders(): Promise<OneDriveFolderSyncRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(ONEDRIVE_SYNCED_FOLDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async saveSyncedFolder(folder: OneDriveFolderSyncRecord): Promise<void> {
    try {
      const list = await this.getSyncedFolders();
      const idx = list.findIndex((f) => f.id === folder.id);
      if (idx >= 0) {
        list[idx] = folder;
      } else {
        list.push(folder);
      }
      await AsyncStorage.setItem(ONEDRIVE_SYNCED_FOLDERS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save OneDrive synced folder:', e);
    }
  }

  /**
   * Downloads audio file for offline playback (optional).
   */
  async downloadFile(item: UnifiedCloudItem, onProgress?: (progress: number) => void): Promise<Track> {
    const downloadUrl = item.downloadUrl || (await this.getStreamUrl(item.id));
    await storageService.initStorage();

    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);
    const safeTitle = sanitizeFileName(title);
    const trackId = `onedrive_offline_${item.id}_${Date.now()}`;
    const destUri = `${MUSIC_DIR}${trackId}_${safeTitle}.${ext || 'mp3'}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
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
      throw new Error('OneDrive download failed');
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
      artist: artist || 'OneDrive',
      duration: duration || 180,
      uri: destUri,
      sourceType: 'imported',
      fileSize,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
      cloudProvider: 'onedrive',
    };

    await storageService.saveTrack(track);
    return track;
  }
}

export const oneDriveService = new OneDriveService();
