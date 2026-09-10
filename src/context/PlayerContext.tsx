import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Track, RepeatMode } from '../types/music';
import * as FileSystem from 'expo-file-system/legacy';
import { storageService, MUSIC_DIR, ARTWORK_DIR } from '../services/storageService';
import { downloaderService } from '../services/downloaderService';

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

  // Initialize iOS Background Audio Mode
  useEffect(() => {
    async function setupAudio() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
        await setIsAudioActiveAsync(true);
      } catch (error) {
        console.warn('setAudioModeAsync error:', error);
      }
    }
    setupAudio();

    return () => {
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
    // Ignore events from old/removed players
    if (!playerRef.current || status.id !== playerRef.current.id) {
      return;
    }

    if (status.currentTime !== undefined) {
      setPosition(Math.round(status.currentTime));
    }

    if (status.duration) {
      setDuration(Math.round(status.duration));
    }

    if (status.isBuffering) {
      setIsLoading(true);
    }

    if (status.playing) {
      setIsPlaying(true);
      setIsLoading(false);
    } else {
      // If native player is not currently playing:
      if (!isPlayRequestedRef.current) {
        // User explicitly paused playback
        setIsPlaying(false);
        setIsLoading(false);
      } else {
        // User requested play, but native player is preparing or buffering
        if (status.isLoaded && !status.isBuffering) {
          // Player is ready, trigger play to ensure it starts without waiting for second click
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
    // If clicking on the exact same track that already has an active player:
    if (currentTrackRef.current?.id === track.id && playerRef.current) {
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
      return;
    }

    // Increment request ID to invalidate any in-flight transitions
    const requestId = ++activeRequestIdRef.current;
    isPlayRequestedRef.current = true;

    try {
      setIsLoading(true);
      setIsPlaying(true);
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      // 1. Fully stop, unhook listener, and remove old player
      cleanupActivePlayer();

      // 2. Update active queue and track state
      let activeQueue = newQueue || queueRef.current;
      if (!activeQueue.some(t => t.id === track.id)) {
        activeQueue = [track, ...activeQueue];
      }
      setQueue(activeQueue);
      const newIndex = activeQueue.findIndex(t => t.id === track.id);
      setQueueIndex(newIndex);
      setCurrentTrack(track);
      setPosition(0);
      setDuration(track.duration || 0);

      // Ensure iOS audio subsystem is active
      await setIsAudioActiveAsync(true).catch(() => {});

      // Check if a newer play request arrived while setting up
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      // 3. Resolve and verify file URI on disk or online stream
      let uriToPlay = track.uri;
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
              const origInfo = await FileSystem.getInfoAsync(uriToPlay);
              if (origInfo.exists) {
                // original URI still exists
              } else {
                console.warn('Audio file not found at:', currentPath, 'or', uriToPlay);
              }
            }
          } catch (fsErr) {
            console.warn('File check warning:', fsErr);
          }
        }
        if (uriToPlay.includes(' ')) {
          uriToPlay = encodeURI(uriToPlay);
        }
      } else if (uriToPlay.startsWith('http://') || uriToPlay.startsWith('https://')) {
        // Online stream URI
        const isDirectAudioStream =
          uriToPlay.includes('.googlevideo.com') ||
          uriToPlay.includes('pipedproxy') ||
          uriToPlay.includes('invidious') ||
          uriToPlay.match(/\.(mp3|m4a|wav|flac|aac|ogg)(\?|$)/i);

        // If it's a web page URL (e.g. YouTube video URL in a queue), resolve stream URL
        if (!isDirectAudioStream && (uriToPlay.includes('youtube.com') || uriToPlay.includes('youtu.be') || track.sourceUrl)) {
          try {
            const resolved = await downloaderService.resolveAudioStreamUrl(track.sourceUrl || uriToPlay, 'm4a');
            if (resolved && resolved.streamUrl) {
              uriToPlay = resolved.streamUrl;
            }
          } catch (resErr) {
            console.warn('Online stream resolution error in PlayerContext:', resErr);
          }
        }
      }

      if (verifiedArtworkUri && verifiedArtworkUri.startsWith('file://')) {
        const artFileName = verifiedArtworkUri.split('/').pop()?.split('?')[0];
        if (artFileName) {
          verifiedArtworkUri = `${ARTWORK_DIR}${artFileName}`;
        }
      }

      // 4. Create fresh new expo-audio player with immediate session activation
      const player = createAudioPlayer(uriToPlay, {
        updateInterval: 250,
        keepAudioSessionActive: true,
      });
      playerRef.current = player;

      // 5. Subscribe strictly to this player's events
      const sub = player.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
      listenerRef.current = sub;

      // 6. Configure iOS Lock Screen controls & Dynamic Island / Control Center info
      try {
        player.setActiveForLockScreen(
          true,
          {
            title: track.title,
            artist: track.artist,
            albumTitle: track.album || 'Offline Library',
            artworkUrl: verifiedArtworkUri,
          },
          {
            showSeekForward: true,
            showSeekBackward: true,
            isLiveStream: false,
          }
        );
      } catch (e) {
        console.warn('Lockscreen metadata set error:', e);
      }

      // 7. Set speed and start playback immediately
      if (playbackRate !== 1.0) {
        player.playbackRate = playbackRate;
      }

      // 8. Start playback immediately
      if (requestId === activeRequestIdRef.current) {
        player.play();
        setIsPlaying(true);
        setIsLoading(false);
        storageService.incrementPlayCount(track.id).catch(() => {});
      }
    } catch (error) {
      console.error('Error playing track with expo-audio:', error);
      if (requestId === activeRequestIdRef.current) {
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
    if (position > 3 && playerRef.current) {
      await playerRef.current.seekTo(0);
      setPosition(0);
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
    if (playerRef.current) {
      await playerRef.current.seekTo(seconds);
      setPosition(seconds);
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
