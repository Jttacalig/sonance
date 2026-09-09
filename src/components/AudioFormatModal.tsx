import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';
import { AUDIO_FORMAT_OPTIONS, AudioFormat, AudioFormatOption } from '../constants/endpoints';
import { ExtractedInfo } from '../services/downloaderService';

interface AudioFormatModalProps {
  visible: boolean;
  onClose: () => void;
  trackInfo: ExtractedInfo | null;
  onConfirmDownload: (info: ExtractedInfo, format: AudioFormat) => Promise<void>;
  isDownloading?: boolean;
}

export const AudioFormatModal: React.FC<AudioFormatModalProps> = ({
  visible,
  onClose,
  trackInfo,
  onConfirmDownload,
  isDownloading = false,
}) => {
  const { colors, isDark } = useTheme();

  const [selectedFormat, setSelectedFormat] = useState<AudioFormat>('m4a');
  const [editableTitle, setEditableTitle] = useState('');
  const [editableArtist, setEditableArtist] = useState('');

  useEffect(() => {
    if (trackInfo) {
      setEditableTitle(trackInfo.title || '');
      setEditableArtist(trackInfo.artist || '');
      if (trackInfo.format) {
        setSelectedFormat(trackInfo.format);
      }
    }
  }, [trackInfo, visible]);

  if (!trackInfo) return null;

  const handleDownloadPress = async () => {
    const updatedInfo: ExtractedInfo = {
      ...trackInfo,
      title: editableTitle.trim() || trackInfo.title,
      artist: editableArtist.trim() || trackInfo.artist,
      format: selectedFormat,
    };
    await onConfirmDownload(updatedInfo, selectedFormat);
  };

  const currentOption = AUDIO_FORMAT_OPTIONS.find(f => f.id === selectedFormat) || AUDIO_FORMAT_OPTIONS[0];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[
                styles.modalCard,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.9)',
                  shadowColor: isDark ? '#000' : '#8CA0BA',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                {/* Modal Header */}
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                      Audio Download Options
                    </Text>
                    <View
                      style={[
                        styles.audioOnlyBadge,
                        {
                          backgroundColor: isDark
                            ? 'rgba(0, 230, 118, 0.15)'
                            : 'rgba(0, 200, 83, 0.12)',
                          borderColor: isDark
                            ? 'rgba(0, 230, 118, 0.35)'
                            : 'rgba(0, 200, 83, 0.3)',
                        },
                      ]}
                    >
                      <Ionicons name="musical-notes" size={12} color={colors.accentGreen} />
                      <Text style={[styles.audioOnlyText, { color: colors.accentGreen }]}>
                        Audio Only • No MP4
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={onClose}
                    style={[
                      styles.closeBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Track Meta Header */}
                  <View
                    style={[
                      styles.trackInfoCard,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(255, 255, 255, 0.65)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(200, 212, 228, 0.5)',
                      },
                    ]}
                  >
                    {trackInfo.thumbnailUrl ? (
                      <View style={styles.thumbnailContainer}>
                        <Image
                          source={{ uri: trackInfo.thumbnailUrl }}
                          style={styles.thumbnailImage}
                        />
                        {trackInfo.durationText && (
                          <View style={styles.durationOverlay}>
                            <Text style={styles.durationOverlayText}>{trackInfo.durationText}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.placeholderThumb,
                          {
                            backgroundColor: isDark
                              ? 'rgba(0, 0, 0, 0.3)'
                              : 'rgba(255, 255, 255, 0.7)',
                          },
                        ]}
                      >
                        <Ionicons name="musical-note" size={32} color={colors.primary} />
                      </View>
                    )}

                    <View style={styles.editInputsContainer}>
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Song Title</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: isDark
                              ? 'rgba(0, 0, 0, 0.25)'
                              : 'rgba(255, 255, 255, 0.8)',
                            color: colors.textPrimary,
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(200, 212, 228, 0.5)',
                          },
                        ]}
                        value={editableTitle}
                        onChangeText={setEditableTitle}
                        placeholder="Song Title"
                        placeholderTextColor={colors.textMuted}
                      />

                      <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 6 }]}>Artist</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: isDark
                              ? 'rgba(0, 0, 0, 0.25)'
                              : 'rgba(255, 255, 255, 0.8)',
                            color: colors.textPrimary,
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(200, 212, 228, 0.5)',
                          },
                        ]}
                        value={editableArtist}
                        onChangeText={setEditableArtist}
                        placeholder="Artist Name"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  {/* Format Selection List */}
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    SELECT AUDIO FORMAT & QUALITY
                  </Text>

                  <View style={styles.formatList}>
                    {AUDIO_FORMAT_OPTIONS.map((option: AudioFormatOption) => {
                      const isSelected = selectedFormat === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          activeOpacity={0.75}
                          onPress={() => setSelectedFormat(option.id)}
                          style={[
                            styles.formatCard,
                            {
                              backgroundColor: isDark
                                ? isSelected
                                  ? 'rgba(255, 51, 92, 0.15)'
                                  : 'rgba(255, 255, 255, 0.04)'
                                : isSelected
                                ? 'rgba(255, 46, 85, 0.1)'
                                : 'rgba(255, 255, 255, 0.65)',
                              borderColor: isSelected
                                ? colors.primary
                                : isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(200, 212, 228, 0.4)',
                            },
                          ]}
                        >
                          <View style={styles.formatCardTop}>
                            <View style={styles.formatNameRow}>
                              <Text
                                style={[
                                  styles.formatTitle,
                                  {
                                    color: isSelected ? colors.primary : colors.textPrimary,
                                  },
                                ]}
                              >
                                {option.label}
                              </Text>

                              {option.recommended && (
                                <View
                                  style={[
                                    styles.recommendedBadge,
                                    { backgroundColor: colors.primary },
                                  ]}
                                >
                                  <Text style={styles.recommendedText}>RECOMMENDED</Text>
                                </View>
                              )}

                              <View
                                style={[
                                  styles.tagBadge,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(0, 0, 0, 0.06)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.tagText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {option.tag}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.formatBitrateWrapper}>
                              <Text
                                style={[
                                  styles.bitrateText,
                                  { color: isSelected ? colors.primary : colors.textMuted },
                                ]}
                              >
                                {option.bitrate}
                              </Text>
                              <View
                                style={[
                                  styles.radioCircle,
                                  {
                                    borderColor: isSelected ? colors.primary : colors.textMuted,
                                    backgroundColor: isSelected ? colors.primary : 'transparent',
                                  },
                                ]}
                              >
                                {isSelected && (
                                  <Ionicons name="checkmark" size={12} color="#FFF" />
                                )}
                              </View>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.formatDesc,
                              { color: colors.textMuted },
                            ]}
                          >
                            {option.description}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Bottom Action Dock */}
                <View style={styles.bottomDock}>
                  <TouchableOpacity
                    style={styles.downloadBtnWrapper}
                    onPress={handleDownloadPress}
                    disabled={isDownloading}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.downloadBtn,
                        {
                          backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                          shadowColor: isDark ? '#FFFFFF' : colors.primary,
                        },
                      ]}
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={isDark ? '#070A10' : '#FFF'} />
                      ) : (
                        <>
                          <Ionicons name="cloud-download" size={20} color={isDark ? '#070A10' : '#FFF'} />
                          <Text style={[styles.downloadBtnText, { color: isDark ? '#070A10' : '#FFF' }]}>
                            Download {currentOption.label} ({currentOption.bitrate})
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: RADIUS.clay + 4,
    borderTopRightRadius: RADIUS.clay + 4,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    maxHeight: '88%',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  cardBlur: {
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : SPACING.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  audioOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  audioOnlyText: {
    fontSize: 10,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  trackInfoCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  thumbnailContainer: {
    position: 'relative',
    width: 84,
    height: 84,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  durationOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationOverlayText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  placeholderThumb: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInputsContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  textInput: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1.2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: 4,
  },
  formatList: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  formatCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  formatCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  formatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formatTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  recommendedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.4,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  formatBitrateWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bitrateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  bottomDock: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  downloadBtnWrapper: {
    borderRadius: RADIUS.full,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
