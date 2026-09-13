import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { TrackItem } from '../components/TrackItem';
import { TrackOptionsModal } from '../components/TrackOptionsModal';
import { LiquidBackground } from '../components/LiquidBackground';
import { audiusService } from '../services/audiusService';
import { Track } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

export const SearchScreen: React.FC = () => {
  const { tracks, toggleFavorite } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { colors, isDark } = useTheme();

  const [searchMode, setSearchMode] = useState<'library' | 'online'>('library');
  const [query, setQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Online Streaming States
  const [onlineTracks, setOnlineTracks] = useState<Track[]>([]);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const debounceTimerRef = useRef<any>(null);

  // Local Library Results
  const libraryResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [tracks, query]);

  // Load trending online tracks on initial switch to online mode
  useEffect(() => {
    if (searchMode === 'online' && onlineTracks.length === 0 && !query.trim()) {
      loadTrendingTracks();
    }
  }, [searchMode]);

  // Debounced online search
  useEffect(() => {
    if (searchMode !== 'online') return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      loadTrendingTracks();
      return;
    }

    setIsOnlineLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await audiusService.searchTracks(query.trim(), 30);
        setOnlineTracks(results);
      } catch (e) {
        console.warn('Online search error:', e);
      } finally {
        setIsOnlineLoading(false);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, searchMode]);

  const loadTrendingTracks = async () => {
    setIsOnlineLoading(true);
    try {
      const trending = await audiusService.getTrendingTracks(undefined, 25);
      setOnlineTracks(trending);
    } catch (e) {
      console.warn('Failed to load trending tracks:', e);
    } finally {
      setIsOnlineLoading(false);
    }
  };

  const handleSwitchMode = (mode: 'library' | 'online') => {
    if (searchMode === mode) return;
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setSearchMode(mode);
  };

  const currentResults = searchMode === 'library' ? libraryResults : onlineTracks;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Search</Text>

          {/* Liquid Glass Segmented Mode Switcher */}
          <View
            style={[
              styles.segmentContainer,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.72)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.65)',
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.95)',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                searchMode === 'library' && {
                  backgroundColor: isDark ? 'rgba(255, 45, 85, 0.35)' : 'rgba(250, 36, 60, 0.18)',
                  borderColor: isDark ? 'rgba(255, 80, 115, 0.65)' : 'rgba(250, 36, 60, 0.45)',
                  borderTopColor: isDark ? 'rgba(255, 150, 175, 0.85)' : 'rgba(250, 36, 60, 0.70)',
                  borderWidth: 1.2,
                  shadowColor: '#FA243C',
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                },
              ]}
              onPress={() => handleSwitchMode('library')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="library"
                size={15}
                color={searchMode === 'library' ? '#FA243C' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: searchMode === 'library' ? '#FA243C' : colors.textMuted,
                    fontWeight: searchMode === 'library' ? '700' : '600',
                  },
                ]}
              >
                My Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                searchMode === 'online' && {
                  backgroundColor: isDark ? 'rgba(255, 45, 85, 0.35)' : 'rgba(250, 36, 60, 0.18)',
                  borderColor: isDark ? 'rgba(255, 80, 115, 0.65)' : 'rgba(250, 36, 60, 0.45)',
                  borderTopColor: isDark ? 'rgba(255, 150, 175, 0.85)' : 'rgba(250, 36, 60, 0.70)',
                  borderWidth: 1.2,
                  shadowColor: '#FA243C',
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                },
              ]}
              onPress={() => handleSwitchMode('online')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="globe-outline"
                size={15}
                color={searchMode === 'online' ? '#FA243C' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: searchMode === 'online' ? '#FA243C' : colors.textMuted,
                    fontWeight: searchMode === 'online' ? '700' : '600',
                  },
                ]}
              >
                Explore Online (0 MB)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Liquid Glass Search Input */}
        <View
          style={[
            styles.searchBarWrapper,
            {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.08)',
              shadowColor: '#000',
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 90 : 100}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={styles.searchBlur}
          >
            <Ionicons name="search" size={18} color={isDark ? 'rgba(255, 255, 255, 0.6)' : colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#FFFFFF' : colors.textPrimary }]}
              placeholder={
                searchMode === 'library'
                  ? 'Search songs, artists, albums in library...'
                  : 'Search millions of free online tracks...'
              }
              placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.45)' : colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus={false}
              autoCorrect={false}
              clearButtonMode="always"
            />
            {isOnlineLoading ? (
              <ActivityIndicator size="small" color="#FA243C" />
            ) : query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </BlurView>
        </View>

        {/* Results */}
        <FlatList
          data={currentResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              isCurrent={currentTrack?.id === item.id}
              isPlaying={isPlaying && currentTrack?.id === item.id}
              onPress={() => playTrack(item, currentResults)}
              onFavoritePress={() => toggleFavorite(item.id)}
              onOptionsPress={() => setSelectedTrack(item)}
            />
          )}
          ListHeaderComponent={
            searchMode === 'online' && !query.trim() && onlineTracks.length > 0 ? (
              <View style={styles.onlineSectionHeader}>
                <Ionicons name="flame" size={16} color="#FF5252" style={{ marginRight: 6 }} />
                <Text style={[styles.onlineSectionTitle, { color: colors.textPrimary }]}>
                  Trending Hits (Stream Online • 0 MB)
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            isOnlineLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Finding free online tracks...
                </Text>
              </View>
            ) : query.trim() ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No Results Found
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {searchMode === 'library'
                    ? `No offline songs matching "${query}".`
                    : `No online tracks found for "${query}".`}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name={searchMode === 'library' ? 'musical-notes-outline' : 'globe-outline'}
                  size={40}
                  color={colors.primary}
                />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {searchMode === 'library' ? 'Search Your Library' : 'Explore Free Music Online'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {searchMode === 'library'
                    ? 'Find any song, artist, or album in your library.'
                    : 'Stream millions of tracks instantly with 0 MB storage taken.'}
                </Text>
              </View>
            )
          }
        />

        <TrackOptionsModal
          visible={!!selectedTrack}
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  segmentText: {
    fontSize: 13,
  },
  searchBarWrapper: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.xs + 2,
    height: 42,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchBlur: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: 160,
  },
  onlineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  onlineSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    gap: SPACING.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});
