import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { Track } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

interface MetadataEditorModalProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onSaved?: (updatedTrack: Track) => void;
}

export const MetadataEditorModal: React.FC<MetadataEditorModalProps> = ({
  visible,
  track,
  onClose,
  onSaved,
}) => {
  const { updateTrackMetadata } = useLibrary();
  const { colors, isDark } = useTheme();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [artworkUri, setArtworkUri] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setArtworkUri(track.artworkUri);
    }
  }, [track]);

  if (!track) return null;

  const handlePickArtwork = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setArtworkUri(result.assets[0].uri);
        if (Haptics.impactAsync) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Artwork picker error:', e);
      Alert.alert('Error', 'Failed to select image from files.');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Track title cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      const updates: Partial<Track> = {
        title: title.trim(),
        artist: artist.trim() || 'Unknown Artist',
        album: album.trim() || undefined,
        artworkUri,
      };

      await updateTrackMetadata(track.id, updates);
      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      const updatedTrack: Track = { ...track, ...updates };
      if (onSaved) onSaved(updatedTrack);
      onClose();
    } catch (error: any) {
      Alert.alert('Save Error', error?.message || 'Could not save track metadata.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View
          style={[
            styles.cardWrapper,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#FFFFFF',
              shadowColor: isDark ? colors.primary : '#8CA0BA',
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 75 : 100}
            tint={isDark ? 'dark' : 'light'}
            style={styles.cardBlur}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="create-outline" size={22} color={colors.primary} />
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Edit Song Info
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
              {/* Artwork Picker Row */}
              <View style={styles.artRow}>
                <View
                  style={[
                    styles.artworkPreview,
                    { borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#E2E8F0' },
                  ]}
                >
                  {artworkUri ? (
                    <Image source={{ uri: artworkUri }} style={styles.artworkImg} />
                  ) : (
                    <LinearGradient
                      colors={isDark ? ['#1E293B', '#0F172A'] : ['#E2E8F0', '#CBD5E1']}
                      style={styles.placeholderArt}
                    >
                      <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                    </LinearGradient>
                  )}
                </View>

                <View style={styles.artActionCol}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePickArtwork}
                    style={[
                      styles.changeArtBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(0, 242, 254, 0.14)'
                          : 'rgba(0, 180, 216, 0.12)',
                        borderColor: isDark ? 'rgba(0, 242, 254, 0.35)' : 'rgba(0, 180, 216, 0.3)',
                      },
                    ]}
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.accentCyan} />
                    <Text style={[styles.changeArtText, { color: colors.accentCyan }]}>
                      Change Cover
                    </Text>
                  </TouchableOpacity>

                  {artworkUri && (
                    <TouchableOpacity
                      onPress={() => setArtworkUri(undefined)}
                      style={styles.removeArtBtn}
                    >
                      <Text style={[styles.removeArtText, { color: colors.textMuted }]}>
                        Remove Cover
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Title Field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TITLE</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(240, 245, 255, 0.7)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(200, 215, 235, 0.6)',
                    },
                  ]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Song Title"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Artist Field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ARTIST</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(240, 245, 255, 0.7)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(200, 215, 235, 0.6)',
                    },
                  ]}
                  value={artist}
                  onChangeText={setArtist}
                  placeholder="Artist Name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Album Field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ALBUM</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(240, 245, 255, 0.7)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(200, 215, 235, 0.6)',
                    },
                  ]}
                  value={album}
                  onChangeText={setAlbum}
                  placeholder="Album or Collection Name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    },
                  ]}
                  onPress={onClose}
                  disabled={isSaving}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtnWrapper}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary, '#FF007A', colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtn}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.saveBtnText}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.clay,
    borderWidth: 1.4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  cardBlur: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 2,
  },
  formContent: {
    gap: SPACING.md,
  },
  artRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: 4,
  },
  artworkPreview: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1.2,
  },
  artworkImg: {
    width: '100%',
    height: '100%',
  },
  placeholderArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artActionCol: {
    flex: 1,
    gap: 8,
  },
  changeArtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  changeArtText: {
    fontSize: 13,
    fontWeight: '700',
  },
  removeArtBtn: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  removeArtText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtnWrapper: {
    flex: 1.5,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  saveBtn: {
    height: 46,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
