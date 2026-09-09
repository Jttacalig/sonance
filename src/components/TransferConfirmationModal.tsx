import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';
import { CandidateFile } from '../services/fileImportService';

interface TransferConfirmationModalProps {
  visible: boolean;
  candidates: CandidateFile[];
  skippedCount: number;
  sourceType: 'autoscan' | 'picker';
  isTransferring: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransferConfirmationModal: React.FC<TransferConfirmationModalProps> = ({
  visible,
  candidates,
  skippedCount,
  sourceType,
  isTransferring,
  onConfirm,
  onCancel,
}) => {
  const { colors, isDark } = useTheme();

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isTransferring ? undefined : onCancel}
    >
      <TouchableWithoutFeedback onPress={isTransferring ? undefined : onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(10, 16, 28, 0.88)'
                    : 'rgba(255, 255, 255, 0.96)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(255, 255, 255, 0.9)',
                  shadowColor: isDark ? colors.primary : '#8CA0BA',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                {/* Header Icon */}
                <View style={styles.iconContainer}>
                  <View
                    style={[
                      styles.iconGradient,
                      {
                        backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                        shadowColor: '#000',
                      },
                    ]}
                  >
                    <Ionicons
                      name={sourceType === 'autoscan' ? 'scan' : 'folder-open'}
                      size={30}
                      color={isDark ? '#070A10' : '#FFF'}
                    />
                  </View>
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Transfer to Sonance Folder
                </Text>

                {/* Subtitle */}
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {sourceType === 'autoscan'
                    ? `Found ${candidates.length} new audio track(s). These songs will be transferred and organized into your dedicated Sonance Music Folder for offline playback.`
                    : `${candidates.length} song(s) will be transferred and saved into your dedicated Sonance Music Folder for offline playback.`}
                </Text>

                {/* Target Folder Badge */}
                <View
                  style={[
                    styles.destinationBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.16)'
                        : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <Ionicons name="folder" size={14} color={isDark ? '#FFFFFF' : colors.primary} />
                  <Text style={[styles.destinationText, { color: isDark ? '#FFFFFF' : colors.primary }]}>
                    On My iPhone &gt; Sonance &gt; music
                  </Text>
                </View>

                {/* Candidate Track List */}
                <View
                  style={[
                    styles.trackListContainer,
                    {
                      backgroundColor: isDark
                        ? 'rgba(0, 0, 0, 0.25)'
                        : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                >
                  <ScrollView
                    style={styles.trackListScroll}
                    showsVerticalScrollIndicator={true}
                  >
                    {candidates.map((item, idx) => (
                      <View
                        key={`${item.fileName}_${idx}`}
                        style={[
                          styles.trackRow,
                          idx < candidates.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.05)',
                          },
                        ]}
                      >
                        <Ionicons
                          name="musical-note"
                          size={16}
                          color={isDark ? '#FFFFFF' : colors.primary}
                          style={styles.trackRowIcon}
                        />
                        <View style={styles.trackRowInfo}>
                          <Text
                            style={[styles.trackRowTitle, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={[styles.trackRowArtist, { color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {item.artist}
                          </Text>
                        </View>
                        <View style={styles.trackRowMeta}>
                          <View
                            style={[
                              styles.extBadge,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.06)',
                              },
                            ]}
                          >
                            <Text style={[styles.extBadgeText, { color: colors.textSecondary }]}>
                              {item.ext.toUpperCase()}
                            </Text>
                          </View>
                          {item.fileSize ? (
                            <Text style={[styles.sizeText, { color: colors.textMuted }]}>
                              {formatFileSize(item.fileSize)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Duplicate Notification Note */}
                {skippedCount > 0 && (
                  <View
                    style={[
                      styles.duplicateNotice,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 179, 0, 0.12)'
                          : 'rgba(255, 160, 0, 0.1)',
                        borderColor: isDark
                          ? 'rgba(255, 179, 0, 0.25)'
                          : 'rgba(255, 160, 0, 0.2)',
                      },
                    ]}
                  >
                    <Ionicons name="shield-checkmark-outline" size={15} color="#FFB300" />
                    <Text style={[styles.duplicateNoticeText, { color: '#FFB300' }]}>
                      {skippedCount} duplicate track{skippedCount === 1 ? '' : 's'} already in library will be skipped
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.confirmBtnWrapper}
                  onPress={onConfirm}
                  disabled={isTransferring}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.confirmBtn,
                      {
                        backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                        shadowColor: isDark ? '#FFFFFF' : colors.primary,
                      },
                    ]}
                  >
                    {isTransferring ? (
                      <ActivityIndicator size="small" color={isDark ? '#070A10' : '#FFF'} />
                    ) : (
                      <>
                        <Ionicons name="arrow-down-circle" size={18} color={isDark ? '#070A10' : '#FFF'} />
                        <Text style={[styles.confirmBtnText, { color: isDark ? '#070A10' : '#FFF' }]}>
                          Transfer &amp; Add ({candidates.length})
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  disabled={isTransferring}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.clay + 6,
    borderWidth: 1.6,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  cardBlur: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg + 2,
    paddingBottom: SPACING.md,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: SPACING.sm + 2,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: SPACING.sm + 2,
    paddingHorizontal: SPACING.xs,
  },
  destinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.sm + 4,
  },
  destinationText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trackListContainer: {
    width: '100%',
    maxHeight: 180,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm + 2,
    overflow: 'hidden',
  },
  trackListScroll: {
    width: '100%',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  trackRowIcon: {
    marginRight: 8,
  },
  trackRowInfo: {
    flex: 1,
    marginRight: 8,
  },
  trackRowTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  trackRowArtist: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  trackRowMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  extBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  extBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sizeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  duplicateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm + 2,
  },
  duplicateNoticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  confirmBtnWrapper: {
    width: '100%',
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md - 2,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  cancelBtn: {
    paddingVertical: SPACING.xs + 2,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
