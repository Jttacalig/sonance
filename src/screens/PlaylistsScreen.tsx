import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { PlaylistItem } from '../components/PlaylistItem';
import { CreatePlaylistModal } from '../components/CreatePlaylistModal';
import { LiquidBackground } from '../components/LiquidBackground';
import { Playlist, Track } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

interface PlaylistsScreenProps {
  onSelectPlaylist: (playlist: Playlist) => void;
}

type PlaylistTab = 'playlists' | 'folders';

export const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({ onSelectPlaylist }) => {
  const { tracks, playlists, favorites, createPlaylist, deletePlaylist } = useLibrary();
  const { playTrack } = usePlayer();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<PlaylistTab>('playlists');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 1. Smart Dynamic Playlists Calculations
  const recentTracks = useMemo(() => {
    return [...tracks].sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 30);
  }, [tracks]);

  const losslessTracks = useMemo(() => {
    return tracks.filter((t) => t.format === 'flac' || t.format === 'wav' || t.format === 'm4a');
  }, [tracks]);

  const mostPlayedTracks = useMemo(() => {
    // Priority to favorites + recent
    return [...favorites, ...tracks.filter((t) => !t.isFavorite)].slice(0, 30);
  }, [tracks, favorites]);

  // 2. Folder Groups Calculation
  const folderGroups = useMemo(() => {
    const map = new Map<string, Track[]>();

    for (const track of tracks) {
      let folderName = 'Sonance Library';
      if (track.album) {
        folderName = track.album;
      } else if (track.uri.includes('/')) {
        const parts = track.uri.split('/');
        if (parts.length > 2) {
          folderName = decodeURIComponent(parts[parts.length - 2]);
        }
      }

      if (!map.has(folderName)) {
        map.set(folderName, []);
      }
      map.get(folderName)!.push(track);
    }

    return Array.from(map.entries()).map(([name, groupTracks]) => ({
      name,
      tracks: groupTracks,
      count: groupTracks.length,
    }));
  }, [tracks]);

  const handleCreate = async (name: string, desc?: string) => {
    await createPlaylist(name, desc);
  };

  const handlePlaylistOptions = (playlist: Playlist) => {
    Alert.alert(playlist.name, 'Manage this playlist', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Playlist',
        style: 'destructive',
        onPress: () => deletePlaylist(playlist.id),
      },
    ]);
  };

  const handleOpenSmartPlaylist = (id: string, name: string, smartTracks: Track[], desc: string) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const virtualPlaylist: Playlist = {
      id,
      name,
      description: desc,
      trackIds: smartTracks.map((t) => t.id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSelectPlaylist(virtualPlaylist);
  };

  const handlePlayFolder = (folderName: string, folderTracks: Track[]) => {
    if (folderTracks.length === 0) return;
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    playTrack(folderTracks[0], folderTracks);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LiquidBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Sleek Minimal Header */}
        <View style={styles.header}>
          <View style={styles.titleWithBadge}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Playlists</Text>
            <View
              style={[
                styles.badgePill,
                {
                  backgroundColor: isDark
                    ? 'rgba(0, 242, 254, 0.14)'
                    : 'rgba(0, 180, 216, 0.12)',
                  borderColor: isDark ? 'rgba(0, 242, 254, 0.3)' : 'rgba(0, 180, 216, 0.25)',
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.accentCyan }]}>
                {activeTab === 'playlists' ? playlists.length + 4 : folderGroups.length}
              </Text>
            </View>
          </View>

          {activeTab === 'playlists' && (
            <TouchableOpacity
              style={styles.createBtnWrapper}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.85}
              accessibilityLabel="New Playlist"
            >
              <LinearGradient
                colors={[colors.primary, '#FF007A', colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.createBtn, { shadowColor: colors.primary }]}
              >
                <Ionicons name="add" size={22} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Segmented Tab Pill Selector */}
        <View style={styles.tabCapsuleWrapper}>
          <View
            style={[
              styles.tabCapsule,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'playlists' && [
                  styles.activeTabBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#FFFFFF' },
                ],
              ]}
              onPress={() => {
                if (Haptics.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('playlists');
              }}
            >
              <Ionicons
                name="albums-outline"
                size={16}
                color={activeTab === 'playlists' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'playlists' ? colors.textPrimary : colors.textSecondary },
                  activeTab === 'playlists' && { fontWeight: '800' },
                ]}
              >
                Playlists
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'folders' && [
                  styles.activeTabBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#FFFFFF' },
                ],
              ]}
              onPress={() => {
                if (Haptics.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab('folders');
              }}
            >
              <Ionicons
                name="folder-open-outline"
                size={16}
                color={activeTab === 'folders' ? colors.accentCyan : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'folders' ? colors.textPrimary : colors.textSecondary },
                  activeTab === 'folders' && { fontWeight: '800' },
                ]}
              >
                Folders Explorer
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'playlists' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Smart Dynamic Playlists Grid */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                SMART AUTO-MIXES
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.smartGridScroll}
            >
              {/* Favorites Mix */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenSmartPlaylist('smart-favs', 'Favorite Tracks', favorites, 'All your starred tracks')}
                style={[
                  styles.smartCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 51, 92, 0.12)' : 'rgba(255, 46, 85, 0.08)',
                    borderColor: isDark ? 'rgba(255, 51, 92, 0.3)' : 'rgba(255, 46, 85, 0.25)',
                  },
                ]}
              >
                <Ionicons name="heart" size={24} color={colors.primary} />
                <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]}>Favorites</Text>
                <Text style={[styles.smartCardCount, { color: colors.primary }]}>{favorites.length} songs</Text>
              </TouchableOpacity>

              {/* Recently Added Mix */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenSmartPlaylist('smart-recent', 'Recently Added', recentTracks, 'Newest audio imports')}
                style={[
                  styles.smartCard,
                  {
                    backgroundColor: isDark ? 'rgba(0, 242, 254, 0.12)' : 'rgba(0, 180, 216, 0.08)',
                    borderColor: isDark ? 'rgba(0, 242, 254, 0.3)' : 'rgba(0, 180, 216, 0.25)',
                  },
                ]}
              >
                <Ionicons name="time" size={24} color={colors.accentCyan} />
                <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]}>Recently Added</Text>
                <Text style={[styles.smartCardCount, { color: colors.accentCyan }]}>{recentTracks.length} songs</Text>
              </TouchableOpacity>

              {/* Lossless / High-Res Mix */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenSmartPlaylist('smart-lossless', 'Lossless Audio', losslessTracks, 'High fidelity streams')}
                style={[
                  styles.smartCard,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                  },
                ]}
              >
                <Ionicons name="sparkles" size={24} color="#10B981" />
                <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]}>Hi-Res Lossless</Text>
                <Text style={[styles.smartCardCount, { color: '#10B981' }]}>{losslessTracks.length} songs</Text>
              </TouchableOpacity>

              {/* Heavy Rotation Mix */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenSmartPlaylist('smart-rotation', 'Heavy Rotation', mostPlayedTracks, 'Top played offline mixes')}
                style={[
                  styles.smartCard,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)',
                  },
                ]}
              >
                <Ionicons name="flame" size={24} color="#F59E0B" />
                <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]}>Heavy Rotation</Text>
                <Text style={[styles.smartCardCount, { color: '#F59E0B' }]}>{mostPlayedTracks.length} songs</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Custom User Playlists Section */}
            <View style={[styles.sectionHeader, { marginTop: SPACING.md }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                MY PLAYLISTS ({playlists.length})
              </Text>
            </View>

            {playlists.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={36} color={colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Custom Playlists Yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Create your favorite mixes, workout sets, and collections.
                </Text>
              </View>
            ) : (
              playlists.map((pl) => (
                <PlaylistItem
                  key={pl.id}
                  playlist={pl}
                  onPress={() => onSelectPlaylist(pl)}
                  onOptionsPress={() => handlePlaylistOptions(pl)}
                />
              ))
            )}
          </ScrollView>
        ) : (
          /* Folders Explorer Tab */
          <FlatList
            data={folderGroups}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.folderCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF',
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.folderTouchArea}
                  activeOpacity={0.75}
                  onPress={() => handleOpenSmartPlaylist(`folder-${item.name}`, item.name, item.tracks, `Folder collection with ${item.count} songs`)}
                >
                  <View
                    style={[
                      styles.folderIconSquare,
                      {
                        backgroundColor: isDark ? 'rgba(0, 242, 254, 0.15)' : 'rgba(0, 180, 216, 0.12)',
                        borderColor: isDark ? 'rgba(0, 242, 254, 0.3)' : 'rgba(0, 180, 216, 0.25)',
                      },
                    ]}
                  >
                    <Ionicons name="folder" size={22} color={colors.accentCyan} />
                  </View>

                  <View style={styles.folderDetails}>
                    <Text style={[styles.folderName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.folderCount, { color: colors.textSecondary }]}>
                      {item.count} {item.count === 1 ? 'audio file' : 'audio files'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.playFolderBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handlePlayFolder(item.name, item.tracks)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="play" size={16} color="#FFF" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        <CreatePlaylistModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  createBtnWrapper: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  createBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tabCapsuleWrapper: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs + 2,
  },
  tabCapsule: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    padding: 3,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  activeTabBtn: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
    gap: SPACING.sm,
  },
  sectionHeader: {
    paddingVertical: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  smartGridScroll: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  smartCard: {
    width: 140,
    padding: SPACING.md,
    borderRadius: RADIUS.clay,
    borderWidth: 1.2,
    justifyContent: 'space-between',
    gap: 6,
  },
  smartCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  smartCardCount: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  folderCard: {
    borderRadius: RADIUS.clay,
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  folderTouchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  folderIconSquare: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  folderDetails: {
    flex: 1,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  playFolderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
