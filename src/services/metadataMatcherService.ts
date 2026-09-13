import * as FileSystem from 'expo-file-system/legacy';
import { storageService, ARTWORK_DIR } from './storageService';
import { Track } from '../types/music';
import { logger } from './loggerService';

export interface MetadataMatchCandidate {
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl: string;
  highResArtworkUrl: string;
  releaseDate?: string;
  releaseYear?: number;
  primaryGenreName?: string;
  trackTimeMillis?: number;
}

class MetadataMatcherService {
  /**
   * Normalizes search terms by stripping file extensions, video tags, and unwanted characters
   */
  cleanSearchQuery(title: string, artist?: string): string {
    let clean = title
      .replace(/\.[a-zA-Z0-9]{2,4}$/, '')
      .replace(/[\(\[](?:official\s*(?:video|audio|music\s*video|lyrics)?|remastered|lyrics|hd|4k|audio)[\)\]]/gi, '')
      .replace(/\s*ft\.?.*$/i, '')
      .replace(/\s*feat\.?.*$/i, '')
      .replace(/[_]+/g, ' ')
      .trim();

    if (artist && artist !== 'Unknown Artist' && artist !== 'Local Import' && artist !== 'Google Drive') {
      clean = `${clean} ${artist}`;
    }

    return clean.trim();
  }

  /**
   * Transforms standard 100x100 iTunes thumbnails into Ultra-HD 4000x4000 Apple Music artwork
   */
  getHighResArtworkUrl(thumbnailUrl: string, size = 2000): string {
    if (!thumbnailUrl) return '';
    return thumbnailUrl
      .replace(/\/100x100bb\.jpg$/, `/${size}x${size}bb.jpg`)
      .replace(/\/60x60bb\.jpg$/, `/${size}x${size}bb.jpg`)
      .replace(/\/30x30bb\.jpg$/, `/${size}x${size}bb.jpg`);
  }

  /**
   * Searches the official Apple iTunes Music database for matching songs
   */
  async searchCandidates(title: string, artist?: string): Promise<MetadataMatchCandidate[]> {
    const query = this.cleanSearchQuery(title, artist);
    if (!query) return [];

    try {
      const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=8`;
      const res = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`iTunes search returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((item: any) => {
        const thumb = item.artworkUrl100 || item.artworkUrl60 || '';
        const highRes = this.getHighResArtworkUrl(thumb, 2000);
        let releaseYear: number | undefined;
        if (item.releaseDate) {
          const year = parseInt(item.releaseDate.substring(0, 4), 10);
          if (!isNaN(year)) releaseYear = year;
        }

        return {
          trackName: item.trackName,
          artistName: item.artistName,
          collectionName: item.collectionName,
          artworkUrl: thumb,
          highResArtworkUrl: highRes,
          releaseDate: item.releaseDate,
          releaseYear,
          primaryGenreName: item.primaryGenreName,
          trackTimeMillis: item.trackTimeMillis,
        };
      });
    } catch (err: any) {
      logger.warn('MATCHER', `iTunes metadata search failed: ${err?.message || err}`);
      return [];
    }
  }

  /**
   * Downloads high-resolution official album artwork to local storage
   */
  async downloadArtwork(artworkUrl: string, trackId: string): Promise<string | undefined> {
    if (!artworkUrl) return undefined;
    await storageService.initStorage();

    const destFile = `${ARTWORK_DIR}art_${trackId}_${Date.now()}.jpg`;
    try {
      const res = await FileSystem.downloadAsync(artworkUrl, destFile);
      if (res.status === 200) {
        return destFile;
      }
    } catch (err: any) {
      logger.warn('MATCHER', `Artwork download failed: ${err?.message || err}`);
    }

    return artworkUrl; // Fallback to remote URL
  }

  /**
   * Applies candidate metadata and downloads official high-res artwork for a track
   */
  async applyMatch(track: Track, candidate: MetadataMatchCandidate): Promise<Track> {
    let localArtUri = track.artworkUri;

    if (candidate.highResArtworkUrl || candidate.artworkUrl) {
      const downloaded = await this.downloadArtwork(
        candidate.highResArtworkUrl || candidate.artworkUrl,
        track.id
      );
      if (downloaded) {
        localArtUri = downloaded;
      }
    }

    const updates: Partial<Track> = {
      title: candidate.trackName || track.title,
      artist: candidate.artistName || track.artist,
      album: candidate.collectionName || track.album,
      genre: candidate.primaryGenreName || track.genre,
      artworkUri: localArtUri,
    };

    await storageService.updateTrack({ ...track, ...updates });
    return { ...track, ...updates };
  }

  /**
   * Auto-matches a track by taking the highest confidence candidate from Apple Music
   */
  async autoMatchSingleTrack(track: Track): Promise<Track | null> {
    const candidates = await this.searchCandidates(track.title, track.artist);
    if (candidates.length === 0) return null;

    // Pick top candidate
    const best = candidates[0];
    return await this.applyMatch(track, best);
  }
}

export const metadataMatcherService = new MetadataMatcherService();
