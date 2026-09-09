import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { TrackItem } from '../components/TrackItem';
import { LiquidBackground } from '../components/LiquidBackground';
import { Playlist, Track } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

interface PlaylistDetailScreenProps {
  playlist: Playlist;
  onBack: () => void;
}

export const PlaylistDetailScreen: React.FC<PlaylistDetailScreenProps> = ({
  playlist,
  onBack,
}) => {
  const { tracks, removeTrackFromPlaylist, toggleFavorite } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { colors, isDark } = useTheme();

  const playlistTracks: Track[] = playlist.trackIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter((t): t is Track => !!t);

  const handlePlayAll = (shuffle = false) => {
    if (playlistTracks.length === 0) return;
    if (shuffle) {
      const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      playTrack(playlistTracks[0], playlistTracks);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LiquidBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Sleek Minimal Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.backGlassBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.75)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
              },
            ]}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {playlist.name}
            </Text>
            <View
              style={[
                styles.badgePill,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                {playlistTracks.length}
              </Text>
            </View>
          </View>

          {/* Quick Play & Shuffle Icon Controls */}
          {playlistTracks.length > 0 ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtnWrapper}
                onPress={() => handlePlayAll(false)}
                activeOpacity={0.8}
                accessibilityLabel="Play All"
              >
                <View
                  style={[
                    styles.playIconBtn,
                    {
                      backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                      shadowColor: isDark ? '#FFFFFF' : colors.primary,
                    },
                  ]}
                >
                  <Ionicons name="play" size={16} color={isDark ? '#070A10' : '#FFF'} style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shuffleIconBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.75)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#FFFFFF',
                    shadowColor: isDark ? '#000' : '#8CA0BA',
                  },
                ]}
                onPress={() => handlePlayAll(true)}
                activeOpacity={0.8}
                accessibilityLabel="Shuffle"
              >
                <Ionicons name="shuffle" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>

        {/* Track List */}
        <FlatList
          data={playlistTracks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              isCurrent={currentTrack?.id === item.id}
              isPlaying={isPlaying && currentTrack?.id === item.id}
              onPress={() => playTrack(item, playlistTracks)}
              onFavoritePress={() => toggleFavorite(item.id)}
              onOptionsPress={() => removeTrackFromPlaylist(playlist.id, item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-note" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                This Playlist is Empty
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Add songs from the Library tab by tapping the options (•••) on any song.
              </Text>
            </View>
          }
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.xs,
  },
  backGlassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: SPACING.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    maxWidth: '70%',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtnWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  playIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  shuffleIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  listContent: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: 180,
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
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
