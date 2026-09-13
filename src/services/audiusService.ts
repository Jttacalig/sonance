import { Track } from '../types/music';

const AUDIUS_APP_NAME = 'SONANCE_MUSIC';
const DISCOVERY_NODES = [
  'https://discoveryprovider.audius.co',
  'https://audius-discovery-1.cultur3stake.com',
  'https://audius-dp.singapore.creatorseed.com',
];

class AudiusService {
  private activeHostIndex = 0;

  private getHost(): string {
    return DISCOVERY_NODES[this.activeHostIndex];
  }

  private switchHost(): void {
    this.activeHostIndex = (this.activeHostIndex + 1) % DISCOVERY_NODES.length;
  }

  private transformTrack(item: any, host: string): Track {
    const artwork =
      item.artwork?.['480x480'] ||
      item.artwork?.['1000x1000'] ||
      item.artwork?.['150x150'] ||
      undefined;

    return {
      id: `audius_${item.id}`,
      title: item.title || 'Untitled Track',
      artist: item.user?.name || 'Audius Artist',
      album: item.genre ? `${item.genre} • Online` : 'Audius Free Music',
      duration: typeof item.duration === 'number' ? item.duration : 180,
      uri: `${host}/v1/tracks/${item.id}/stream?app_name=${AUDIUS_APP_NAME}`,
      artworkUri: artwork,
      sourceUrl: `https://audius.co/tracks/${item.id}`,
      sourceType: 'audius',
      format: 'mp3',
      genre: item.genre,
      isCloudStream: true,
      dateAdded: Date.now(),
      playCount: item.play_count || 0,
    };
  }

  /**
   * Fetches top trending tracks for free online streaming (0 MB local storage used).
   */
  async getTrendingTracks(genre?: string, limit: number = 25): Promise<Track[]> {
    for (let attempts = 0; attempts < DISCOVERY_NODES.length; attempts++) {
      const host = this.getHost();
      try {
        const genreParam = genre ? `&genre=${encodeURIComponent(genre)}` : '';
        const url = `${host}/v1/tracks/trending?app_name=${AUDIUS_APP_NAME}&limit=${limit}${genreParam}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const rawTracks = data.data || [];
        return rawTracks.map((t: any) => this.transformTrack(t, host));
      } catch (err) {
        console.warn(`Audius trending fetch failed on ${host}:`, err);
        this.switchHost();
      }
    }
    return [];
  }

  /**
   * Searches millions of free online tracks by title, artist, or genre.
   */
  async searchTracks(query: string, limit: number = 25): Promise<Track[]> {
    if (!query.trim()) return [];

    for (let attempts = 0; attempts < DISCOVERY_NODES.length; attempts++) {
      const host = this.getHost();
      try {
        const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${AUDIUS_APP_NAME}&limit=${limit}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const rawTracks = data.data || [];
        return rawTracks.map((t: any) => this.transformTrack(t, host));
      } catch (err) {
        console.warn(`Audius search fetch failed on ${host}:`, err);
        this.switchHost();
      }
    }
    return [];
  }
}

export const audiusService = new AudiusService();
