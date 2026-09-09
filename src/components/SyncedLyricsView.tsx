import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { lyricsService, ParsedLyrics, LyricLine } from '../services/lyricsService';
import { useTheme } from '../context/ThemeContext';
import { Track } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

interface SyncedLyricsViewProps {
  track: Track;
  currentPosition: number;
  onSeekTo: (seconds: number) => void;
  height: number;
}

export const SyncedLyricsView: React.FC<SyncedLyricsViewProps> = ({
  track,
  currentPosition,
  onSeekTo,
  height,
}) => {
  const { colors, isDark } = useTheme();
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userIsScrolling, setUserIsScrolling] = useState<boolean>(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatListRef = useRef<FlatList<LyricLine>>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLyrics(null);

    lyricsService
      .getLyrics(track.id, track.title, track.artist, track.duration)
      .then((data) => {
        if (isMounted) {
          setLyrics(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    };
  }, [track.id, track.title, track.artist]);

  // Find active line index
  const activeIndex = useMemo(() => {
    if (!lyrics || !lyrics.isSynced || lyrics.syncedLines.length === 0) return -1;
    const lines = lyrics.syncedLines;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentPosition >= lines[i].timeSec - 0.2) {
        return i;
      }
    }
    return 0;
  }, [lyrics, currentPosition]);

  // Auto-scroll when active line changes and user is not manually scrolling
  useEffect(() => {
    if (activeIndex >= 0 && !userIsScrolling && lyrics?.isSynced) {
      try {
        flatListRef.current?.scrollToIndex({
          index: activeIndex,
          animated: true,
          viewPosition: 0.38,
        });
      } catch (e) {
        // FlatList index might not be laid out yet
      }
    }
  }, [activeIndex, userIsScrolling, lyrics?.isSynced]);

  const handleLinePress = (timeSec: number) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onSeekTo(timeSec);
  };

  const handleScrollBegin = () => {
    setUserIsScrolling(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
  };

  const handleScrollEnd = () => {
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserIsScrolling(false);
    }, 3000); // Resume auto-scroll after 3 seconds of inactivity
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { height }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Fetching synced lyrics from LRCLIB...
        </Text>
      </View>
    );
  }

  if (!lyrics || (!lyrics.isSynced && !lyrics.plainLyrics)) {
    return (
      <View style={[styles.centerContainer, { height }]}>
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.65)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
            },
          ]}
        >
          <Ionicons name="musical-notes-outline" size={36} color={colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Lyrics Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Could not find synchronized lyrics for "{track.title}".
          </Text>
        </View>
      </View>
    );
  }

  // Plain lyrics fallback view
  if (!lyrics.isSynced && lyrics.plainLyrics) {
    return (
      <View style={[styles.lyricsContainer, { height }]}>
        <FlatList
          data={[{ key: 'plain', text: lyrics.plainLyrics }]}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.plainLyricsContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Text style={[styles.plainLyricsText, { color: colors.textPrimary }]}>
              {item.text}
            </Text>
          )}
        />
      </View>
    );
  }

  return (
    <View style={[styles.lyricsContainer, { height }]}>
      <FlatList
        ref={flatListRef}
        data={lyrics.syncedLines}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.syncedListContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => {
          const isActive = index === activeIndex;
          const isPassed = index < activeIndex;

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleLinePress(item.timeSec)}
              style={[
                styles.lyricLineWrapper,
                isActive && styles.activeLyricWrapper,
              ]}
            >
              <Text
                style={[
                  styles.lyricText,
                  {
                    color: isActive
                      ? (isDark ? '#FFFFFF' : colors.primary)
                      : isPassed
                      ? (isDark ? 'rgba(255, 255, 255, 0.40)' : 'rgba(15, 23, 42, 0.35)')
                      : (isDark ? 'rgba(255, 255, 255, 0.70)' : 'rgba(15, 23, 42, 0.70)'),
                    fontSize: isActive ? 23 : 19,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
              >
                {item.text}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  lyricsContainer: {
    width: '100%',
    borderRadius: RADIUS.clay,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  centerContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.clay,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 320,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  plainLyricsContent: {
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  plainLyricsText: {
    fontSize: 16,
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  syncedListContent: {
    paddingVertical: 120,
    paddingHorizontal: SPACING.lg,
  },
  lyricLineWrapper: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
  },
  activeLyricWrapper: {
    paddingVertical: 14,
    transform: [{ scale: 1.02 }],
  },
  lyricText: {
    lineHeight: 32,
    letterSpacing: -0.3,
  },
});
