import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { TrackItem } from '../components/TrackItem';
import { TrackOptionsModal } from '../components/TrackOptionsModal';
import { LiquidBackground } from '../components/LiquidBackground';
import { Track } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

export const SearchScreen: React.FC = () => {
  const { tracks, toggleFavorite } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { colors, isDark } = useTheme();

  const [query, setQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [tracks, query]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LiquidBackground />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Search</Text>
        </View>

        {/* Frosted Glass Search Input */}
        <View
          style={[
            styles.searchBarWrapper,
            {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.85)',
              shadowColor: isDark ? '#000' : '#8CA0BA',
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 85 : 100}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={styles.searchBlur}
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Artists, songs, albums..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus={false}
              autoCorrect={false}
              clearButtonMode="always"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </BlurView>
        </View>

        {/* Results */}
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              isCurrent={currentTrack?.id === item.id}
              isPlaying={isPlaying && currentTrack?.id === item.id}
              onPress={() => playTrack(item, searchResults)}
              onFavoritePress={() => toggleFavorite(item.id)}
              onOptionsPress={() => setSelectedTrack(item)}
            />
          )}
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No Results Found
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  No offline songs matching "{query}".
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="sparkles-outline" size={40} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Search Your Offline Music
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Find any downloaded song, artist, or album instantly.
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
