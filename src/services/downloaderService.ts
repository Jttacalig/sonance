import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { DownloadItem, DownloadStatus, SourceType, Track } from '../types/music';
import { storageService, MUSIC_DIR, ARTWORK_DIR } from './storageService';
import { DEFAULT_COBALT_INSTANCES, AudioFormat } from '../constants/endpoints';

export interface ExtractedInfo {
  title: string;
  artist: string;
  thumbnailUrl?: string;
  sourceUrl: string;
  sourceType: SourceType;
  streamUrl?: string;
  duration?: number;
  durationText?: string;
  format?: AudioFormat;
}

class DownloaderService {
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();

  detectSourceType(url: string): SourceType {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return 'youtube';
    }
    if (lower.includes('soundcloud.com')) {
      return 'soundcloud';
    }
    if (
      lower.endsWith('.mp3') ||
      lower.endsWith('.m4a') ||
      lower.endsWith('.aac') ||
      lower.endsWith('.wav') ||
      lower.endsWith('.flac') ||
      lower.endsWith('.ogg')
    ) {
      return 'direct';
    }
    return 'youtube';
  }

  extractYouTubeVideoId(url: string): string | null {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  private cleanString(str: string): string {
    return str
      .replace(/[/\:*?"<>|]/g, '')
      .replace(/s+/g, ' ')
      .trim();
  }

  /**
   * Fetches metadata for preview before downloading
   */
  async fetchMetadata(url: string): Promise<ExtractedInfo> {
    const sourceType = this.detectSourceType(url);

    if (sourceType === 'youtube') {
      const videoId = this.extractYouTubeVideoId(url);
      let title = 'YouTube Audio';
      let artist = 'Unknown Artist';
      let thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.title) {
            title = data.title;
            if (title.includes(' - ')) {
              const parts = title.split(' - ');
              artist = parts[0].trim();
              title = parts.slice(1).join(' - ').trim();
            } else if (data.author_name) {
              artist = data.author_name;
            }
          }
          if (data.thumbnail_url) {
            thumbnailUrl = data.thumbnail_url;
          }
        }
      } catch (e) {
        console.warn('oEmbed fetch error, fallback to videoId:', e);
      }

      if (videoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }

      return {
        title: this.cleanSongTitle(title),
        artist: this.cleanArtistName(artist),
        thumbnailUrl,
        sourceUrl: url,
        sourceType: 'youtube',
      };
    }

    if (sourceType === 'soundcloud') {
      let title = 'SoundCloud Track';
      let artist = 'SoundCloud Artist';
      let thumbnailUrl: string | undefined;

      try {
        const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.title) title = data.title;
          if (data.author_name) artist = data.author_name;
          if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
        }
      } catch (e) {
        console.warn('SoundCloud metadata fetch error:', e);
      }

      return {
        title: this.cleanSongTitle(title),
        artist: this.cleanArtistName(artist),
        thumbnailUrl,
        sourceUrl: url,
        sourceType: 'soundcloud',
      };
    }

    // Direct audio URL
    const urlParts = url.split('/');
    const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0];
    const rawName = decodeURIComponent(fileNameWithExt).replace(/.[^/.]+$/, '');
    let title = rawName;
    let artist = 'Direct Download';

    if (rawName.includes(' - ')) {
      const parts = rawName.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    return {
      title: title || 'Audio Track',
      artist: artist || 'Unknown Artist',
      sourceUrl: url,
      sourceType: 'direct',
      streamUrl: url,
    };
  }

  private cleanSongTitle(raw: string): string {
    return raw
      .replace(/\(Official\s*(Music)?\s*Video\)/gi, '')
      .replace(/\[Official\s*(Music)?\s*Video\]/gi, '')
      .replace(/\(Official\s*Audio\)/gi, '')
      .replace(/\[Official\s*Audio\]/gi, '')
      .replace(/\(Audio\)/gi, '')
      .replace(/\[Audio\]/gi, '')
      .replace(/\(Lyric\s*Video\)/gi, '')
      .replace(/\[Lyric\s*Video\]/gi, '')
      .replace(/\(HD\)/gi, '')
      .replace(/\(4K\)/gi, '')
      .replace(/\(HQ\)/gi, '')
      .replace(/\(Visualizer\)/gi, '')
      .trim();
  }

  private cleanArtistName(raw: string): string {
    return raw
      .replace(/ - Topic$/i, '')
      .replace(/VEVO$/i, '')
      .trim();
  }

  /**
   * Helper to perform fetch with a timeout
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Resolves audio stream URL from multi-provider extraction pipeline
   */
  async resolveAudioStreamUrl(
    url: string,
    preferredFormat: AudioFormat = 'm4a'
  ): Promise<{ streamUrl: string; filename?: string; finalExtension: string }> {
    const sourceType = this.detectSourceType(url);
    if (sourceType === 'direct') {
      const extMatch = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
      return { streamUrl: url, finalExtension: extMatch ? extMatch[1].toLowerCase() : 'm4a' };
    }

    // Map to supported audio format on converter backend (opus -> m4a Apple native AAC)
    const formatParam =
      preferredFormat === 'mp3' ? 'mp3'
      : preferredFormat === 'flac' ? 'flac'
      : preferredFormat === 'wav' ? 'wav'
      : 'm4a';

    const finalExtension = formatParam;

    // 1. Primary: High-Speed Audio Stream Resolver (supports m4a, mp3, flac, wav)
    try {
      const initUrl = `https://loader.to/ajax/download.php?button=1&start=1&end=1&format=${formatParam}&url=${encodeURIComponent(url)}`;
      const initRes = await this.fetchWithTimeout(initUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json',
        },
      }, 6000);

      if (initRes.ok) {
        const initData = await initRes.json();
        if (initData.download_url && typeof initData.download_url === 'string' && initData.download_url.trim().length > 0) {
          return { streamUrl: initData.download_url.trim(), filename: initData.title, finalExtension };
        }
        if (initData.progress_url) {
          // Poll progress for audio conversion
          for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
              const pollRes = await this.fetchWithTimeout(initData.progress_url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
                  'Accept': 'application/json',
                },
              }, 4000);
              if (pollRes.ok) {
                const pollData = await pollRes.json();
                if (pollData.download_url && typeof pollData.download_url === 'string' && pollData.download_url.trim().length > 0) {
                  return {
                    streamUrl: pollData.download_url.trim(),
                    filename: pollData.title || initData.title,
                    finalExtension,
                  };
                }
              }
            } catch (pollErr) {
              // continue polling
            }
          }
        }
      }
    } catch (primaryErr) {
      console.warn('Primary audio stream extraction error, trying fallbacks:', primaryErr);
    }

    // 2. Secondary: Cobalt instances fallback
    const settings = await storageService.getSettings();
    const instancesToTry = [
      settings.cobaltApiUrl,
      ...DEFAULT_COBALT_INSTANCES.filter(inst => inst !== settings.cobaltApiUrl),
    ];

    for (const baseUrl of instancesToTry) {
      try {
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const response = await this.fetchWithTimeout(`${cleanBase}/`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            downloadMode: 'audio',
            audioFormat: formatParam === 'm4a' ? 'm4a' : 'mp3',
            audioBitrate: '320',
          }),
        }, 4000);

        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            return { streamUrl: data.url, filename: data.filename, finalExtension: formatParam };
          }
          if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
            const firstItem = data.picker[0];
            if (firstItem.url) {
              return { streamUrl: firstItem.url, filename: firstItem.filename, finalExtension: formatParam };
            }
          }
        }
      } catch (err) {
        // continue
      }
    }

    throw new Error('Could not extract audio stream. Please check your internet connection and try again.');
  }

  /**
   * Starts downloading track to local disk and returns Track object
   */
  async startDownload(
    downloadItem: DownloadItem,
    preferredFormat: AudioFormat = 'm4a',
    onProgress: (progress: number, bytesDownloaded: number, totalBytes: number) => void,
    onStatusChange: (status: DownloadStatus, message?: string) => void
  ): Promise<Track> {
    await storageService.initStorage();

    try {
      // 1. Resolve stream
      onStatusChange('resolving', `Extracting ${preferredFormat.toUpperCase()} stream...`);
      const { streamUrl, finalExtension } = await this.resolveAudioStreamUrl(downloadItem.url, preferredFormat);

      // 2. Prepare URL-safe file destination (no spaces or non-URL chars in file name)
      const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const safeTitle = this.cleanString(downloadItem.title).substring(0, 40) || 'track';
      const safeArtist = this.cleanString(downloadItem.artist).substring(0, 30) || 'artist';
      const safeSlug = `${safeArtist}_${safeTitle}`
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 40);

      const fileExt = finalExtension || 'm4a';
      const destinationFile = `${MUSIC_DIR}${trackId}_${safeSlug}.${fileExt}`;

      // 3. Download audio file
      onStatusChange('downloading', `Downloading high-fidelity ${fileExt.toUpperCase()} audio...`);
      
      const downloadResumable = FileSystem.createDownloadResumable(
        streamUrl,
        destinationFile,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
            : 0;
          onProgress(
            progress,
            downloadProgress.totalBytesWritten,
            downloadProgress.totalBytesExpectedToWrite
          );
        }
      );

      this.activeDownloads.set(downloadItem.id, downloadResumable);
      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(downloadItem.id);

      if (!result || !result.uri) {
        throw new Error('Download failed: No file URI generated.');
      }

      onStatusChange('saving', 'Processing offline artwork & metadata...');

      // 4. Download and save artwork locally if available
      let localArtworkUri: string | undefined;
      if (downloadItem.thumbnailUrl) {
        try {
          const artworkDest = `${ARTWORK_DIR}${trackId}_art.jpg`;
          const artResult = await FileSystem.downloadAsync(downloadItem.thumbnailUrl, artworkDest);
          if (artResult && artResult.uri) {
            localArtworkUri = artResult.uri;
          }
        } catch (e) {
          console.warn('Could not save local artwork:', e);
          localArtworkUri = downloadItem.thumbnailUrl;
        }
      }

      // 5. Measure file size
      let duration = downloadItem.duration || 180;
      let fileSize = 0;

      try {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        if (fileInfo.exists && fileInfo.size) {
          fileSize = fileInfo.size;
        }
      } catch (e) {
        console.warn('Error reading file info:', e);
      }

      // 6. Create Track
      const track: Track = {
        id: trackId,
        title: downloadItem.title,
        artist: downloadItem.artist,
        duration: duration || 180,
        uri: result.uri,
        artworkUri: localArtworkUri,
        sourceUrl: downloadItem.url,
        sourceType: this.detectSourceType(downloadItem.url),
        fileSize,
        dateAdded: Date.now(),
        isFavorite: false,
        playCount: 0,
      };

      // 7. Save to library database
      await storageService.saveTrack(track);
      onStatusChange('completed', 'Saved to offline library!');

      return track;
    } catch (error: any) {
      this.activeDownloads.delete(downloadItem.id);
      onStatusChange('error', error?.message || 'Download failed');
      throw error;
    }
  }

  cancelDownload(downloadId: string): void {
    const download = this.activeDownloads.get(downloadId);
    if (download) {
      download.pauseAsync().catch(() => {});
      this.activeDownloads.delete(downloadId);
    }
  }
}

export const downloaderService = new DownloaderService();
