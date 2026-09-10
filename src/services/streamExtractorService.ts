import { PIPED_INSTANCES, INVIDIOUS_INSTANCES, AudioFormat, DEFAULT_USER_AGENT } from '../constants/endpoints';
import { logger } from './loggerService';

export interface AudioStreamResult {
  streamUrl: string;
  bitrate: number;
  codec: string;
  contentLength: number;
  finalExtension: string;
  source: 'piped' | 'invidious';
}

interface PipedAudioStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  bitrate: number;
  contentLength: number;
  videoOnly: boolean;
  itag: number;
}

interface PipedResponse {
  title: string;
  uploader: string;
  duration: number;
  thumbnailUrl: string;
  audioStreams: PipedAudioStream[];
}

interface InvidiousAdaptiveFormat {
  url: string;
  itag: string;
  type: string;
  clen: string;
  bitrate: string;
  container: string;
  encoding: string;
  audioQuality?: string;
  audioSampleRate?: string;
  audioChannels?: number;
}

interface InvidiousResponse {
  title: string;
  author: string;
  lengthSeconds: number;
  adaptiveFormats: InvidiousAdaptiveFormat[];
}

/**
 * Direct YouTube stream extractor using Piped and Invidious APIs.
 * Bypasses third-party converter proxies (cobalt/loader.to) for YouTube audio.
 * 
 * Resolution Pipeline:
 * 1. Piped API (6 instances) → audioStreams[] with proxied CDN URLs
 * 2. Invidious API (5 instances, ?local=true) → adaptiveFormats[] with proxied URLs
 * 
 * For non-M4A formats (MP3/FLAC/WAV), returns null — caller should fall back
 * to cobalt/loader.to which handle server-side transcoding.
 */
class StreamExtractorService {
  private async fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'application/json',
        },
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
   * Helper to ensure returned stream URLs are guaranteed to be valid absolute URLs
   */
  private toAbsoluteUrl(rawUrl: string | undefined | null, baseUrl: string): string | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const full = `${cleanBase}${cleanPath}`;
    if (full.startsWith('http://') || full.startsWith('https://')) {
      return full;
    }
    return null;
  }

  /**
   * Extracts the best M4A/AAC audio stream from a YouTube video using Piped API.
   * Tries all Piped instances in sequence until one succeeds.
   */
  private async tryPiped(videoId: string): Promise<AudioStreamResult | null> {
    for (const instance of PIPED_INSTANCES) {
      try {
        const cleanBase = instance.replace(/\/+$/, '');
        const url = `${cleanBase}/streams/${videoId}`;
        logger.download(`[Piped] Trying ${instance} for ${videoId}`);

        const response = await this.fetchWithTimeout(url, 7000);
        if (!response.ok) {
          logger.download(`[Piped] ${instance} returned ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('json')) {
          logger.download(`[Piped] ${instance} returned non-JSON (likely Cloudflare challenge)`);
          continue;
        }

        const data: PipedResponse = await response.json();
        if (!data.audioStreams || data.audioStreams.length === 0) {
          logger.download(`[Piped] ${instance} returned no audio streams`);
          continue;
        }

        // Pick best M4A/AAC stream (prefer itag 140 = 128kbps AAC, then itag 139 = 48kbps)
        const m4aStreams = data.audioStreams
          .filter(s => !s.videoOnly && (s.mimeType?.startsWith('audio/mp4') || s.format === 'M4A'))
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        if (m4aStreams.length > 0) {
          const best = m4aStreams[0];
          const streamUrl = this.toAbsoluteUrl(best.url, cleanBase);
          if (streamUrl) {
            logger.download(`[Piped] ✓ Found ${best.quality} ${best.codec} stream via ${instance}`);
            return {
              streamUrl,
              bitrate: best.bitrate || 128000,
              codec: best.codec || 'mp4a.40.2',
              contentLength: best.contentLength || 0,
              finalExtension: 'm4a',
              source: 'piped',
            };
          }
        }

        // Fallback: any audio stream
        const anyAudio = data.audioStreams
          .filter(s => !s.videoOnly)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        if (anyAudio.length > 0) {
          const best = anyAudio[0];
          const streamUrl = this.toAbsoluteUrl(best.url, cleanBase);
          if (streamUrl) {
            const ext = best.mimeType?.includes('webm') ? 'webm' : 'm4a';
            logger.download(`[Piped] ✓ Found ${best.quality} ${best.codec} (fallback) via ${instance}`);
            return {
              streamUrl,
              bitrate: best.bitrate || 128000,
              codec: best.codec || 'opus',
              contentLength: best.contentLength || 0,
              finalExtension: ext === 'webm' ? 'm4a' : ext, // Save as m4a for iOS compatibility
              source: 'piped',
            };
          }
        }

        logger.download(`[Piped] ${instance} had streams but none matched audio criteria`);
      } catch (err: any) {
        logger.download(`[Piped] ${instance} error: ${err?.message || err}`);
        continue;
      }
    }
    return null;
  }

  /**
   * Extracts the best M4A/AAC audio stream from a YouTube video using Invidious API.
   * Uses ?local=true to proxy through the instance (avoids IP-bound 403 errors).
   */
  private async tryInvidious(videoId: string): Promise<AudioStreamResult | null> {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const cleanBase = instance.replace(/\/+$/, '');
        const url = `${cleanBase}/api/v1/videos/${videoId}?local=true`;
        logger.download(`[Invidious] Trying ${instance} for ${videoId}`);

        const response = await this.fetchWithTimeout(url, 7000);
        if (!response.ok) {
          logger.download(`[Invidious] ${instance} returned ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('json')) {
          logger.download(`[Invidious] ${instance} returned non-JSON`);
          continue;
        }

        const data: InvidiousResponse = await response.json();
        if (!data.adaptiveFormats || data.adaptiveFormats.length === 0) {
          logger.download(`[Invidious] ${instance} returned no adaptive formats`);
          continue;
        }

        // Filter audio-only streams
        const audioFormats = data.adaptiveFormats.filter(f =>
          f.type?.startsWith('audio/')
        );

        if (audioFormats.length === 0) {
          logger.download(`[Invidious] ${instance} had no audio streams`);
          continue;
        }

        // Prefer M4A/AAC (container: mp4, encoding: aac)
        const m4aFormats = audioFormats
          .filter(f => f.container === 'mp4' || f.encoding === 'aac' || f.type?.includes('audio/mp4'))
          .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));

        if (m4aFormats.length > 0) {
          const best = m4aFormats[0];
          const streamUrl = this.toAbsoluteUrl(best.url, cleanBase);
          if (streamUrl) {
            logger.download(`[Invidious] ✓ Found itag ${best.itag} ${best.encoding} stream via ${instance}`);
            return {
              streamUrl,
              bitrate: parseInt(best.bitrate) || 128000,
              codec: best.encoding || 'aac',
              contentLength: parseInt(best.clen) || 0,
              finalExtension: 'm4a',
              source: 'invidious',
            };
          }
        }

        // Fallback: any audio stream
        const bestAudio = audioFormats.sort(
          (a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0)
        )[0];

        const streamUrl = this.toAbsoluteUrl(bestAudio.url, cleanBase);
        if (streamUrl) {
          logger.download(`[Invidious] ✓ Found itag ${bestAudio.itag} ${bestAudio.encoding} (fallback) via ${instance}`);
          return {
            streamUrl,
            bitrate: parseInt(bestAudio.bitrate) || 128000,
            codec: bestAudio.encoding || 'opus',
            contentLength: parseInt(bestAudio.clen) || 0,
            finalExtension: 'm4a', // Save as m4a for iOS compatibility
            source: 'invidious',
          };
        }
      } catch (err: any) {
        logger.download(`[Invidious] ${instance} error: ${err?.message || err}`);
        continue;
      }
    }
    return null;
  }

  /**
   * Extracts a YouTube video ID from a URL.
   */
  extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  /**
   * Main extraction pipeline for YouTube audio streams.
   * Tries Piped → Invidious in sequence.
   * Returns null if all instances fail (caller should fall back to cobalt/loader.to).
   * 
   * Only supports M4A/AAC output. For MP3/FLAC/WAV, returns null immediately
   * since those require server-side transcoding.
   */
  async extractYouTubeAudio(
    url: string,
    preferredFormat: AudioFormat = 'm4a',
    onProgress?: (progress: number, message?: string) => void,
  ): Promise<AudioStreamResult | null> {
    // Direct extraction only supports native M4A/AAC and opus
    // MP3/FLAC/WAV need server-side transcoding → fall through to cobalt/loader.to
    if (preferredFormat === 'mp3' || preferredFormat === 'flac' || preferredFormat === 'wav') {
      logger.download(`[StreamExtractor] ${preferredFormat.toUpperCase()} requires transcoding, skipping direct extraction`);
      return null;
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      logger.download('[StreamExtractor] Could not extract video ID from URL');
      return null;
    }

    logger.download(`[StreamExtractor] Extracting audio for video ${videoId}`);
    onProgress?.(0.10, 'Connecting to direct stream resolver...');

    // 1. Try Piped (proxied CDN URLs, no IP issues)
    onProgress?.(0.12, 'Resolving high-fidelity audio stream...');
    const pipedResult = await this.tryPiped(videoId);
    if (pipedResult) {
      const kbps = Math.round(pipedResult.bitrate / 1000);
      onProgress?.(0.35, `Direct ${kbps}kbps ${pipedResult.codec} stream ready`);
      return pipedResult;
    }

    // 2. Try Invidious (?local=true for proxied URLs)
    onProgress?.(0.20, 'Trying backup stream resolver...');
    const invidiousResult = await this.tryInvidious(videoId);
    if (invidiousResult) {
      const kbps = Math.round(invidiousResult.bitrate / 1000);
      onProgress?.(0.35, `Direct ${kbps}kbps ${invidiousResult.codec} stream ready`);
      return invidiousResult;
    }

    logger.download('[StreamExtractor] All direct extraction instances failed, will fall back to converter proxies');
    return null;
  }
}

export const streamExtractorService = new StreamExtractorService();
