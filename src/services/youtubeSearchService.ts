export interface SearchResultItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSec: number;
  thumbnailUrl: string;
  viewCount?: string;
  sourceUrl: string;
}

class YouTubeSearchService {
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
      .replace(/\(Lyrics\)/gi, '')
      .replace(/\[Lyrics\]/gi, '')
      .replace(/\(HD\)/gi, '')
      .replace(/\(4K\)/gi, '')
      .replace(/\(HQ\)/gi, '')
      .replace(/\(Visualizer\)/gi, '')
      .replace(/\(Music Video\)/gi, '')
      .replace(/\[Music Video\]/gi, '')
      .replace(/\(Full Video\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanArtistName(raw: string): string {
    return raw
      .replace(/ - Topic$/i, '')
      .replace(/VEVO$/i, '')
      .replace(/Official$/i, '')
      .trim();
  }

  private parseDurationToSeconds(durationStr: string): number {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 1) {
      return parts[0];
    }
    return 0;
  }

  /**
   * Searches YouTube music videos & tracks
   */
  async search(query: string): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}&sp=EgIQAQ%253D%253D`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}`);
      }

      const html = await response.text();
      const match =
        html.match(/var ytInitialData = ({.*?});<\/script>/s) ||
        html.match(/ytInitialData\s*=\s*({.+?});/s);

      if (!match) {
        return [];
      }

      const data = JSON.parse(match[1]);
      const contents =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ||
        [];

      const results: SearchResultItem[] = [];

      for (const item of contents) {
        const vr = item.videoRenderer;
        if (!vr || !vr.videoId) continue;

        const durationText = vr.lengthText?.simpleText || '';
        const durationSec = this.parseDurationToSeconds(durationText);

        let rawTitle = vr.title?.runs?.[0]?.text || '';
        let rawArtist =
          vr.ownerText?.runs?.[0]?.text ||
          vr.shortBylineText?.runs?.[0]?.text ||
          'Unknown Artist';

        if (rawTitle.includes(' - ')) {
          const split = rawTitle.split(' - ');
          if (split.length >= 2) {
            rawArtist = split[0].trim();
            rawTitle = split.slice(1).join(' - ').trim();
          }
        }

        const thumbs = vr.thumbnail?.thumbnails || [];
        const bestThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

        results.push({
          id: vr.videoId,
          title: this.cleanSongTitle(rawTitle) || 'Untitled Track',
          artist: this.cleanArtistName(rawArtist) || 'Unknown Artist',
          duration: durationText || '3:30',
          durationSec: durationSec || 210,
          thumbnailUrl: bestThumb.startsWith('//') ? `https:${bestThumb}` : bestThumb,
          viewCount: vr.viewCountText?.simpleText || vr.shortViewCountText?.simpleText,
          sourceUrl: `https://www.youtube.com/watch?v=${vr.videoId}`,
        });

        if (results.length >= 25) break;
      }

      return results;
    } catch (error) {
      console.warn('YouTube search scraping error:', error);
      return [];
    }
  }

  /**
   * Fetches live autocomplete suggestions for search query
   */
  async getSuggestions(query: string): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const suggestUrl = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(suggestUrl);
      const text = await res.text();
      const match = text.match(/window\.google\.ac\.h\((.*)\)/);
      if (match) {
        const data = JSON.parse(match[1]);
        if (Array.isArray(data[1])) {
          return data[1].map((item) => (Array.isArray(item) ? item[0] : item)).filter(Boolean).slice(0, 7);
        }
      }
    } catch (e) {
      // silent fallback
    }
    return [];
  }
}

export const youtubeSearchService = new YouTubeSearchService();
