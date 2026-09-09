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
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.textPrimary }]}>
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
              <View
                style={[
                  styles.createBtn,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                    shadowColor: isDark ? '#FFFFFF' : colors.primary,
                  },
                ]}
              >
                <Ionicons name="add" size={22} color={isDark ? '#070A10' : '#FFF'} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Segmented Tab Pill Selector */}
        <View style={styles.tabCapsuleWrapper}>
          <View
            style={[
              styles.tabCapsule,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : '#FFFFFF',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'playlists' && [
                  styles.activeTabBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF' },
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
                color={activeTab === 'playlists' ? (isDark ? '#FFFFFF' : colors.primary) : colors.textMuted}
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
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF' },
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
                color={activeTab === 'folders' ? (isDark ? '#FFFFFF' : colors.primary) : colors.textMuted}
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

            <View style={styles.smartShelfContainer}>
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
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.95)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)',
                    },
                  ]}
                >
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 85 : 100}
                    tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                        : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 246, 255, 0.65)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.smartIconBadge,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  >
                    <Ionicons name="heart" size={20} color={isDark ? '#FFFFFF' : colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      Favorites
                    </Text>
                    <Text style={[styles.smartCardCount, { color: colors.textSecondary }]} numberOfLines={1}>
                      {favorites.length} {favorites.length === 1 ? 'song' : 'songs'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Recently Added Mix */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenSmartPlaylist('smart-recent', 'Recently Added', recentTracks, 'Newest audio imports')}
                  style={[
                    styles.smartCard,
                    {
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.95)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)',
                    },
                  ]}
                >
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 85 : 100}
                    tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                        : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 246, 255, 0.65)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.smartIconBadge,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  >
                    <Ionicons name="time" size={20} color={isDark ? '#FFFFFF' : colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      Recently Added
                    </Text>
                    <Text style={[styles.smartCardCount, { color: colors.textSecondary }]} numberOfLines={1}>
                      {recentTracks.length} {recentTracks.length === 1 ? 'song' : 'songs'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Lossless / High-Res Mix */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenSmartPlaylist('smart-lossless', 'Lossless Audio', losslessTracks, 'High fidelity streams')}
                  style={[
                    styles.smartCard,
                    {
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.95)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)',
                    },
                  ]}
                >
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 85 : 100}
                    tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                        : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 246, 255, 0.65)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.smartIconBadge,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  >
                    <Ionicons name="sparkles" size={20} color={isDark ? '#FFFFFF' : colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      Hi-Res Lossless
                    </Text>
                    <Text style={[styles.smartCardCount, { color: colors.textSecondary }]} numberOfLines={1}>
                      {losslessTracks.length} {losslessTracks.length === 1 ? 'song' : 'songs'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Heavy Rotation Mix */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenSmartPlaylist('smart-rotation', 'Heavy Rotation', mostPlayedTracks, 'Top played offline mixes')}
                  style={[
                    styles.smartCard,
                    {
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.95)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)',
                    },
                  ]}
                >
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 85 : 100}
                    tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                        : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 246, 255, 0.65)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.smartIconBadge,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  >
                    <Ionicons name="flame" size={20} color={isDark ? '#FFFFFF' : colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.smartCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      Heavy Rotation
                    </Text>
                    <Text style={[styles.smartCardCount, { color: colors.textSecondary }]} numberOfLines={1}>
                      {mostPlayedTracks.length} {mostPlayedTracks.length === 1 ? 'song' : 'songs'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>

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
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                  >
                    <Ionicons name="folder" size={22} color={isDark ? '#FFFFFF' : colors.primary} />
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
                    style={[
                      styles.playFolderBtn,
                      {
                        backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                        shadowColor: isDark ? '#FFFFFF' : colors.primary,
                      },
                    ]}
                    onPress={() => handlePlayFolder(item.name, item.tracks)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="play" size={16} color={isDark ? '#070A10' : '#FFF'} style={{ marginLeft: 2 }} />
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
  smartShelfContainer: {
    marginHorizontal: -SPACING.lg,
  },
  smartGridScroll: {
    paddingHorizontal: SPACING.lg,
    gap: 12,
    paddingVertical: SPACING.xs,
  },
  smartCard: {
    width: 154,
    minHeight: 126,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden', // CRITICAL FIX: prevents absolute BlurView and gradients from bleeding outside rounded corners
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  smartIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  smartCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  smartCardCount: {
    fontSize: 12,
    fontWeight: '600',
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
