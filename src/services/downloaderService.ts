import * as FileSystem from 'expo-file-system/legacy';
import { DownloadItem, DownloadStatus, SourceType, Track } from '../types/music';
import { storageService, MUSIC_DIR, ARTWORK_DIR } from './storageService';
import { DEFAULT_COBALT_INSTANCES, AudioFormat, DEFAULT_USER_AGENT } from '../constants/endpoints';
import { streamExtractorService } from './streamExtractorService';
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

/**
 * Simple mutex to serialize stream resolution calls so concurrent downloads
 * don't overwhelm the converter API with simultaneous requests.
 */
class StreamResolutionMutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      // Add small delay between consecutive resolutions to avoid rate-limiting
      setTimeout(() => next(), 800);
    } else {
      this.locked = false;
    }
  }
}

class DownloaderService {
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private streamMutex = new StreamResolutionMutex();

  detectSourceType(url: string): SourceType {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return 'youtube';
    }
    if (lower.includes('soundcloud.com')) {
      return 'soundcloud';
    }
    if (lower.includes('instagram.com')) {
      return 'instagram';
    }
    if (lower.includes('tiktok.com')) {
      return 'tiktok';
    }
    if (lower.includes('twitter.com') || lower.includes('x.com')) {
      return 'twitter';
    }
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
      return 'facebook';
    }
    if (lower.includes('open.spotify.com')) {
      return 'spotify';
    }
    if (lower.includes('reddit.com')) {
      return 'reddit';
    }
    if (lower.includes('twitch.tv')) {
      return 'twitch';
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
   * Resolves audio stream URL from multi-provider extraction pipeline.
   * 
   * Pipeline order:
   * 1. Direct Extraction (Piped → Invidious) — YouTube M4A/AAC only, no middleman
   * 2. loader.to — server-side converter (supports all formats)
   * 3. Cobalt API — multi-platform fallback (supports all platforms + formats)
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

    // ──────────────────────────────────────────────────────────────────
    // TIER 1: Direct Stream Extraction (Piped → Invidious)
    // YouTube only, M4A/AAC only — no converter proxy needed
    // ──────────────────────────────────────────────────────────────────
    if (sourceType === 'youtube') {
      onProgress?.(0.08, 'Connecting to direct stream resolver...');
      try {
        const directResult = await streamExtractorService.extractYouTubeAudio(
          url,
          preferredFormat,
          onProgress,
        );
        if (
          directResult &&
          directResult.streamUrl &&
          (directResult.streamUrl.startsWith('http://') || directResult.streamUrl.startsWith('https://'))
        ) {
          logger.download(`Direct extraction succeeded via ${directResult.source} (${Math.round(directResult.bitrate / 1000)}kbps ${directResult.codec})`);
          onProgress?.(0.35, 'Direct stream ready, starting download...');
          return {
            streamUrl: directResult.streamUrl,
            finalExtension: directResult.finalExtension,
          };
        }
      } catch (directErr) {
        logger.download(`Direct extraction error: ${directErr}`);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // TIER 2: loader.to Converter (server-side transcoding)
    // Supports all formats: M4A, MP3, FLAC, WAV
    // ──────────────────────────────────────────────────────────────────
    onProgress?.(0.12, 'Connecting to audio converter...');
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
        if (initData.download_url && typeof initData.download_url === 'string') {
          const sUrl = initData.download_url.trim();
          if (sUrl.startsWith('http://') || sUrl.startsWith('https://')) {
            onProgress?.(0.35, 'Stream ready, starting download...');
            return { streamUrl: sUrl, filename: initData.title, finalExtension };
          }
        }
        if (initData.progress_url) {
          // Poll progress for audio conversion (up to 45 seconds for full audio encoding)
          for (let attempt = 0; attempt < 45; attempt++) {
            const stepPct = 0.12 + Math.min(0.20, ((attempt + 1) / 45) * 0.20);
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
                if (pollData.download_url && typeof pollData.download_url === 'string') {
                  const sUrl = pollData.download_url.trim();
                  if (sUrl.startsWith('http://') || sUrl.startsWith('https://')) {
                    onProgress?.(0.35, 'Conversion complete, starting download...');
                    return {
                      streamUrl: sUrl,
                      filename: pollData.title || initData.title,
                      finalExtension,
                    };
                  }
                }
              }
            } catch (pollErr) {
              // continue polling
            }
          }
        }
      }
    } catch (primaryErr) {
      logger.download(`loader.to error, trying cobalt fallbacks: ${primaryErr}`);
    }

    // ──────────────────────────────────────────────────────────────────
    // TIER 3: Cobalt API Instances (multi-platform fallback)
    // Handles YouTube, SoundCloud, Instagram, TikTok, Twitter, etc.
    // ──────────────────────────────────────────────────────────────────
    onProgress?.(0.22, 'Trying backup stream resolver...');
    const settings = await storageService.getSettings();
    const instancesToTry = [
      settings.cobaltApiUrl,
      ...DEFAULT_COBALT_INSTANCES.filter(inst => inst !== settings.cobaltApiUrl),
    ];

    for (const baseUrl of instancesToTry) {
      try {
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const payload = {
          url: url,
          downloadMode: 'audio',
          audioFormat: formatParam === 'm4a' ? 'm4a' : 'mp3',
          aFormat: formatParam === 'm4a' ? 'm4a' : 'mp3',
          isAudioOnly: true,
          audioBitrate: '320',
        };

        let response = await this.fetchWithTimeout(`${cleanBase}/`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': DEFAULT_USER_AGENT,
          },
          body: JSON.stringify(payload),
        }, 5000);

        if (!response.ok && response.status === 404) {
          response = await this.fetchWithTimeout(`${cleanBase}/api/json`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': DEFAULT_USER_AGENT,
            },
            body: JSON.stringify(payload),
          }, 5000);
        }

        if (response.ok) {
          const data = await response.json();
          if (data.url && typeof data.url === 'string') {
            const sUrl = data.url.trim();
            if (sUrl.startsWith('http://') || sUrl.startsWith('https://')) {
              onProgress?.(0.35, 'Stream ready, starting download...');
              return { streamUrl: sUrl, filename: data.filename, finalExtension: formatParam };
            }
          }
          if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
            const firstItem = data.picker[0];
            if (firstItem.url && typeof firstItem.url === 'string') {
              const sUrl = firstItem.url.trim();
              if (sUrl.startsWith('http://') || sUrl.startsWith('https://')) {
                onProgress?.(0.35, 'Stream ready, starting download...');
                return { streamUrl: sUrl, filename: firstItem.filename, finalExtension: formatParam };
              }
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
   * Validates downloaded file has genuine audio content by checking file signatures (magic bytes).
   * Returns true if valid audio, false if corrupt/HTML/video-only/empty.
   */
  private async validateAudioFile(filePath: string, expectedExt: string): Promise<boolean> {
    try {
      const base64Header = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
        length: 12,
      });

      // Decode base64 to byte array
      const binaryString = atob(base64Header);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Check for HTML/JSON error pages (common corrupt download)
      // '<' = 0x3C, '{' = 0x7B
      if (bytes[0] === 0x3C || bytes[0] === 0x7B) {
        // Try reading as text to confirm
        try {
          const textSample = await FileSystem.readAsStringAsync(filePath, {
            encoding: FileSystem.EncodingType.UTF8,
            length: 200,
          });
          if (
            textSample.includes('<!DOCTYPE') ||
            textSample.includes('<html') ||
            textSample.includes('{"status":"error"') ||
            textSample.includes('{"error"')
          ) {
            logger.download('Audio validation failed: file contains HTML/JSON error response');
            return false;
          }
        } catch {}
      }

      const isMp4 = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
      const isMp3 =
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
        (bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3 || bytes[1] === 0xF2 || bytes[1] === 0xE2));
      const isFlac = bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43;
      const isWav =
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;

      // The file extension is part of the playback contract. In particular,
      // accepting Ogg/WebM here for an .m4a destination creates files that
      // Android may tolerate but iOS cannot play.
      const ext = expectedExt.toLowerCase();
      const matchesExpectedContainer =
        ((ext === 'm4a' || ext === 'mp4') && isMp4) ||
        (ext === 'mp3' && isMp3) ||
        (ext === 'flac' && isFlac) ||
        (ext === 'wav' && isWav);

      if (matchesExpectedContainer) return true;

      logger.download(`Audio validation failed: unrecognized header bytes [${Array.from(bytes.slice(0, 8)).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ')}]`);
      return false;
    } catch (err) {
      logger.download(`Audio validation error: ${err}`);
      // If we can't read the file at all, it's not valid
      return false;
    }
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
      // 1. Resolve stream (serialized via mutex to prevent API rate-limiting)
      onStatusChange('resolving', `Extracting ${preferredFormat.toUpperCase()} stream...`);
      onProgress(0.05, 0, 0);

      await this.streamMutex.acquire();
      let streamUrl: string;
      let finalExtension: string;
      try {
        const resolved = await this.resolveAudioStreamUrl(
          downloadItem.url,
          preferredFormat,
          (pct, msg) => {
            onProgress(pct, 0, 0);
            if (msg) onStatusChange('resolving', msg);
          }
        );
        streamUrl = resolved.streamUrl;
        finalExtension = resolved.finalExtension;
      } finally {
        this.streamMutex.release();
      }
      logger.download(`Stream resolved successfully for "${downloadItem.title}"`);

      // 2. Prepare URL-safe file destination (no spaces or non-URL chars in file name)
      const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const safeTitle = this.cleanString(downloadItem.title).substring(0, 40) || 'track';
      const safeArtist = this.cleanString(downloadItem.artist).substring(0, 30) || 'artist';
      const safeSlug = `${safeArtist}_${safeTitle}`
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 40);

      let fileExt = finalExtension || 'm4a';
      let destinationFile = `${MUSIC_DIR}${trackId}_${safeSlug}.${fileExt}`;

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

      // Verify file integrity with audio header validation
      let fileInfo = await FileSystem.getInfoAsync(destinationFile);
      let isValidAudio = false;

      if (fileInfo.exists && fileInfo.size !== undefined && fileInfo.size >= 50 * 1024) {
        isValidAudio = await this.validateAudioFile(destinationFile, fileExt);
      }

      // If primary video returned empty/corrupt stream (common for VEVO/protected videos), auto fallback to Topic/Audio release
      if (!isValidAudio) {
        logger.download(`Primary download invalid for "${downloadItem.title}", trying Topic/Audio fallback...`);
        try {
          await FileSystem.deleteAsync(destinationFile, { idempotent: true });
        } catch {}

        onStatusChange('resolving', 'Resolving clean audio master stream...');

        // Serialize fallback resolution through mutex too
        await this.streamMutex.acquire();
        let fallbackStream: { streamUrl: string; finalExtension: string } | null = null;
        try {
          const fallbackUrl = await this.findTopicAudioUrl(downloadItem.title, downloadItem.artist);
          if (fallbackUrl && fallbackUrl !== downloadItem.url) {
            fallbackStream = await this.resolveAudioStreamUrl(fallbackUrl, preferredFormat);
          }
        } finally {
          this.streamMutex.release();
        }

        if (fallbackStream) {
          // A fallback can legitimately resolve to a different format. Keep
          // the filename in sync with it so validation and native playback do
          // not treat one container as another.
          if (fallbackStream.finalExtension !== fileExt) {
            fileExt = fallbackStream.finalExtension;
            destinationFile = `${MUSIC_DIR}${trackId}_${safeSlug}.${fileExt}`;
          }
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
          await fallbackResumable.downloadAsync();
          this.activeDownloads.delete(downloadItem.id);

          fileInfo = await FileSystem.getInfoAsync(destinationFile);
          if (fileInfo.exists && fileInfo.size && fileInfo.size >= 50 * 1024) {
            isValidAudio = await this.validateAudioFile(destinationFile, fileExt);
          }
        }
      }

      if (!isValidAudio) {
        try {
          await FileSystem.deleteAsync(destinationFile, { idempotent: true });
        } catch {}
        throw new Error('Audio stream was corrupt or incomplete. Please try another search result for this song.');
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

      // 5. Use the source duration when available. Creating an extra native
      // player solely to probe a newly-downloaded file races the real player
      // on iOS and does not reliably provide a duration before it has loaded.
      let duration = downloadItem.duration || 180;
      let fileSize = (fileInfo.exists ? fileInfo.size : 0) || lastBytesWritten || 0;

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
        format: fileExt,
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
