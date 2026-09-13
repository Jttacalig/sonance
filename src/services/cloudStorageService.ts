import { googleDriveService } from './googleDriveService';
import { dropboxService } from './dropboxService';
import { oneDriveService } from './oneDriveService';
import { webDavService } from './webDavService';
import { CloudAccountInfo, CloudProviderType, Track, UnifiedCloudItem } from '../types/music';

export interface SyncedCloudFolderGlobal {
  id: string;
  name: string;
  provider: CloudProviderType;
  lastSynced: number;
  trackCount: number;
}

class CloudStorageService {
  async getConnectedAccounts(): Promise<CloudAccountInfo[]> {
    const accounts: CloudAccountInfo[] = [];

    // 1. Google Drive
    if (await googleDriveService.isConnected()) {
      const gProfile = await googleDriveService.getUserProfile();
      accounts.push({
        provider: 'gdrive',
        id: gProfile?.id || 'gdrive_user',
        name: gProfile?.name || 'Google Drive',
        email: gProfile?.email,
        avatar: gProfile?.picture,
        connectedAt: Date.now(),
      });
    }

    // 2. Dropbox
    if (await dropboxService.isConnected()) {
      const dbUser = await dropboxService.getUser();
      accounts.push({
        provider: 'dropbox',
        id: dbUser?.id || 'dropbox_user',
        name: dbUser?.name || 'Dropbox User',
        email: dbUser?.email,
        avatar: dbUser?.profilePhotoUrl,
        connectedAt: Date.now(),
      });
    }

    // 3. OneDrive
    if (await oneDriveService.isConnected()) {
      const odUser = await oneDriveService.getUser();
      accounts.push({
        provider: 'onedrive',
        id: odUser?.id || 'onedrive_user',
        name: odUser?.name || 'OneDrive User',
        email: odUser?.email,
        connectedAt: Date.now(),
      });
    }

    // 4. WebDAV
    if (await webDavService.isConnected()) {
      const cfg = await webDavService.getConfig();
      accounts.push({
        provider: 'webdav',
        id: 'webdav_server',
        name: cfg?.serverName || cfg?.username || 'WebDAV / NAS',
        serverUrl: cfg?.serverUrl,
        connectedAt: Date.now(),
      });
    }

    return accounts;
  }

  async isProviderConnected(provider: CloudProviderType): Promise<boolean> {
    switch (provider) {
      case 'gdrive':
        return googleDriveService.isConnected();
      case 'dropbox':
        return dropboxService.isConnected();
      case 'onedrive':
        return oneDriveService.isConnected();
      case 'webdav':
        return webDavService.isConnected();
      default:
        return false;
    }
  }

  async disconnectProvider(provider: CloudProviderType): Promise<void> {
    switch (provider) {
      case 'gdrive':
        await googleDriveService.disconnect();
        break;
      case 'dropbox':
        await dropboxService.disconnect();
        break;
      case 'onedrive':
        await oneDriveService.disconnect();
        break;
      case 'webdav':
        await webDavService.disconnect();
        break;
    }
  }

  async listFolder(provider: CloudProviderType, pathOrId = ''): Promise<UnifiedCloudItem[]> {
    switch (provider) {
      case 'gdrive': {
        const driveItems = await googleDriveService.listFolder(pathOrId || 'root');
        return driveItems.map((item) => ({
          id: item.id,
          name: item.name,
          provider: 'gdrive',
          mimeType: item.mimeType,
          size: item.size,
          modifiedTime: item.modifiedTime,
          isFolder: item.isFolder,
        }));
      }
      case 'dropbox':
        return dropboxService.listFolder(pathOrId);
      case 'onedrive':
        return oneDriveService.listFolder(pathOrId || 'root');
      case 'webdav':
        return webDavService.listFolder(pathOrId);
      default:
        return [];
    }
  }

  async getStreamableTrack(provider: CloudProviderType, item: UnifiedCloudItem): Promise<Track> {
    switch (provider) {
      case 'gdrive':
        return googleDriveService.getStreamableTrack({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType || 'audio/mpeg',
          size: item.size,
          isFolder: false,
        });
      case 'dropbox':
        return dropboxService.getStreamableTrack(item);
      case 'onedrive':
        return oneDriveService.getStreamableTrack(item);
      case 'webdav':
        return webDavService.getStreamableTrack(item);
      default:
        throw new Error(`Unsupported cloud provider: ${provider}`);
    }
  }

  async syncFolderRecursively(
    provider: CloudProviderType,
    folderIdOrPath: string,
    folderName: string,
    onProgress?: (scanned: number, added: number) => void
  ): Promise<{ syncedCount: number; newTracks: Track[] }> {
    switch (provider) {
      case 'gdrive':
        return googleDriveService.syncFolderRecursively(folderIdOrPath, folderName, onProgress);
      case 'dropbox':
        return dropboxService.syncFolderRecursively(folderIdOrPath, folderName, onProgress);
      case 'onedrive':
        return oneDriveService.syncFolderRecursively(folderIdOrPath, folderName, onProgress);
      case 'webdav':
        return webDavService.syncFolderRecursively(folderIdOrPath, folderName, onProgress);
      default:
        throw new Error(`Unsupported cloud provider: ${provider}`);
    }
  }

  async resyncAllProviders(
    onProgress?: (provider: string, folderName: string, scanned: number, added: number) => void
  ): Promise<{ totalSynced: number }> {
    let totalSynced = 0;

    // Google Drive
    if (await googleDriveService.isConnected()) {
      const gRes = await googleDriveService.resyncAllFolders((folder, s, a) => {
        if (onProgress) onProgress('Google Drive', folder, s, a);
      });
      totalSynced += gRes.totalSynced;
    }

    // Dropbox
    if (await dropboxService.isConnected()) {
      const dbFolders = await dropboxService.getSyncedFolders();
      for (const f of dbFolders) {
        const res = await dropboxService.syncFolderRecursively(f.path, f.name, (s, a) => {
          if (onProgress) onProgress('Dropbox', f.name, s, a);
        });
        totalSynced += res.syncedCount;
      }
    }

    // OneDrive
    if (await oneDriveService.isConnected()) {
      const odFolders = await oneDriveService.getSyncedFolders();
      for (const f of odFolders) {
        const res = await oneDriveService.syncFolderRecursively(f.id, f.name, (s, a) => {
          if (onProgress) onProgress('OneDrive', f.name, s, a);
        });
        totalSynced += res.syncedCount;
      }
    }

    // WebDAV
    if (await webDavService.isConnected()) {
      const wdFolders = await webDavService.getSyncedFolders();
      for (const f of wdFolders) {
        const res = await webDavService.syncFolderRecursively(f.path, f.name, (s, a) => {
          if (onProgress) onProgress('WebDAV', f.name, s, a);
        });
        totalSynced += res.syncedCount;
      }
    }

    return { totalSynced };
  }

  async downloadFile(
    provider: CloudProviderType,
    item: UnifiedCloudItem,
    onProgress?: (p: number) => void
  ): Promise<Track> {
    switch (provider) {
      case 'gdrive':
        return googleDriveService.downloadAudioFile(
          {
            id: item.id,
            name: item.name,
            mimeType: item.mimeType || 'audio/mpeg',
            size: item.size,
            isFolder: false,
          },
          onProgress
        );
      case 'dropbox':
        return dropboxService.downloadFile(item, onProgress);
      case 'onedrive':
        return oneDriveService.downloadFile(item, onProgress);
      case 'webdav':
        return webDavService.downloadFile(item, onProgress);
      default:
        throw new Error(`Unsupported cloud provider: ${provider}`);
    }
  }
}

export const cloudStorageService = new CloudStorageService();
