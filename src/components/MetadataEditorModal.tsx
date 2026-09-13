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
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { Track } from '../types/music';
import {
  metadataMatcherService,
  MetadataMatchCandidate,
} from '../services/metadataMatcherService';
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
  const { updateTrackMetadata, refreshLibrary } = useLibrary();
  const { colors, isDark } = useTheme();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [artworkUri, setArtworkUri] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // Magic Matcher states
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);
  const [candidates, setCandidates] = useState<MetadataMatchCandidate[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setArtworkUri(track.artworkUri);
      setCandidates([]);
      setHasSearched(false);
    }
  }, [track]);

  if (!track) return null;

  const [isPickingArtwork, setIsPickingArtwork] = useState(false);

  const handlePickArtwork = async () => {
    if (isPickingArtwork) return;
    setIsPickingArtwork(true);
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
    } finally {
      setIsPickingArtwork(false);
    }
  };

  const handleSearchAppleMusic = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    try {
      setIsSearchingMatches(true);
      setHasSearched(true);
      const results = await metadataMatcherService.searchCandidates(
        title || track.title,
        artist || track.artist
      );
      setCandidates(results);
      if (results.length === 0) {
        Alert.alert('No Matches', 'Could not find official Apple Music tags for this search query. Try typing the artist and song title.');
      }
    } catch (e) {
      Alert.alert('Search Error', 'Failed to query official Apple Music database.');
    } finally {
      setIsSearchingMatches(false);
    }
  };

  const handleApplyCandidate = async (candidate: MetadataMatchCandidate) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setTitle(candidate.trackName);
    setArtist(candidate.artistName);
    if (candidate.collectionName) setAlbum(candidate.collectionName);

    if (candidate.highResArtworkUrl || candidate.artworkUrl) {
      setIsSaving(true);
      const downloadedArt = await metadataMatcherService.downloadArtwork(
        candidate.highResArtworkUrl || candidate.artworkUrl,
        track.id
      );
      if (downloadedArt) {
        setArtworkUri(downloadedArt);
      }
      setIsSaving(false);
    }
    setCandidates([]);
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
      await refreshLibrary();

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
              backgroundColor: isDark ? 'rgba(10, 16, 28, 0.88)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
              shadowColor: isDark ? colors.primary : '#8CA0BA',
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 85 : 100}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={styles.cardBlur}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Edit &amp; Enhance Song
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
              {/* Magic Matcher Quick Action Button */}
              <TouchableOpacity
                style={styles.magicMatchBtn}
                onPress={handleSearchAppleMusic}
                activeOpacity={0.8}
                disabled={isSearchingMatches}
              >
                <LinearGradient
                  colors={['#FF2D55', '#FF375F', '#FF6482']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.magicMatchBtnGradient}
                >
                  {isSearchingMatches ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.magicMatchBtnText}>Finding 4K Cover &amp; Tags...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.magicMatchBtnText}>Magic Auto-Match 4K Cover</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Candidates Results List */}
              {candidates.length > 0 && (
                <View style={styles.candidatesSection}>
                  <Text style={[styles.candidatesHeaderTitle, { color: colors.textPrimary }]}>
                    Official Matches from Apple Music:
                  </Text>
                  {candidates.map((c, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.candidateRow,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                      onPress={() => handleApplyCandidate(c)}
                      activeOpacity={0.7}
                    >
                      {c.artworkUrl ? (
                        <Image source={{ uri: c.artworkUrl }} style={styles.candidateThumb} />
                      ) : (
                        <View style={styles.candidateThumbFallback}>
                          <Ionicons name="musical-note" size={18} color={colors.primary} />
                        </View>
                      )}
                      <View style={styles.candidateInfo}>
                        <Text style={[styles.candidateTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {c.trackName}
                        </Text>
                        <Text style={[styles.candidateArtist, { color: colors.textMuted }]} numberOfLines={1}>
                          {c.artistName} {c.collectionName ? `• ${c.collectionName}` : ''}
                        </Text>
                      </View>
                      <View style={styles.applyBadge}>
                        <Text style={styles.applyBadgeText}>Apply</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

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
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.06)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                  >
                    <Ionicons name="camera-outline" size={16} color={isDark ? '#FFFFFF' : colors.primary} />
                    <Text style={[styles.changeArtText, { color: isDark ? '#FFFFFF' : colors.primary }]}>
                      Custom File...
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
                  placeholder="Album (Optional)"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.cancelBtn,
                  {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                  },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={[styles.saveBtn, { opacity: isSaving ? 0.7 : 1 }]}
              >
                <LinearGradient
                  colors={isDark ? ['#38BDF8', '#0284C7'] : ['#007AFF', '#0055D4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtnGradient}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
    padding: SPACING.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 20,
  },
  cardBlur: {
    padding: SPACING.lg,
    maxHeight: 620,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 4,
  },
  formContent: {
    paddingBottom: SPACING.sm,
  },
  magicMatchBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  magicMatchBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
  },
  magicMatchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  candidatesSection: {
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  candidatesHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  candidateThumb: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
  },
  candidateThumbFallback: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  candidateArtist: {
    fontSize: 11,
    marginTop: 2,
  },
  applyBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  applyBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#007AFF',
  },
  artRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  artworkPreview: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  artworkImg: {
    width: '100%',
    height: '100%',
  },
  placeholderArt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artActionCol: {
    flex: 1,
    gap: SPACING.xs,
  },
  changeArtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  changeArtText: {
    fontSize: 13,
    fontWeight: '700',
  },
  removeArtBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  removeArtText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
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
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
