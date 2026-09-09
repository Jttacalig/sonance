import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Track } from '../types/music';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

interface TrackOptionsModalProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onTrackDeleted?: () => void;
}

export const TrackOptionsModal: React.FC<TrackOptionsModalProps> = ({
  visible,
  track,
  onClose,
  onTrackDeleted,
}) => {
  const { playlists, toggleFavorite, addTrackToPlaylist, deleteTrack } = useLibrary();
  const { colors, isDark } = useTheme();
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  if (!track) return null;

  const handleToggleFavorite = async () => {
    await toggleFavorite(track.id);
    onClose();
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    await addTrackToPlaylist(playlistId, track.id);
    setShowPlaylistPicker(false);
    onClose();
  };

  const handleShare = async () => {
    try {
      if (track.uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(track.uri, {
          dialogTitle: `Share ${track.title}`,
          mimeType: 'audio/mpeg',
          UTI: 'public.audio',
        });
      }
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${track.title}" from your offline storage? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTrack(track.id);
            onClose();
            if (onTrackDeleted) onTrackDeleted();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF',
              shadowColor: isDark ? '#000' : '#8CA0BA',
            },
          ]}
        >
          {/* Top handle */}
          <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />

          {/* Track Header */}
          <View style={[styles.trackHeader, { borderBottomColor: colors.border }]}>
            <View
              style={[
                styles.artContainer,
                {
                  backgroundColor: colors.surfaceInset,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
                },
              ]}
            >
              {track.artworkUri ? (
                <Image source={{ uri: track.artworkUri }} style={styles.artImage} />
              ) : (
                <View style={styles.placeholderArt}>
                  <Ionicons name="musical-note" size={20} color={colors.primary} />
                </View>
              )}
            </View>
            <View style={styles.trackDetails}>
              <Text style={[styles.trackTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                {track.artist}
              </Text>
            </View>
          </View>

          {showPlaylistPicker ? (
            /* Add to Playlist Sub-View */
            <View style={styles.playlistPickerContainer}>
              <View style={styles.playlistPickerHeader}>
                <TouchableOpacity
                  onPress={() => setShowPlaylistPicker(false)}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                  <Text style={[styles.backText, { color: colors.textPrimary }]}>Back</Text>
                </TouchableOpacity>
                <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>
                  Add to Playlist
                </Text>
              </View>

              <ScrollView style={{ maxHeight: 240 }}>
                {playlists.length === 0 ? (
                  <Text style={[styles.emptyPlaylistsText, { color: colors.textMuted }]}>
                    No playlists yet. Create one in the Playlists tab!
                  </Text>
                ) : (
                  playlists.map((pl) => (
                    <TouchableOpacity
                      key={pl.id}
                      style={[styles.playlistOption, { borderBottomColor: colors.border }]}
                      onPress={() => handleAddToPlaylist(pl.id)}
                    >
                      <Ionicons name="albums-outline" size={20} color={colors.primary} />
                      <Text style={[styles.playlistOptionText, { color: colors.textPrimary }]}>
                        {pl.name}
                      </Text>
                      {pl.trackIds.includes(track.id) && (
                        <Ionicons name="checkmark" size={18} color={colors.success} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          ) : (
            /* Standard Options Menu */
            <View style={styles.optionsList}>
              {/* Favorite */}
              <TouchableOpacity style={styles.optionRow} onPress={handleToggleFavorite}>
                <Ionicons
                  name={track.isFavorite ? 'heart-dislike-outline' : 'heart-outline'}
                  size={22}
                  color={track.isFavorite ? colors.primary : colors.textPrimary}
                />
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                  {track.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </Text>
              </TouchableOpacity>

              {/* Add to Playlist */}
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setShowPlaylistPicker(true)}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.textPrimary} />
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                  Add to a Playlist...
                </Text>
              </TouchableOpacity>

              {/* Share File */}
              <TouchableOpacity style={styles.optionRow} onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                  Share Audio File
                </Text>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={[
                  styles.optionRow,
                  styles.deleteOptionRow,
                  { borderTopColor: colors.border },
                ]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={[styles.optionLabel, styles.deleteLabel, { color: colors.error }]}>
                  Delete from Storage
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
              },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: RADIUS.clay + 4,
    borderTopRightRadius: RADIUS.clay + 4,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    borderWidth: 1.8,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    marginBottom: SPACING.sm,
  },
  artContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  placeholderArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 13,
  },
  optionsList: {
    marginVertical: SPACING.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteOptionRow: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    paddingTop: SPACING.md,
  },
  deleteLabel: {
    fontWeight: '700',
  },
  playlistPickerContainer: {
    paddingVertical: SPACING.sm,
  },
  playlistPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  backText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '600',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyPlaylistsText: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: SPACING.lg,
  },
  playlistOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
  },
  playlistOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    marginTop: SPACING.md,
    borderWidth: 1.2,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
