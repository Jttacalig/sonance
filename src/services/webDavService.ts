import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { storageService, MUSIC_DIR } from './storageService';
import { fileImportService } from './fileImportService';
import { Track, UnifiedCloudItem } from '../types/music';
import { sanitizeFileName } from '../utils/urlUtils';

const WEBDAV_CONFIG_KEY = 'sonance_webdav_config';
const WEBDAV_SYNCED_FOLDERS_KEY = 'sonance_webdav_synced_folders';

export interface WebDavConfig {
  serverUrl: string; // e.g. https://cloud.example.com/remote.php/webdav or http://192.168.1.100:5005
  username: string;
  password?: string;
  serverName?: string;
}

export interface WebDavFolderSyncRecord {
  path: string;
  name: string;
  lastSynced: number;
  trackCount: number;
}

class WebDavService {
  private config: WebDavConfig | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const saved = await AsyncStorage.getItem(WEBDAV_CONFIG_KEY);
      if (saved) {
        this.config = JSON.parse(saved);
      }
      this.initialized = true;
    } catch (e) {
      console.warn('Failed to initialize WebDAV service:', e);
    }
  }

  async isConnected(): Promise<boolean> {
    await this.init();
    return !!this.config?.serverUrl;
  }

  async getConfig(): Promise<WebDavConfig | null> {
    await this.init();
    return this.config;
  }

  async saveConfig(config: WebDavConfig): Promise<void> {
    // Normalize serverUrl
    let url = config.serverUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    this.config = { ...config, serverUrl: url };
    await AsyncStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(this.config));
  }

  async disconnect(): Promise<void> {
    this.config = null;
    await AsyncStorage.removeItem(WEBDAV_CONFIG_KEY);
  }

  private getAuthHeader(): string {
    if (!this.config || !this.config.username) return '';
    const userPass = `${this.config.username}:${this.config.password || ''}`;
    // Simple base64 encoding without external dependencies
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = userPass;
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || ((map = '='), i % 1); output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
      charCode = str.charCodeAt((i += 3 / 4));
      if (charCode > 0xff) {
        throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = (block << 8) | charCode;
    }
    return `Basic ${output}`;
  }

  /**
   * Tests WebDAV server connection by performing a PROPFIND on root path.
   */
  async testConnection(config: WebDavConfig): Promise<{ success: boolean; message: string }> {
    let url = config.serverUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    const userPass = `${config.username}:${config.password || ''}`;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars; userPass.charAt(i | 0) || ((map = '='), i % 1); output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
      charCode = userPass.charCodeAt((i += 3 / 4));
      if (charCode > 0xff) throw new Error('Invalid characters in credentials');
      block = (block << 8) | charCode;
    }
    const authHeader = `Basic ${output}`;

    try {
      const res = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          Authorization: authHeader,
          Depth: '0',
          'Content-Type': 'application/xml',
        },
      });

      if (res.status === 207 || res.ok) {
        return { success: true, message: 'Connected successfully to WebDAV server!' };
      } else if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed: Invalid username or password.' };
      } else {
        return { success: false, message: `Server returned HTTP status ${res.status}.` };
      }
    } catch (e: any) {
      return { success: false, message: `Connection failed: ${e?.message || 'Server unreachable'}` };
    }
  }

  /**
   * Parses WebDAV XML Multi-Status response into UnifiedCloudItem array.
   */
  private parseWebDavXml(xml: string, baseUrl: string, requestedPath: string): UnifiedCloudItem[] {
    const items: UnifiedCloudItem[] = [];
    const responseRegex = /<[^:]*:?response[^>]*>([\s\S]*?)<\/[^:]*:?response>/gi;
    let match;

    const audioExtensions = ['mp3', 'm4a', 'flac', 'wav', 'aac', 'ogg', 'opus', 'alac'];

    while ((match = responseRegex.exec(xml)) !== null) {
      const block = match[1];

      // Extract href
      const hrefMatch = /<[^:]*:?href[^>]*>([\s\S]*?)<\/[^:]*:?href>/i.exec(block);
      if (!hrefMatch) continue;
      const rawHref = decodeURIComponent(hrefMatch[1].trim());

      // Check if collection (folder)
      const isFolder = /<[^:]*:?collection\s*\/?>/i.test(block) || rawHref.endsWith('/');

      // Extract display name or fall back to URL basename
      const displayNameMatch = /<[^:]*:?displayname[^>]*>([\s\S]*?)<\/[^:]*:?displayname>/i.exec(block);
      let name = displayNameMatch ? displayNameMatch[1].trim() : '';
      if (!name) {
        const parts = rawHref.replace(/\/$/, '').split('/');
        name = parts[parts.length - 1] || 'Root';
      }

      // Extract content length (file size)
      const sizeMatch = /<[^:]*:?getcontentlength[^>]*>([\s\S]*?)<\/[^:]*:?getcontentlength>/i.exec(block);
      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : undefined;

      // Extract last modified
      const modMatch = /<[^:]*:?getlastmodified[^>]*>([\s\S]*?)<\/[^:]*:?getlastmodified>/i.exec(block);
      const modifiedTime = modMatch ? modMatch[1].trim() : undefined;

      // Normalize item path relative to server root
      let itemPath = rawHref;
      if (itemPath.startsWith('http://') || itemPath.startsWith('https://')) {
        try {
          const u = new URL(itemPath);
          itemPath = u.pathname;
        } catch {
          // ignore
        }
      }

      // Skip the requested parent folder itself
      const normRequested = requestedPath.replace(/\/$/, '');
      const normItem = itemPath.replace(/\/$/, '');
      if (normItem === normRequested) {
        continue;
      }

      const ext = name.split('.').pop()?.toLowerCase() || '';

      if (isFolder || audioExtensions.includes(ext)) {
        items.push({
          id: itemPath,
          name,
          provider: 'webdav',
          isFolder,
          path: itemPath,
          size,
          modifiedTime,
        });
      }
    }

    return items.sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });
  }

  /**
   * Lists items in a WebDAV folder.
   */
  async listFolder(path = ''): Promise<UnifiedCloudItem[]> {
    await this.init();
    if (!this.config) throw new Error('WebDAV is not configured');

    const authHeader = this.getAuthHeader();
    let fullUrl = this.config.serverUrl;

    if (path) {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        fullUrl = path;
      } else {
        const cleanBase = this.config.serverUrl.replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        fullUrl = `${cleanBase}${cleanPath}`;
      }
    }

    const res = await fetch(fullUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: authHeader,
        Depth: '1',
        'Content-Type': 'application/xml',
      },
    });

    if (!res.ok && res.status !== 207) {
      const err = await res.text();
      throw new Error(`WebDAV list failed (${res.status}): ${err}`);
    }

    const xml = await res.text();
    return this.parseWebDavXml(xml, this.config.serverUrl, path || fullUrl);
  }

  /**
   * Generates a full direct streamable Track for WebDAV with Basic Auth headers.
   */
  async getStreamableTrack(item: UnifiedCloudItem): Promise<Track> {
    await this.init();
    if (!this.config) throw new Error('WebDAV is not configured');

    let fullUrl = item.path || item.id;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      const cleanBase = this.config.serverUrl.replace(/\/$/, '');
      const cleanPath = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
      fullUrl = `${cleanBase}${cleanPath}`;
    }

    const authHeader = this.getAuthHeader();
    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);

    const track: Track = {
      id: `webdav_${encodeURIComponent(item.id)}`,
      title: title || item.name,
      artist: artist || this.config.serverName || 'WebDAV Server',
      album: 'WebDAV Stream',
      duration: 0,
      uri: fullUrl,
      sourceUrl: fullUrl,
      sourceType: 'webdav',
      fileSize: item.size,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
      streamHeaders: {
        Authorization: authHeader,
      },
      isCloudStream: true,
      cloudProvider: 'webdav',
    };

    return track;
  }

  /**
   * Recursively scans a WebDAV folder and syncs all songs into Sonance with 0 MB local storage taken.
   */
  async syncFolderRecursively(
    folderPath = '',
    folderName = 'WebDAV Music',
    onProgress?: (scannedFolders: number, addedTracks: number) => void
  ): Promise<{ syncedCount: number; newTracks: Track[] }> {
    await storageService.initStorage();
    await this.init();
    if (!this.config) throw new Error('WebDAV is not configured');

    const authHeader = this.getAuthHeader();
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
            const trackId = `webdav_${encodeURIComponent(item.id)}`;
            if (!existingIds.has(trackId)) {
              let streamUri = item.path || item.id;
              if (!streamUri.startsWith('http://') && !streamUri.startsWith('https://')) {
                const cleanBase = this.config.serverUrl.replace(/\/$/, '');
                const cleanPath = streamUri.startsWith('/') ? streamUri : `/${streamUri}`;
                streamUri = `${cleanBase}${cleanPath}`;
              }

              const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);

              const track: Track = {
                id: trackId,
                title: title || item.name,
                artist: artist || folderName || this.config.serverName || 'WebDAV',
                album: folderName || 'WebDAV Stream',
                duration: 0,
                uri: streamUri,
                sourceUrl: streamUri,
                sourceType: 'webdav',
                fileSize: item.size,
                format: ext || 'mp3',
                dateAdded: Date.now(),
                isFavorite: false,
                playCount: 0,
                streamHeaders: {
                  Authorization: authHeader,
                },
                isCloudStream: true,
                cloudProvider: 'webdav',
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
        console.warn(`Failed to scan WebDAV folder ${currentPath}:`, err);
      }
    }

    if (newTracks.length > 0) {
      await storageService.saveTracks([...existingTracks, ...newTracks]);
    }

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

  async getSyncedFolders(): Promise<WebDavFolderSyncRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(WEBDAV_SYNCED_FOLDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async saveSyncedFolder(folder: WebDavFolderSyncRecord): Promise<void> {
    try {
      const list = await this.getSyncedFolders();
      const idx = list.findIndex((f) => f.path === folder.path);
      if (idx >= 0) {
        list[idx] = folder;
      } else {
        list.push(folder);
      }
      await AsyncStorage.setItem(WEBDAV_SYNCED_FOLDERS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save WebDAV synced folder:', e);
    }
  }

  /**
   * Downloads audio file for offline listening (optional).
   */
  async downloadFile(item: UnifiedCloudItem, onProgress?: (progress: number) => void): Promise<Track> {
    await this.init();
    if (!this.config) throw new Error('WebDAV is not configured');

    let downloadUrl = item.path || item.id;
    if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
      const cleanBase = this.config.serverUrl.replace(/\/$/, '');
      const cleanPath = downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`;
      downloadUrl = `${cleanBase}${cleanPath}`;
    }

    await storageService.initStorage();
    const authHeader = this.getAuthHeader();

    const { title, artist, ext } = fileImportService.parseMetadataFromFileName(item.name);
    const safeTitle = sanitizeFileName(title);
    const trackId = `webdav_offline_${Date.now()}_${safeTitle}`;
    const destUri = `${MUSIC_DIR}${trackId}.${ext || 'mp3'}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      destUri,
      {
        headers: {
          Authorization: authHeader,
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
      throw new Error('WebDAV download failed');
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
      artist: artist || this.config.serverName || 'WebDAV',
      duration: duration || 180,
      uri: destUri,
      sourceType: 'imported',
      fileSize,
      format: ext || 'mp3',
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
      cloudProvider: 'webdav',
    };

    await storageService.saveTrack(track);
    return track;
  }
}

export const webDavService = new WebDavService();
