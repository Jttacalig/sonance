import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { PlaylistItem } from '../components/PlaylistItem';
import { CreatePlaylistModal } from '../components/CreatePlaylistModal';
import { LiquidBackground } from '../components/LiquidBackground';
import { Playlist } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

interface PlaylistsScreenProps {
  onSelectPlaylist: (playlist: Playlist) => void;
}

export const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({ onSelectPlaylist }) => {
  const { playlists, createPlaylist, deletePlaylist } = useLibrary();
  const { colors, isDark } = useTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                {playlists.length}
              </Text>
            </View>
          </View>

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
        </View>

        {/* Playlists List */}
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PlaylistItem
              playlist={item}
              onPress={() => onSelectPlaylist(item)}
              onOptionsPress={() => handlePlaylistOptions(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(255, 51, 92, 0.2)', 'rgba(139, 92, 246, 0.1)']
                    : ['rgba(255, 46, 85, 0.14)', 'rgba(0, 180, 216, 0.08)']
                }
                style={styles.emptyIconCircle}
              >
                <Ionicons name="albums-outline" size={40} color={colors.primary} />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Playlists Yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Create your favorite mixes, workout sets, and offline collections.
              </Text>
              <TouchableOpacity
                style={styles.emptyCtaWrapper}
                onPress={() => setShowCreateModal(true)}
              >
                <LinearGradient
                  colors={[colors.primary, '#FF007A', colors.primaryDark]}
                  style={[styles.emptyCtaBtn, { shadowColor: colors.primary }]}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <Text style={styles.emptyCtaText}>Create First Playlist</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />

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
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.xs,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  createBtnWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  createBtn: {
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
  listContent: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: 180,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl * 1.2,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xl,
    fontWeight: '500',
  },
  emptyCtaWrapper: {
    borderRadius: RADIUS.full,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
