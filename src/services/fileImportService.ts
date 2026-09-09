import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { Track } from '../types/music';
import { storageService, MUSIC_DIR } from './storageService';

const SUPPORTED_EXTENSIONS = ['mp3', 'm4a', 'flac', 'wav', 'aac', 'ogg', 'opus', 'aiff', 'wma'];

const normalizeText = (str: string): string => {
  return str.toLowerCase().replace(/[\W_]+/g, '').trim();
};

export interface CandidateFile {
  sourceUri: string;
  fileName: string;
  fileSize?: number;
  title: string;
  artist: string;
  ext: string;
}

export interface CandidateScanResult {
  candidates: CandidateFile[];
  foundCount: number;
  skippedCount: number;
  skippedTitles: string[];
}

export interface CandidatePickResult {
  canceled: boolean;
  candidates: CandidateFile[];
  foundCount: number;
  skippedCount: number;
  skippedTitles: string[];
}

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  tracks: Track[];
  skippedTitles: string[];
}

export interface ScanResult {
  foundCount: number;
  importedCount: number;
  skippedCount: number;
  tracks: Track[];
}

class FileImportService {
  /**
   * Checks if a track already exists in the user's library
   */
  isDuplicate(
    existingTracks: Track[],
    title: string,
    artist: string,
    originalFileName?: string,
    fileSize?: number
  ): boolean {
    const normTitle = normalizeText(title);
    const normArtist = normalizeText(artist);

    if (!normTitle) return false;

    return existingTracks.some((t) => {
      // Never block imports if the existing entry was 0-byte or corrupted
      if (t.fileSize === 0 && !t.duration) return false;

      const existingTitle = normalizeText(t.title);
      const existingArtist = normalizeText(t.artist);

      // Check 1: Same title and artist
      if (normTitle === existingTitle) {
        if (
          normArtist === existingArtist ||
          ((!normArtist || normArtist === 'localimport' || normArtist === 'unknownartist') &&
           (!existingArtist || existingArtist === 'localimport' || existingArtist === 'unknownartist'))
        ) {
          return true;
        }
      }

      // Check 2: Exact same filename
      if (originalFileName) {
        const uriFileName = t.uri.split('/').pop()?.split('?')[0]?.toLowerCase();
        if (uriFileName && uriFileName === originalFileName.toLowerCase()) {
          return true;
        }
      }

      // Check 3: Exact file size and title match
      if (fileSize && fileSize > 0 && t.fileSize === fileSize && normTitle === existingTitle) {
        return true;
      }

      return false;
    });
  }

  /**
   * Parses artist and title from a raw filename (e.g. "Adele - Hello.mp3" -> Artist: Adele, Title: Hello)
   */
  parseMetadataFromFileName(fileName: string): { title: string; artist: string; ext: string } {
    const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
    const rawBaseName = fileName.replace(/\.[^/.]+$/, '');

    let title = rawBaseName;
    let artist = 'Local Import';

    if (rawBaseName.includes(' - ')) {
      const parts = rawBaseName.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else if (rawBaseName.includes(' – ')) {
      const parts = rawBaseName.split(' – ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' – ').trim();
    } else if (rawBaseName.includes('_')) {
      title = rawBaseName.replace(/_/g, ' ').trim();
    }

    return {
      title: title || 'Imported Track',
      artist: artist || 'Local Import',
      ext,
    };
  }

  /**
   * Opens iOS document picker and extracts candidate files without copying yet
   */
  async pickCandidateFiles(): Promise<CandidatePickResult> {
    await storageService.initStorage();
    const existingTracks = await storageService.getAllTracks();

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/*',
          'audio/mpeg',
          'audio/mp4',
          'audio/x-m4a',
          'audio/wav',
          'audio/flac',
          'audio/aac',
          'audio/ogg',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { canceled: true, candidates: [], foundCount: 0, skippedCount: 0, skippedTitles: [] };
      }

      const candidates: CandidateFile[] = [];
      const skippedTitles: string[] = [];
      let skippedCount = 0;

      for (const asset of result.assets) {
        const { title, artist, ext } = this.parseMetadataFromFileName(asset.name);

        // Check for duplicate in existing tracks and already queued candidates
        const isDup = this.isDuplicate(existingTracks, title, artist, asset.name, asset.size) ||
          candidates.some((c) => normalizeText(c.title) === normalizeText(title));

        if (isDup) {
          skippedCount++;
          skippedTitles.push(title);
          if (
            asset.uri &&
            (asset.uri.includes('Cache') ||
              asset.uri.includes('cache') ||
              asset.uri.includes('DocumentPicker'))
          ) {
            FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
          }
        } else {
          candidates.push({
            sourceUri: asset.uri,
            fileName: asset.name,
            fileSize: asset.size,
            title,
            artist,
            ext,
          });
        }
      }

      return {
        canceled: false,
        candidates,
        foundCount: result.assets.length,
        skippedCount,
        skippedTitles,
      };
    } catch (error) {
      console.error('Document picker error:', error);
      throw error;
    }
  }

  /**
   * Scans local storage for candidate audio files without copying yet
   */
  async scanCandidateFiles(): Promise<CandidateScanResult> {
    await storageService.initStorage();
    const existingTracks = await storageService.getAllTracks();

    let foundCount = 0;
    let skippedCount = 0;
    const candidates: CandidateFile[] = [];
    const skippedTitles: string[] = [];

    const directoriesToScan = [
      MUSIC_DIR,
      FileSystem.documentDirectory || '',
      FileSystem.cacheDirectory || '',
    ].filter(Boolean);

    for (const dir of directoriesToScan) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists || !dirInfo.isDirectory) continue;

        const files = await FileSystem.readDirectoryAsync(dir);
        for (const file of files) {
          const extMatch = file.match(/\.([a-zA-Z0-9]+)$/);
          if (!extMatch) continue;

          const ext = extMatch[1].toLowerCase();
          if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

          foundCount++;
          const filePath = `${dir}${file}`;
          const { title, artist } = this.parseMetadataFromFileName(file);

          // Check if file is already registered in library with a valid non-empty entry
          const isAlreadyRegistered = existingTracks.some((t) => {
            const trackFileName = t.uri.split('/').pop()?.split('?')[0];
            return trackFileName === file && (t.fileSize || 0) > 0;
          });

          const isDup = isAlreadyRegistered ||
            this.isDuplicate(existingTracks, title, artist, file) ||
            candidates.some((c) => normalizeText(c.title) === normalizeText(title));

          if (isDup) {
            skippedCount++;
            skippedTitles.push(title);
          } else {
            let estimatedSize;
            try {
              const info = await FileSystem.getInfoAsync(filePath);
              if (info.exists && info.size) {
                estimatedSize = info.size;
              }
            } catch {}

            candidates.push({
              sourceUri: filePath,
              fileName: file,
              fileSize: estimatedSize,
              title,
              artist,
              ext,
            });
          }
        }
      } catch (err) {
        console.warn(`Error scanning directory ${dir}:`, err);
      }
    }

    return {
      candidates,
      foundCount,
      skippedCount,
      skippedTitles,
    };
  }

  /**
   * Transfers confirmed candidate files into the Sonance Music Folder and registers them in library
   */
  async transferCandidateFiles(candidates: CandidateFile[]): Promise<Track[]> {
    await storageService.initStorage();
    const importedTracks: Track[] = [];

    for (const candidate of candidates) {
      try {
        const track = await this.importSingleFile(
          candidate.sourceUri,
          candidate.fileName,
          candidate.fileSize
        );
        if (track) {
          importedTracks.push(track);
        }
      } catch (e) {
        console.error(`Failed to transfer candidate ${candidate.fileName}:`, e);
      }
    }

    return importedTracks;
  }

  /**
   * Legacy wrapper: opens document picker and imports non-duplicates
   */
  async pickAndImportAudioFiles(): Promise<ImportResult> {
    const pickResult = await this.pickCandidateFiles();
    if (pickResult.canceled || pickResult.candidates.length === 0) {
      return {
        importedCount: 0,
        skippedCount: pickResult.skippedCount,
        tracks: [],
        skippedTitles: pickResult.skippedTitles,
      };
    }

    const tracks = await this.transferCandidateFiles(pickResult.candidates);
    return {
      importedCount: tracks.length,
      skippedCount: pickResult.skippedCount,
      tracks,
      skippedTitles: pickResult.skippedTitles,
    };
  }

  /**
   * Legacy wrapper: scans local directories and imports non-duplicates
   */
  async autoScanLocalMusic(): Promise<ScanResult> {
    const scanResult = await this.scanCandidateFiles();
    if (scanResult.candidates.length === 0) {
      return {
        foundCount: scanResult.foundCount,
        importedCount: 0,
        skippedCount: scanResult.skippedCount,
        tracks: [],
      };
    }

    const tracks = await this.transferCandidateFiles(scanResult.candidates);
    return {
      foundCount: scanResult.foundCount,
      importedCount: tracks.length,
      skippedCount: scanResult.skippedCount,
      tracks,
    };
  }

  /**
   * Cleans up temporary files (e.g. from DocumentPicker cache) if user cancels transfer
   */
  async cleanupCandidateFiles(candidates: CandidateFile[]): Promise<void> {
    for (const c of candidates) {
      if (
        c.sourceUri &&
        (c.sourceUri.includes('Cache') ||
          c.sourceUri.includes('cache') ||
          c.sourceUri.includes('DocumentPicker'))
      ) {
        try {
          await FileSystem.deleteAsync(c.sourceUri, { idempotent: true });
        } catch {}
      }
    }
  }

  /**
   * Imports a single audio file URI into the local app storage (Sonance Music Folder)
   * Moves the file from source into the Sonance folder so no duplicate files linger on device.
   */
  async importSingleFile(sourceUri: string, originalName: string, estimatedSize?: number): Promise<Track | null> {
    const trackId = `import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { title, artist, ext } = this.parseMetadataFromFileName(originalName);

    // Destination file in Sonance permanent music directory
    const safeTitle = title.replace(/[\/\\:*?"<>|]/g, '').substring(0, 40);
    const destUri = `${MUSIC_DIR}${trackId}_${safeTitle}.${ext}`;

    // Transfer to permanent app documents directory if source is external/cached
    if (sourceUri !== destUri) {
      try {
        // Try move first: instant and leaves 0 duplicates
        await FileSystem.moveAsync({
          from: sourceUri,
          to: destUri,
        });
      } catch (moveErr) {
        // Fallback: copy and clean up source file
        try {
          await FileSystem.copyAsync({
            from: sourceUri,
            to: destUri,
          });
          try {
            await FileSystem.deleteAsync(sourceUri, { idempotent: true });
          } catch {}
        } catch (copyErr) {
          console.warn('File transfer warning:', copyErr);
        }
      }
    }

    // Probe duration and exact size
    let duration = 0;
    let fileSize = estimatedSize || 0;

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
    } catch (e) {
      console.warn('Error probing imported audio:', e);
    }

    const track: Track = {
      id: trackId,
      title: title || 'Imported Audio',
      artist: artist || 'Unknown Artist',
      duration: duration || 180,
      uri: destUri,
      sourceType: 'imported',
      fileSize,
      dateAdded: Date.now(),
      isFavorite: false,
      playCount: 0,
    };

    await storageService.saveTrack(track);
    return track;
  }
}

export const fileImportService = new FileImportService();
