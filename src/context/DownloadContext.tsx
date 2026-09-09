import React, { createContext, useContext, useState } from 'react';
import { DownloadItem, DownloadStatus, Track } from '../types/music';
import { downloaderService, ExtractedInfo } from '../services/downloaderService';
import { AudioFormat } from '../constants/endpoints';
import { useLibrary } from './LibraryContext';

interface DownloadContextType {
  downloads: DownloadItem[];
  activeCount: number;
  activeDownload: DownloadItem | null;
  isDownloadsModalOpen: boolean;
  openDownloadsModal: () => void;
  closeDownloadsModal: () => void;
  addDownload: (info: ExtractedInfo, format?: AudioFormat) => Promise<Track>;
  cancelDownload: (id: string) => void;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isDownloadsModalOpen, setIsDownloadsModalOpen] = useState(false);
  const { refreshLibrary } = useLibrary();

  const updateDownloadItem = (id: string, updates: Partial<DownloadItem>) => {
    setDownloads(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const addDownload = async (info: ExtractedInfo, format: AudioFormat = 'm4a'): Promise<Track> => {
    const downloadId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newDownload: DownloadItem = {
      id: downloadId,
      url: info.sourceUrl,
      title: info.title,
      artist: info.artist,
      thumbnailUrl: info.thumbnailUrl,
      duration: info.duration,
      status: 'idle',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      createdAt: Date.now(),
    };

    setDownloads(prev => [newDownload, ...prev]);

    try {
      const track = await downloaderService.startDownload(
        newDownload,
        format,
        (progress, bytesDownloaded, totalBytes) => {
          updateDownloadItem(downloadId, {
            status: 'downloading',
            progress,
            bytesDownloaded,
            totalBytes,
          });
        },
        (status: DownloadStatus, message?: string) => {
          updateDownloadItem(downloadId, {
            status,
            errorMessage: status === 'error' ? message : undefined,
          });
        }
      );

      updateDownloadItem(downloadId, {
        status: 'completed',
        progress: 1,
        trackId: track.id,
      });

      await refreshLibrary();
      return track;
    } catch (error: any) {
      updateDownloadItem(downloadId, {
        status: 'error',
        errorMessage: error?.message || 'Download failed',
      });
      throw error;
    }
  };

  const cancelDownload = (id: string) => {
    downloaderService.cancelDownload(id);
    updateDownloadItem(id, { status: 'error', errorMessage: 'Download cancelled' });
  };

  const removeDownload = (id: string) => {
    setDownloads(prev => prev.filter(d => d.id !== id));
  };

  const clearCompleted = () => {
    setDownloads(prev => prev.filter(d => d.status !== 'completed'));
  };

  const activeDownloads = downloads.filter(
    d => d.status === 'resolving' || d.status === 'downloading' || d.status === 'saving'
  );
  const activeCount = activeDownloads.length;
  const activeDownload = activeDownloads.length > 0 ? activeDownloads[0] : null;

  const openDownloadsModal = () => setIsDownloadsModalOpen(true);
  const closeDownloadsModal = () => setIsDownloadsModalOpen(false);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        activeCount,
        activeDownload,
        isDownloadsModalOpen,
        openDownloadsModal,
        closeDownloadsModal,
        addDownload,
        cancelDownload,
        removeDownload,
        clearCompleted,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloads = (): DownloadContextType => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
};
