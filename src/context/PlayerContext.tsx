import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, AudioPlayer, AudioStatus, AudioSource } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Track, RepeatMode } from '../types/music';
import * as FileSystem from 'expo-file-system/legacy';
import { storageService, MUSIC_DIR, ARTWORK_DIR } from '../services/storageService';

interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  playbackRate: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isFullPlayerVisible: boolean;
  sleepTimerMinutes: number | null;
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  toggleRepeatMode: () => void;
  toggleShuffle: () => void;
  setSleepTimer: (minutes: number | null) => void;
  setFullPlayerVisible: (visible: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const playerRef = useRef<AudioPlayer | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const isPlayRequestedRef = useRef<boolean>(false);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setRate] = useState<number>(1.0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isFullPlayerVisible, setFullPlayerVisible] = useState<boolean>(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;

  const isShuffleRef = useRef(isShuffle);
  isShuffleRef.current = isShuffle;

  const queueRef = useRef(queue);
  queueRef.current = queue;

  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  // Initialize iOS & Android Background Audio Mode
  useEffect(() => {
    async function setupAudio() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
          allowsRecording: false,
          shouldRouteThroughEarpiece: false,
          allowsBackgroundRecording: false,
        });
        await setIsAudioActiveAsync(true);
      } catch (error) {
        console.warn('setAudioModeAsync error:', error);
      }
    }
    setupAudio();

    // Re-affirm background audio mode on app state transitions
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if ((nextState === 'background' || nextState === 'inactive') && isPlayRequestedRef.current) {
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: 'doNotMix',
            allowsRecording: false,
            shouldRouteThroughEarpiece: false,
            allowsBackgroundRecording: false,
          });
          await setIsAudioActiveAsync(true);
          if (playerRef.current && !playerRef.current.playing) {
            playerRef.current.play();
          }
        } catch (e) {
          console.warn('Background audio state ensure warning:', e);
        }
      }
    });

    return () => {
      appStateSub.remove();
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.clearLockScreenControls();
          playerRef.current.remove();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, []);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimerMinutes === null || sleepTimerMinutes <= 0) return;

    const timer = setInterval(() => {
      setSleepTimerMinutes((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          pauseTrack();
          return null;
        }
        return prev - 1;
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [sleepTimerMinutes]);

  const onPlaybackStatusUpdate = useCallback((status: AudioStatus) => {
    if (!playerRef.current || status.id !== playerRef.current.id) {
      return;
    }

    if (status.currentTime !== undefined && !isNaN(status.currentTime)) {
      const curTime = status.currentTime;
      setPosition(Math.round(curTime));
    }

    if (status.duration && status.duration > 0 && !isNaN(status.duration)) {
      setDuration(Math.round(status.duration));
    }

    if (status.isBuffering) {
      setIsLoading(true);
    }

    if (status.playing) {
      setIsPlaying(true);
      setIsLoading(false);
    } else {
      if (!isPlayRequestedRef.current) {
        setIsPlaying(false);
        setIsLoading(false);
      } else {
        setIsPlaying(true);
        if (status.isLoaded && !status.isBuffering) {
          setIsLoading(false);
          try {
            playerRef.current.play();
          } catch (e) {}
        }
      }
    }

    // Handle track completion
    if (status.didJustFinish) {
      if (repeatModeRef.current === 'one') {
        playerRef.current?.seekTo(0);
        playerRef.current?.play();
      } else {
        skipToNext();
      }
    }
  }, []);

  const cleanupActivePlayer = () => {
    if (listenerRef.current) {
      listenerRef.current.remove();
      listenerRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.clearLockScreenControls();
        playerRef.current.remove();
      } catch (e) {
        console.warn('Player cleanup error:', e);
      }
      playerRef.current = null;
    }
  };

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    // If clicking on the exact same track that is already active:
    if (currentTrackRef.current?.id === track.id) {
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (isPlaying) {
        await pauseTrack();
      } else {
        await resumeTrack();
      }
      return;
    }

    const requestId = ++activeRequestIdRef.current;
    isPlayRequestedRef.current = true;

    try {
      setIsLoading(true);
      setIsPlaying(true);
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      // 1. Fully stop and clean up existing native player
      cleanupActivePlayer();

      // 2. Update active queue and track state
      let activeQueue = newQueue || queueRef.current;
      if (!activeQueue.some((t) => t.id === track.id)) {
        activeQueue = [track, ...activeQueue];
      }
      setQueue(activeQueue);
      const newIndex = activeQueue.findIndex((t) => t.id === track.id);
      setQueueIndex(newIndex);
      setCurrentTrack(track);
      setPosition(0);
      setDuration(track.duration || 0);

      // Ensure audio subsystem and background playback are active
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        shouldRouteThroughEarpiece: false,
        allowsRecording: false,
      }).catch(() => {});
      await setIsAudioActiveAsync(true).catch(() => {});

      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      // 3. Resolve playback source (local offline file or cloud/online stream)
      let uriToPlay = track.uri || '';
      let verifiedArtworkUri = track.artworkUri;

      if (uriToPlay.startsWith('file://')) {
        const fileName = uriToPlay.split('/').pop()?.split('?')[0];
        if (fileName) {
          const currentPath = `${MUSIC_DIR}${fileName}`;
          try {
            const currentInfo = await FileSystem.getInfoAsync(currentPath);
            if (currentInfo.exists) {
              uriToPlay = currentPath;
            } else {
              const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, '');
              const altExts = ['m4a', 'mp3', 'flac', 'wav', 'aac'];
              for (const ext of altExts) {
                const altPath = `${MUSIC_DIR}${baseName}.${ext}`;
                const altInfo = await FileSystem.getInfoAsync(altPath);
                if (altInfo.exists) {
                  uriToPlay = altPath;
                  break;
                }
              }
            }
          } catch (fsErr) {
            console.warn('File check warning:', fsErr);
          }
        }
        try {
          uriToPlay = encodeURI(decodeURI(uriToPlay));
        } catch (e) {}

        if (verifiedArtworkUri && verifiedArtworkUri.startsWith('file://')) {
          const artFileName = verifiedArtworkUri.split('/').pop()?.split('?')[0];
          if (artFileName) {
            verifiedArtworkUri = `${ARTWORK_DIR}${artFileName}`;
          }
        }
      }

      // 4. Construct AudioSource with custom headers if needed (Google Drive streams)
      const source: AudioSource = track.streamHeaders
        ? { uri: uriToPlay, headers: track.streamHeaders }
        : uriToPlay;

      // 5. Create fresh expo-audio native player
      const player = createAudioPlayer(source, {
        updateInterval: 250,
        keepAudioSessionActive: true,
        preferredForwardBufferDuration: 30,
      });
      playerRef.current = player;

      const sub = player.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
      listenerRef.current = sub;

      // 6. Configure iOS Lock Screen controls & Now Playing metadata
      try {
        const metadata: any = {
          title: track.title || 'Unknown Title',
          artist: track.artist || 'Unknown Artist',
          albumTitle: track.album || (track.isCloudStream ? 'Cloud Stream' : 'Sonance Player'),
        };
        if (
          verifiedArtworkUri &&
          typeof verifiedArtworkUri === 'string' &&
          (verifiedArtworkUri.startsWith('file://') || verifiedArtworkUri.startsWith('http://') || verifiedArtworkUri.startsWith('https://'))
        ) {
          metadata.artworkUrl = verifiedArtworkUri;
        }

        player.setActiveForLockScreen(true, metadata, {
          showSeekForward: true,
          showSeekBackward: true,
          isLiveStream: false,
        });
      } catch (e) {
        console.warn('Lockscreen metadata set error:', e);
      }

      if (playbackRate !== 1.0) {
        try {
          player.playbackRate = playbackRate;
        } catch (rateErr) {
          console.warn('Set playback rate error:', rateErr);
        }
      }

      if (requestId === activeRequestIdRef.current) {
        player.play();
        setIsPlaying(true);
        setIsLoading(false);
        storageService.incrementPlayCount(track.id).catch(() => {});
      }
    } catch (error) {
      console.error('Error playing track in PlayerContext:', error);
      if (requestId === activeRequestIdRef.current) {
        cleanupActivePlayer();
        isPlayRequestedRef.current = false;
        setIsLoading(false);
        setIsPlaying(false);
      }
    }
  };

  const togglePlayPause = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (!playerRef.current) {
      if (currentTrack) {
        await playTrack(currentTrack);
      } else if (queue.length > 0) {
        await playTrack(queue[0]);
      }
      return;
    }

    if (isPlaying) {
      isPlayRequestedRef.current = false;
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      isPlayRequestedRef.current = true;
      setIsAudioActiveAsync(true).catch(() => {});
      playerRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseTrack = async () => {
    isPlayRequestedRef.current = false;
    if (playerRef.current && isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resumeTrack = async () => {
    isPlayRequestedRef.current = true;
    if (playerRef.current && !isPlaying) {
      setIsAudioActiveAsync(true).catch(() => {});
      playerRef.current.play();
      setIsPlaying(true);
    }
  };

  const skipToNext = async () => {
    const currentQ = queueRef.current;
    if (currentQ.length === 0) return;

    let nextIndex = queueIndexRef.current + 1;
    if (isShuffleRef.current) {
      nextIndex = Math.floor(Math.random() * currentQ.length);
    } else if (nextIndex >= currentQ.length) {
      if (repeatModeRef.current === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    const nextTrack = currentQ[nextIndex];
    if (nextTrack) {
      await playTrack(nextTrack, currentQ);
    }
  };

  const skipToPrevious = async () => {
    if (position > 3) {
      await seekTo(0);
      return;
    }

    const currentQ = queueRef.current;
    if (currentQ.length === 0) return;

    let prevIndex = queueIndexRef.current - 1;
    if (prevIndex < 0) {
      prevIndex = currentQ.length - 1;
    }

    const prevTrack = currentQ[prevIndex];
    if (prevTrack) {
      await playTrack(prevTrack, currentQ);
    }
  };

  const seekTo = async (seconds: number) => {
    setPosition(seconds);
    if (playerRef.current) {
      await playerRef.current.seekTo(seconds);
    }
  };

  const setPlaybackRate = async (rate: number) => {
    setRate(rate);
    if (playerRef.current) {
      playerRef.current.playbackRate = rate;
    }
  };

  const toggleRepeatMode = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsShuffle((prev) => !prev);
  };

  const stopPlayback = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    isPlayRequestedRef.current = false;
    cleanupActivePlayer();
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTrack(null);
    setPosition(0);
    setDuration(0);
    setFullPlayerVisible(false);
  };

  const setSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        queueIndex,
        isPlaying,
        isLoading,
        position,
        duration: duration || currentTrack?.duration || 0,
        playbackRate,
        repeatMode,
        isShuffle,
        isFullPlayerVisible,
        sleepTimerMinutes,
        playTrack,
        togglePlayPause,
        pauseTrack,
        resumeTrack,
        stopPlayback,
        skipToNext,
        skipToPrevious,
        seekTo,
        setPlaybackRate,
        toggleRepeatMode,
        toggleShuffle,
        setSleepTimer,
        setFullPlayerVisible,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

