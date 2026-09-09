import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { DownloadItem, DownloadStatus, SourceType, Track } from '../types/music';
import { storageService, MUSIC_DIR, ARTWORK_DIR } from './storageService';
import { DEFAULT_COBALT_INSTANCES, AudioFormat, DEFAULT_USER_AGENT } from '../constants/endpoints';
import { logger } from './loggerService';

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
    preferredFormat: AudioFormat = 'm4a',
    onProgress?: (progress: number, message?: string) => void
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
    onProgress?.(0.08, 'Connecting to audio converter...');

    // 1. Primary: High-Speed Audio Stream Resolver (supports m4a, mp3, flac, wav)
    try {
      const initUrl = `https://loader.to/ajax/download.php?button=1&start=1&end=1&format=${formatParam}&url=${encodeURIComponent(url)}`;
      const initRes = await this.fetchWithTimeout(initUrl, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'application/json',
        },
      }, 7000);

      if (initRes.ok) {
        const initData = await initRes.json();
        if (initData.download_url && typeof initData.download_url === 'string' && initData.download_url.trim().length > 0) {
          onProgress?.(0.35, 'Stream ready, starting download...');
          return { streamUrl: initData.download_url.trim(), filename: initData.title, finalExtension };
        }
        if (initData.progress_url) {
          // Poll progress for audio conversion (up to 45 seconds for full audio encoding)
          for (let attempt = 0; attempt < 45; attempt++) {
            const stepPct = 0.08 + Math.min(0.25, ((attempt + 1) / 45) * 0.25);
            onProgress?.(stepPct, 'Converting audio to high-fidelity format...');
            await new Promise(r => setTimeout(r, 1000));
            try {
              const pollRes = await this.fetchWithTimeout(initData.progress_url, {
                headers: {
                  'User-Agent': DEFAULT_USER_AGENT,
                  'Accept': 'application/json',
                },
              }, 5000);
              if (pollRes.ok) {
                const pollData = await pollRes.json();
                if (pollData.download_url && typeof pollData.download_url === 'string' && pollData.download_url.trim().length > 0) {
                  onProgress?.(0.35, 'Conversion complete, starting download...');
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
    onProgress?.(0.20, 'Trying backup stream resolver...');
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
            'User-Agent': DEFAULT_USER_AGENT,
          },
          body: JSON.stringify({
            url: url,
            downloadMode: 'audio',
            audioFormat: formatParam === 'm4a' ? 'm4a' : 'mp3',
            aFormat: formatParam === 'm4a' ? 'm4a' : 'mp3',
            isAudioOnly: true,
            audioBitrate: '320',
          }),
        }, 5000);

        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            onProgress?.(0.35, 'Stream ready, starting download...');
            return { streamUrl: data.url, filename: data.filename, finalExtension: formatParam };
          }
          if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
            const firstItem = data.picker[0];
            if (firstItem.url) {
              onProgress?.(0.35, 'Stream ready, starting download...');
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
   * Helper to find the clean official Audio/Topic release if a VEVO video is stream-restricted
   */
  async findTopicAudioUrl(title: string, artist: string): Promise<string | null> {
    try {
      const q = `${title} ${artist} Audio Topic`.trim();
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const res = await this.fetchWithTimeout(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      }, 5000);
      if (res.ok) {
        const html = await res.text();
        const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
        if (matches && matches.length > 0) {
          return `https://www.youtube.com/watch?v=${matches[0][1]}`;
        }
      }
    } catch (e) {
      console.warn('Fallback search error:', e);
    }
    return null;
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
      logger.download(`Initiating download for: "${downloadItem.title}" (${preferredFormat.toUpperCase()})`);
      // 1. Resolve stream
      onStatusChange('resolving', `Extracting ${preferredFormat.toUpperCase()} stream...`);
      onProgress(0.05, 0, 0);
      const { streamUrl, finalExtension } = await this.resolveAudioStreamUrl(
        downloadItem.url,
        preferredFormat,
        (pct, msg) => {
          onProgress(pct, 0, 0);
          if (msg) onStatusChange('resolving', msg);
        }
      );
      logger.download(`Stream resolved successfully for "${downloadItem.title}"`);

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

      // 3. Download audio file with live byte & percentage tracking
      onStatusChange('downloading', `Downloading high-fidelity ${fileExt.toUpperCase()} audio...`);
      onProgress(0.35, 0, 0);

      const estimatedTotalBytes = (downloadItem.duration && downloadItem.duration > 0)
        ? Math.round(downloadItem.duration * 40000) // ~40KB/sec for 320kbps AAC audio
        : 5.5 * 1024 * 1024; // 5.5MB default

      let lastBytesWritten = 0;
      let lastExpectedBytes = estimatedTotalBytes;

      const downloadResumable = FileSystem.createDownloadResumable(
        streamUrl,
        destinationFile,
        {
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': '*/*',
          },
        },
        (downloadProgress) => {
          lastBytesWritten = downloadProgress.totalBytesWritten;
          lastExpectedBytes = downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesExpectedToWrite
            : Math.max(estimatedTotalBytes, lastBytesWritten * 1.15);

          const fileRatio = lastExpectedBytes > 0
            ? Math.min(1.0, lastBytesWritten / lastExpectedBytes)
            : 0;

          // Scale download phase from 35% to 92%
          const totalProgress = Math.min(0.92, 0.35 + fileRatio * 0.57);

          onProgress(
            totalProgress,
            lastBytesWritten,
            lastExpectedBytes
          );
        }
      );

      this.activeDownloads.set(downloadItem.id, downloadResumable);
      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(downloadItem.id);

      // Verify file integrity
      let fileInfo = await FileSystem.getInfoAsync(destinationFile);
      let isValidAudio = fileInfo.exists && fileInfo.size !== undefined && fileInfo.size >= 50 * 1024;

      // If primary video returned empty stream (common for VEVO/protected videos), auto fallback to Topic/Audio release
      if (!isValidAudio) {
        try {
          await FileSystem.deleteAsync(destinationFile, { idempotent: true });
        } catch {}

        onStatusChange('resolving', 'Resolving clean audio master stream...');
        const fallbackUrl = await this.findTopicAudioUrl(downloadItem.title, downloadItem.artist);
        if (fallbackUrl && fallbackUrl !== downloadItem.url) {
          const fallbackStream = await this.resolveAudioStreamUrl(fallbackUrl, preferredFormat);
          const fallbackResumable = FileSystem.createDownloadResumable(
            fallbackStream.streamUrl,
            destinationFile,
            {
              headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Accept': '*/*',
              },
            },
            (downloadProgress) => {
              lastBytesWritten = downloadProgress.totalBytesWritten;
              lastExpectedBytes = downloadProgress.totalBytesExpectedToWrite > 0
                ? downloadProgress.totalBytesExpectedToWrite
                : Math.max(estimatedTotalBytes, lastBytesWritten * 1.15);
              const fileRatio = lastExpectedBytes > 0 ? Math.min(1.0, lastBytesWritten / lastExpectedBytes) : 0;
              onProgress(Math.min(0.92, 0.35 + fileRatio * 0.57), lastBytesWritten, lastExpectedBytes);
            }
          );
          this.activeDownloads.set(downloadItem.id, fallbackResumable);
          const fbResult = await fallbackResumable.downloadAsync();
          this.activeDownloads.delete(downloadItem.id);

          if (fbResult && fbResult.uri) {
            fileInfo = await FileSystem.getInfoAsync(fbResult.uri);
            if (fileInfo.exists && fileInfo.size && fileInfo.size >= 50 * 1024) {
              isValidAudio = true;
            }
          }
        }
      }

      if (!isValidAudio) {
        try {
          await FileSystem.deleteAsync(destinationFile, { idempotent: true });
        } catch {}
        throw new Error('Audio stream was incomplete. Please try another search result for this song.');
      }

      // Check for HTML error payload
      try {
        const headerSample = await FileSystem.readAsStringAsync(destinationFile, {
          encoding: FileSystem.EncodingType.UTF8,
          length: 150,
        });
        if (
          headerSample.includes('<!DOCTYPE') ||
          headerSample.includes('<html') ||
          headerSample.includes('{"status":"error"') ||
          headerSample.includes('{"error"')
        ) {
          try {
            await FileSystem.deleteAsync(destinationFile, { idempotent: true });
          } catch {}
          throw new Error('Audio stream returned an error response from server. Please retry.');
        }
      } catch (checkErr: any) {
        if (checkErr?.message?.includes('Audio stream returned an error')) {
          throw checkErr;
        }
        // binary files may fail UTF-8 decoding, which is expected for raw audio
      }

      onStatusChange('saving', 'Processing offline artwork & metadata...');
      onProgress(0.95, lastBytesWritten || estimatedTotalBytes, lastExpectedBytes || estimatedTotalBytes);

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

      // 5. Measure and probe audio duration
      let duration = downloadItem.duration || 180;
      let fileSize = (fileInfo.exists ? fileInfo.size : 0) || lastBytesWritten || 0;

      try {
        const probePlayer = createAudioPlayer(destinationFile);
        if (probePlayer.duration && probePlayer.duration > 0) {
          duration = Math.round(probePlayer.duration);
        }
        probePlayer.remove();
      } catch (probeErr) {
        console.warn('Probe error on downloaded track:', probeErr);
      }

      // 6. Create Track
      const track: Track = {
        id: trackId,
        title: downloadItem.title,
        artist: downloadItem.artist,
        duration: duration || 180,
        uri: destinationFile,
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
      const mbStr = track.fileSize ? (track.fileSize / 1024 / 1024).toFixed(1) : '0';
      logger.download(`Download complete: "${track.title}" by ${track.artist} (${mbStr} MB)`);
      onProgress(1.0, fileSize, fileSize);
      onStatusChange('completed', 'Saved to offline library!');

      return track;
    } catch (error: any) {
      this.activeDownloads.delete(downloadItem.id);
      logger.error('DOWNLOAD', `Download failed for "${downloadItem.title}": ${error?.message || error}`);
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
