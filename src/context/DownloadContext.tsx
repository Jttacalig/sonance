import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { DownloadItem, DownloadStatus, Track } from '../types/music';
import { downloaderService, ExtractedInfo } from '../services/downloaderService';
import { AudioFormat } from '../constants/endpoints';
import { useLibrary } from './LibraryContext';

const MAX_CONCURRENT_DOWNLOADS = 2;

export interface BulkDownloadEntry {
  info: ExtractedInfo;
  format?: AudioFormat;
}

interface DownloadContextType {
  downloads: DownloadItem[];
  activeCount: number;
  queuedCount: number;
  activeDownload: DownloadItem | null;
  isDownloadsModalOpen: boolean;
  openDownloadsModal: () => void;
  closeDownloadsModal: () => void;
  addDownload: (info: ExtractedInfo, format?: AudioFormat) => Promise<string>;
  addBulkDownloads: (items: BulkDownloadEntry[]) => Promise<string[]>;
  cancelDownload: (id: string) => void;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;
  retryDownload: (id: string) => void;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isDownloadsModalOpen, setIsDownloadsModalOpen] = useState(false);
  const { refreshLibrary } = useLibrary();

  const downloadsRef = useRef<DownloadItem[]>([]);
  downloadsRef.current = downloads;

  const runningIdsRef = useRef<Set<string>>(new Set());

  const updateDownloadItem = useCallback((id: string, updates: Partial<DownloadItem>) => {
    setDownloads(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const processQueue = useCallback(async () => {
    if (runningIdsRef.current.size >= MAX_CONCURRENT_DOWNLOADS) {
      return;
    }

    // Find next queued item not currently running
    const nextItem = downloadsRef.current.find(
      item => item.status === 'queued' && !runningIdsRef.current.has(item.id)
    );

    if (!nextItem) return;

    const downloadId = nextItem.id;
    const itemFormat = (nextItem.format as AudioFormat) || 'm4a';
    runningIdsRef.current.add(downloadId);

    // Transition item to resolving
    updateDownloadItem(downloadId, { status: 'resolving', progress: 0.05 });

    // Execute download worker asynchronously in background
    (async () => {
      try {
        const track = await downloaderService.startDownload(
          nextItem,
          itemFormat,
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
      } catch (error: any) {
        updateDownloadItem(downloadId, {
          status: 'error',
          errorMessage: error?.message || 'Download failed',
        });
      } finally {
        runningIdsRef.current.delete(downloadId);
        // Automatically schedule processing next item in queue
        setTimeout(() => {
          processQueue();
        }, 50);
      }
    })();

    // Check if there is room to run an additional concurrent download immediately
    if (runningIdsRef.current.size < MAX_CONCURRENT_DOWNLOADS) {
      setTimeout(() => {
        processQueue();
      }, 50);
    }
  }, [refreshLibrary, updateDownloadItem]);

  // Trigger queue check whenever downloads change
  useEffect(() => {
    processQueue();
  }, [downloads, processQueue]);

  const addDownload = async (info: ExtractedInfo, format: AudioFormat = 'm4a'): Promise<string> => {
    const downloadId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newDownload: DownloadItem = {
      id: downloadId,
      url: info.sourceUrl,
      title: info.title,
      artist: info.artist,
      thumbnailUrl: info.thumbnailUrl,
      duration: info.duration,
      format,
      status: 'queued',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      createdAt: Date.now(),
    };

    setDownloads(prev => [newDownload, ...prev]);
    return downloadId;
  };

  const addBulkDownloads = async (items: BulkDownloadEntry[]): Promise<string[]> => {
    const createdIds: string[] = [];
    const newDownloads: DownloadItem[] = items.map((entry, idx) => {
      const downloadId = `dl_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      createdIds.push(downloadId);
      return {
        id: downloadId,
        url: entry.info.sourceUrl,
        title: entry.info.title,
        artist: entry.info.artist,
        thumbnailUrl: entry.info.thumbnailUrl,
        duration: entry.info.duration,
        format: entry.format || 'm4a',
        status: 'queued',
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        createdAt: Date.now() + idx,
      };
    });

    setDownloads(prev => [...newDownloads, ...prev]);
    return createdIds;
  };

  const cancelDownload = (id: string) => {
    downloaderService.cancelDownload(id);
    runningIdsRef.current.delete(id);
    updateDownloadItem(id, { status: 'error', errorMessage: 'Download cancelled' });
    setTimeout(() => processQueue(), 50);
  };

  const retryDownload = (id: string) => {
    updateDownloadItem(id, { status: 'queued', progress: 0, errorMessage: undefined });
  };

  const removeDownload = (id: string) => {
    runningIdsRef.current.delete(id);
    setDownloads(prev => prev.filter(d => d.id !== id));
  };

  const clearCompleted = () => {
    setDownloads(prev => prev.filter(d => d.status !== 'completed'));
  };

  const activeDownloads = downloads.filter(
    d => d.status === 'resolving' || d.status === 'downloading' || d.status === 'saving'
  );
  const queuedDownloads = downloads.filter(d => d.status === 'queued');
  const activeCount = activeDownloads.length;
  const queuedCount = queuedDownloads.length;
  const activeDownload = activeDownloads.length > 0 ? activeDownloads[0] : (queuedDownloads.length > 0 ? queuedDownloads[0] : null);

  const openDownloadsModal = () => setIsDownloadsModalOpen(true);
  const closeDownloadsModal = () => setIsDownloadsModalOpen(false);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        activeCount,
        queuedCount,
        activeDownload,
        isDownloadsModalOpen,
        openDownloadsModal,
        closeDownloadsModal,
        addDownload,
        addBulkDownloads,
        cancelDownload,
        removeDownload,
        clearCompleted,
        retryDownload,
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
