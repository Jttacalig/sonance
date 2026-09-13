import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { GOOGLE_CONFIG } from '../constants/googleConfig';
import { storageService, MUSIC_DIR } from './storageService';
import { Track } from '../types/music';
import { sanitizeFileName } from '../utils/urlUtils';
import { fileImportService } from './fileImportService';

export interface GoogleUserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export interface GoogleDriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  iconLink?: string;
  isFolder: boolean;
}

export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface SyncedCloudFolder {
  id: string;
  name: string;
  lastSynced: number;
  trackCount: number;
}

const SYNCED_FOLDERS_KEY = 'sonance_synced_gdrive_folders';
const CUSTOM_CLIENT_ID_KEY = '@sonance_custom_google_client_id_v1';

class GoogleDriveService {
  private tokens: GoogleAuthTokens | null = null;
  private userProfile: GoogleUserProfile | null = null;
  private customClientId: string = '';
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const [savedTokens, savedProfile, savedClientId] = await Promise.all([
        AsyncStorage.getItem(GOOGLE_CONFIG.STORAGE_KEYS.AUTH_TOKENS),
        AsyncStorage.getItem(GOOGLE_CONFIG.STORAGE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(CUSTOM_CLIENT_ID_KEY),
      ]);

      if (savedTokens) {
        this.tokens = JSON.parse(savedTokens);
      }
      if (savedProfile) {
        this.userProfile = JSON.parse(savedProfile);
      }
      if (savedClientId) {
        this.customClientId = savedClientId;
      }
      this.initialized = true;
    } catch (e) {
      console.warn('Failed to load Google Drive auth state:', e);
    }
  }

  async getCustomClientId(): Promise<string> {
    await this.init();
    return this.customClientId || GOOGLE_CONFIG.WEB_CLIENT_ID || '';
  }

  async saveCustomClientId(clientId: string): Promise<void> {
    this.customClientId = clientId.trim();
    await AsyncStorage.setItem(CUSTOM_CLIENT_ID_KEY, clientId.trim());
  }

  async isConnected(): Promise<boolean> {
    await this.init();
    return !!this.tokens && !!this.tokens.accessToken;
  }

  async getUserProfile(): Promise<GoogleUserProfile | null> {
    await this.init();
    return this.userProfile;
  }

  async saveAuthTokens(tokens: GoogleAuthTokens): Promise<void> {
    this.tokens = tokens;
    await AsyncStorage.setItem(
      GOOGLE_CONFIG.STORAGE_KEYS.AUTH_TOKENS,
      JSON.stringify(tokens)
    );
    await this.fetchAndCacheUserProfile();
  }

  async disconnect(): Promise<void> {
    this.tokens = null;
    this.userProfile = null;
    await Promise.all([
      AsyncStorage.removeItem(GOOGLE_CONFIG.STORAGE_KEYS.AUTH_TOKENS),
      AsyncStorage.removeItem(GOOGLE_CONFIG.STORAGE_KEYS.USER_PROFILE),
    ]);
  }

  async getValidAccessToken(): Promise<string | null> {
    await this.init();
    if (!this.tokens) return null;

    // Check if token is expired (or expires in the next 60 seconds)
    const isExpired = Date.now() >= this.tokens.expiresAt - 60000;
    if (!isExpired) {
      return this.tokens.accessToken;
    }

    // Refresh if refresh token is present
    if (this.tokens.refreshToken) {
      try {
        const refreshResponse = await fetch(GOOGLE_CONFIG.TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: this.customClientId || GOOGLE_CONFIG.WEB_CLIENT_ID || GOOGLE_CONFIG.IOS_CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: this.tokens.refreshToken,
          }).toString(),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          this.tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || this.tokens.refreshToken,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          };
          await AsyncStorage.setItem(
            GOOGLE_CONFIG.STORAGE_KEYS.AUTH_TOKENS,
            JSON.stringify(this.tokens)
          );
          return this.tokens.accessToken;
        }
      } catch (err) {
        console.warn('Failed to refresh Google access token:', err);
      }
    }

    return this.tokens.accessToken;
  }

  async fetchAndCacheUserProfile(): Promise<GoogleUserProfile | null> {
    const token = await this.getValidAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(GOOGLE_CONFIG.USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const profile: GoogleUserProfile = {
          id: data.id || data.sub,
          name: data.name || data.given_name || 'Google User',
          email: data.email || '',
          picture: data.picture,
        };
        this.userProfile = profile;
        await AsyncStorage.setItem(
          GOOGLE_CONFIG.STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(profile)
        );
        return profile;
      }
    } catch (e) {
      console.warn('Failed to fetch Google profile:', e);
    }
    return null;
  }

  /**
   * Lists folders and audio files in a specified Google Drive folder.
   */
  async listFolder(folderId = 'root'): Promise<GoogleDriveItem[]> {
    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('Not signed into Google Drive');
    }

    const audioExtensionsQuery = GOOGLE_CONFIG.SUPPORTED_AUDIO_EXTENSIONS
      .map((ext) => `name contains '.${ext}'`)
      .join(' or ');

    const audioMimeTypesQuery = GOOGLE_CONFIG.SUPPORTED_AUDIO_MIME_TYPES
      .map((m) => `mimeType = '${m}'`)
      .join(' or ');

    const query = `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio/' or ${audioMimeTypesQuery} or ${audioExtensionsQuery})`;

    const params = new URLSearchParams({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, iconLink)',
      orderBy: 'folder,name',
      pageSize: '100',
    });

    const res = await fetch(`${GOOGLE_CONFIG.DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const files = data.files || [];

    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size, 10) : undefined,
      modifiedTime: file.modifiedTime,
      iconLink: file.iconLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    }));
  }

  /**
   * Searches user's entire Google Drive for audio files matching a search query.
   */
  async searchAudio(searchQuery: string): Promise<GoogleDriveItem[]> {
    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('Not signed into Google Drive');
    }

    const cleanQuery = searchQuery.replace(/'/g, "\\'");
    const query = `trashed = false and name contains '${cleanQuery}' and (mimeType contains 'audio/' or mimeType = 'application/vnd.google-apps.folder')`;

    const params = new URLSearchParams({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, iconLink)',
      orderBy: 'folder,name',
      pageSize: '50',
    });

    const res = await fetch(`${GOOGLE_CONFIG.DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Google Drive search failed (${res.status})`);
    }

    const data = await res.json();
    const files = data.files || [];

    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size, 10) : undefined,
      modifiedTime: file.modifiedTime,
      iconLink: file.iconLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    }));
  }

  /**
   * Downloads an audio file from Google Drive directly into Sonance's permanent local storage.
   */
  async downloadAudioFile(
    file: GoogleDriveItem,
    onProgress?: (progress: number) => void
  ): Promise<Track> {
    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('Google Drive access token missing or expired.');
    }

    await storageService.initStorage();

    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(file.name);
    const safeTitle = sanitizeFileName(title);
    const trackId = `gdrive_${file.id}_${Date.now()}`;
    const destUri = `${MUSIC_DIR}${trackId}_${safeTitle}.${ext || 'mp3'}`;

    const downloadUrl = `${GOOGLE_CONFIG.DRIVE_FILES_ENDPOINT}/${file.id}?alt=media`;

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      destUri,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (progressEvent) => {
        if (progressEvent.totalBytesExpectedToWrite > 0 && onProgress) {
          const p = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
          onProgress(Math.min(1, Math.max(0, p)));
        }
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    if (!downloadResult || !downloadResult.uri) {
      throw new Error('Download failed from Google Drive.');
    }

    // Probe duration and exact size
    let duration = 0;
    let fileSize = file.size || 0;

    try {
      const fileInfo = await FileSystem.getInfoAsync(destUri);
      if (fileInfo.exists && fileInfo.size) {
        fileSize = fileInfo.size;
      }
      const probePlayer = createAudioPlayer(destUri);
      if (probePlayer.duration) {
        duration = Math.round(probePlayer.duration);
      }
      probePlayer.remove();
    } catch (probeErr) {
      console.warn('Audio probing warning:', probeErr);
    }

    const track: Track = {
      id: trackId,
      title: title || file.name,
      artist: artist || 'Google Drive',
      duration: duration || 180,
      uri: destUri,
      sourceType: 'imported',
      fileSize,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
    };

    await storageService.saveTrack(track);
    return track;
  }

  /**
   * Generates a direct streamable Track for instant cloud streaming (0 MB disk space used).
   */
  async getStreamableTrack(file: GoogleDriveItem): Promise<Track> {
    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('Google Drive access token missing or expired.');
    }

    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(file.name);
    const downloadUrl = `${GOOGLE_CONFIG.DRIVE_FILES_ENDPOINT}/${file.id}?alt=media`;

    const track: Track = {
      id: `gdrive_stream_${file.id}`,
      title: title || file.name,
      artist: artist || 'Google Drive',
      album: 'Google Drive Stream',
      duration: 0,
      uri: downloadUrl,
      sourceUrl: `https://drive.google.com/file/d/${file.id}/view`,
      sourceType: 'gdrive',
      fileSize: file.size,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
      streamHeaders: {
        Authorization: `Bearer ${token}`,
      },
      isCloudStream: true,
    };

    return track;
  }

  /**
   * Adds cloud track reference to the local library without downloading audio bytes.
   */
  async addCloudTrackToLibrary(file: GoogleDriveItem): Promise<Track> {
    await storageService.initStorage();
    const track = await this.getStreamableTrack(file);
    await storageService.saveTrack(track);
    return track;
  }

  /**
   * Recursively scans a Google Drive folder and syncs all audio files into Sonance with 0 MB storage used.
   */
  async syncFolderRecursively(
    folderId: string,
    folderName = 'Cloud Music',
    onProgress?: (scannedFolders: number, addedTracks: number) => void
  ): Promise<{ syncedCount: number; newTracks: Track[] }> {
    await storageService.initStorage();
    const token = await this.getValidAccessToken();
    if (!token) {
      throw new Error('Not signed into Google Drive');
    }

    const existingTracks: Track[] = await storageService.getAllTracks();
    const existingIds = new Set(existingTracks.map((t: Track) => t.id));

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
            const streamTrackId = `gdrive_stream_${item.id}`;
            const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);
            const downloadUrl = `${GOOGLE_CONFIG.DRIVE_FILES_ENDPOINT}/${item.id}?alt=media`;

            const track: Track = {
              id: streamTrackId,
              title: title || item.name,
              artist: artist || folderName || 'Google Drive',
              album: folderName || 'Google Drive Stream',
              duration: 0,
              uri: downloadUrl,
              sourceUrl: `https://drive.google.com/file/d/${item.id}/view`,
              sourceType: 'gdrive',
              fileSize: item.size,
              format: ext || 'mp3',
              dateAdded: Date.now(),
              isFavorite: false,
              playCount: 0,
              streamHeaders: {
                Authorization: `Bearer ${token}`,
              },
              isCloudStream: true,
            };

            if (!existingIds.has(streamTrackId)) {
              existingIds.add(streamTrackId);
              newTracks.push(track);
            }
          }
        }

        if (onProgress) {
          onProgress(scannedFolders, newTracks.length);
        }
      } catch (folderErr) {
        console.warn(`Failed to scan subfolder ${currentId}:`, folderErr);
      }
    }

    if (newTracks.length > 0) {
      await storageService.saveTracks([...existingTracks, ...newTracks]);
    }

    // Save folder to synced folders registry
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

  /**
   * Retrieves all saved synced cloud folders.
   */
  async getSyncedFolders(): Promise<SyncedCloudFolder[]> {
    try {
      const raw = await AsyncStorage.getItem(SYNCED_FOLDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves or updates a synced folder record.
   */
  async saveSyncedFolder(folder: SyncedCloudFolder): Promise<void> {
    try {
      const folders = await this.getSyncedFolders();
      const existingIdx = folders.findIndex((f) => f.id === folder.id);
      if (existingIdx >= 0) {
        folders[existingIdx] = folder;
      } else {
        folders.push(folder);
      }
      await AsyncStorage.setItem(SYNCED_FOLDERS_KEY, JSON.stringify(folders));
    } catch (err) {
      console.warn('Failed to save synced folder:', err);
    }
  }

  /**
   * Removes a synced folder record.
   */
  async removeSyncedFolder(folderId: string): Promise<void> {
    try {
      const folders = await this.getSyncedFolders();
      const filtered = folders.filter((f) => f.id !== folderId);
      await AsyncStorage.setItem(SYNCED_FOLDERS_KEY, JSON.stringify(filtered));
    } catch (err) {
      console.warn('Failed to remove synced folder:', err);
    }
  }

  /**
   * Re-syncs all registered cloud folders with one tap.
   */
  async resyncAllFolders(
    onProgress?: (folderName: string, scanned: number, added: number) => void
  ): Promise<{ totalSynced: number }> {
    const folders = await this.getSyncedFolders();
    let totalSynced = 0;

    for (const folder of folders) {
      const result = await this.syncFolderRecursively(folder.id, folder.name, (scanned, added) => {
        if (onProgress) onProgress(folder.name, scanned, added);
      });
      totalSynced += result.syncedCount;
    }

    return { totalSynced };
  }
}

export const googleDriveService = new GoogleDriveService();