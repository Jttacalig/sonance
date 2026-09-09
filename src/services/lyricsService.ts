import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LyricLine {
  timeSec: number;
  text: string;
}

export interface ParsedLyrics {
  id: string;
  trackName: string;
  artistName: string;
  isSynced: boolean;
  syncedLines: LyricLine[];
  plainLyrics?: string;
}

const LYRICS_CACHE_PREFIX = '@sonance_lyrics_';

class LyricsService {
  /**
   * Parse LRC formatted text into structured array of timed lines
   * e.g. "[01:23.45] Lyric line text" -> { timeSec: 83.45, text: "Lyric line text" }
   */
  parseLrc(lrcText: string): LyricLine[] {
    if (!lrcText || typeof lrcText !== 'string') return [];

    const lines = lrcText.split(/\r?\n/);
    const parsed: LyricLine[] = [];
    const timestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const matches = [...trimmed.matchAll(timestampRegex)];
      if (matches.length > 0) {
        const text = trimmed.replace(timestampRegex, '').trim();
        if (!text && matches.length === 1) {
          continue;
        }

        for (const match of matches) {
          const minutes = parseInt(match[1], 10) || 0;
          const seconds = parseInt(match[2], 10) || 0;
          const fractionStr = match[3] || '0';
          const fraction = parseInt(fractionStr, 10) / Math.pow(10, fractionStr.length);
          const timeSec = minutes * 60 + seconds + fraction;

          parsed.push({
            timeSec,
            text: text || '♪ ♪ ♪',
          });
        }
      }
    }

    return parsed.sort((a, b) => a.timeSec - b.timeSec);
  }

  /**
   * Clean track title from metadata extras (e.g. "(Official Video)", "[Remastered]", etc.)
   */
  cleanTitle(title: string): string {
    return title
      .replace(/\s*[\(\[](?:official\s*(?:video|audio|music\s*video|lyric\s*video)?|remastered|explicit|clean|audio|visualizer|live|bonus\s*track)[\)\]]/gi, '')
      .replace(/\s*ft\.?.*$/i, '')
      .replace(/\s*feat\.?.*$/i, '')
      .trim();
  }

  /**
   * Fetch synced lyrics from LRCLIB with local offline caching
   */
  async getLyrics(
    trackId: string,
    title: string,
    artist: string,
    durationSec?: number
  ): Promise<ParsedLyrics | null> {
    const cacheKey = `${LYRICS_CACHE_PREFIX}${trackId}`;

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ParsedLyrics;
      }
    } catch (e) {
      console.warn('Lyrics cache read error:', e);
    }

    const cleanT = this.cleanTitle(title);
    const cleanA = artist && artist !== 'Unknown Artist' ? artist.trim() : '';

    try {
      let data: any = null;

      // Method A: Exact lookup
      if (cleanT && cleanA) {
        const queryParams = new URLSearchParams({
          track_name: cleanT,
          artist_name: cleanA,
        });
        if (durationSec && durationSec > 0) {
          queryParams.append('duration', Math.round(durationSec).toString());
        }

        const res = await fetch(`https://lrclib.net/api/get?${queryParams.toString()}`, {
          headers: { 'User-Agent': 'Sonance-Music-Player/1.1.0' },
        });

        if (res.ok) {
          data = await res.json();
        }
      }

      // Method B: Search lookup if exact lookup failed
      if (!data) {
        const searchQuery = cleanA ? `${cleanT} ${cleanA}` : cleanT;
        const searchRes = await fetch(
          `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: { 'User-Agent': 'Sonance-Music-Player/1.1.0' },
          }
        );

        if (searchRes.ok) {
          const list = await searchRes.json();
          if (Array.isArray(list) && list.length > 0) {
            data = list.find((item: any) => item.syncedLyrics) || list[0];
          }
        }
      }

      if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
        return null;
      }

      let parsedLines: LyricLine[] = [];
      let isSynced = false;

      if (data.syncedLyrics) {
        parsedLines = this.parseLrc(data.syncedLyrics);
        isSynced = parsedLines.length > 0;
      }

      const result: ParsedLyrics = {
        id: trackId,
        trackName: data.trackName || title,
        artistName: data.artistName || artist,
        isSynced,
        syncedLines: parsedLines,
        plainLyrics: data.plainLyrics || undefined,
      };

      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {
        console.warn('Lyrics cache write error:', e);
      }

      return result;
    } catch (error) {
      console.warn('Failed to fetch lyrics from LRCLIB:', error);
      return null;
    }
  }
}

export const lyricsService = new LyricsService();
