 import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Track, Playlist } from '../types/music';
import { storageService } from '../services/storageService';
import {
  fileImportService,
  ImportResult,
  ScanResult,
  CandidateFile,
  CandidatePickResult,
  CandidateScanResult,
} from '../services/fileImportService';

interface LibraryContextType {
  tracks: Track[];
  playlists: Playlist[];
  favorites: Track[];
  isLoading: boolean;
  storageUsage: { totalBytes: number; trackCount: number };
  refreshLibrary: () => Promise<void>;
  addTrack: (track: Track) => Promise<void>;
  updateTrackMetadata: (trackId: string, updates: Partial<Track>) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  toggleFavorite: (trackId: string) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  importFromFiles: () => Promise<ImportResult>;
  autoScanMusic: () => Promise<ScanResult>;
  pickCandidateFiles: () => Promise<CandidatePickResult>;
  scanCandidateFiles: () => Promise<CandidateScanResult>;
  transferCandidateFiles: (candidates: CandidateFile[]) => Promise<Track[]>;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [storageUsage, setStorageUsage] = useState<{ totalBytes: number; trackCount: number }>({
    totalBytes: 0,
    trackCount: 0,
  });

  const refreshLibrary = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedTracks, fetchedPlaylists, usage] = await Promise.all([
        storageService.getAllTracks(),
        storageService.getAllPlaylists(),
        storageService.getStorageUsage(),
      ]);
      setTracks(fetchedTracks);
      setPlaylists(fetchedPlaylists);
      setStorageUsage(usage);
    } catch (error) {
      console.error('Error refreshing library:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const addTrack = async (track: Track) => {
    await storageService.saveTrack(track);
    await refreshLibrary();
  };

  const updateTrackMetadata = async (trackId: string, updates: Partial<Track>) => {
    const existing = tracks.find((t) => t.id === trackId);
    if (!existing) return;
    const updated: Track = { ...existing, ...updates };
    await storageService.updateTrack(updated);
    setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
  };

  const deleteTrack = async (trackId: string) => {
    await storageService.deleteTrack(trackId);
    await refreshLibrary();
  };

  const toggleFavorite = async (trackId: string) => {
    const updated = await storageService.toggleFavorite(trackId);
    if (updated) {
      setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
    }
  };

  const createPlaylist = async (name: string, description?: string) => {
    const newPlaylist = await storageService.createPlaylist(name, description);
    await refreshLibrary();
    return newPlaylist;
  };

  const deletePlaylist = async (playlistId: string) => {
    await storageService.deletePlaylist(playlistId);
    await refreshLibrary();
  };

  const addTrackToPlaylist = async (playlistId: string, trackId: string) => {
    await storageService.addTrackToPlaylist(playlistId, trackId);
    await refreshLibrary();
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    await storageService.removeTrackFromPlaylist(playlistId, trackId);
    await refreshLibrary();
  };

  const pickCandidateFiles = async (): Promise<CandidatePickResult> => {
    return await fileImportService.pickCandidateFiles();
  };

  const scanCandidateFiles = async (): Promise<CandidateScanResult> => {
    return await fileImportService.scanCandidateFiles();
  };

  const transferCandidateFiles = async (candidates: CandidateFile[]): Promise<Track[]> => {
    const importedTracks = await fileImportService.transferCandidateFiles(candidates);
    if (importedTracks.length > 0) {
      await refreshLibrary();
    }
    return importedTracks;
  };

  const importFromFiles = async (): Promise<ImportResult> => {
    const result = await fileImportService.pickAndImportAudioFiles();
    if (result.importedCount > 0) {
      await refreshLibrary();
    }
    return result;
  };

  const autoScanMusic = async (): Promise<ScanResult> => {
    const result = await fileImportService.autoScanLocalMusic();
    if (result.importedCount > 0) {
      await refreshLibrary();
    }
    return result;
  };

  const favorites = tracks.filter((t) => t.isFavorite);

  return (
    <LibraryContext.Provider
      value={{
        tracks,
        playlists,
        favorites,
        isLoading,
        storageUsage,
        refreshLibrary,
        addTrack,
        updateTrackMetadata,
        deleteTrack,
        toggleFavorite,
        createPlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        importFromFiles,
        autoScanMusic,
        pickCandidateFiles,
        scanCandidateFiles,
        transferCandidateFiles,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = (): LibraryContextType => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
