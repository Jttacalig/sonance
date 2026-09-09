import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DownloadItem } from '../types/music';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

import * as Sharing from 'expo-sharing';
import { storageService } from '../services/storageService';

interface DownloadCardProps {
  item: DownloadItem;
  onCancel?: () => void;
  onRemove?: () => void;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({ item, onCancel, onRemove }) => {
  const { colors, isDark } = useTheme();

  const handleExportToFiles = async () => {
    if (!item.trackId) return;
    try {
      const tracks = await storageService.getAllTracks();
      const track = tracks.find(t => t.id === item.trackId);
      if (track && track.uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(track.uri, {
          dialogTitle: `Save ${track.title} to Phone Files`,
          mimeType: 'audio/mpeg',
          UTI: 'public.audio',
        });
      }
    } catch (e) {
      console.warn('Export error:', e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${Math.round(kb)} KB`;
  };

  const getStatusColor = () => {
    switch (item.status) {
      case 'completed':
        return colors.success;
      case 'error':
        return colors.error;
      case 'downloading':
        return colors.primary;
      case 'saving':
      case 'resolving':
        return colors.warning;
      default:
        return colors.textMuted;
    }
  };

  const getStatusLabel = () => {
    switch (item.status) {
      case 'resolving':
        return `Extracting stream (${Math.max(5, Math.round(item.progress * 100))}%)`;
      case 'downloading':
        return `Downloading (${Math.round(item.progress * 100)}%)`;
      case 'saving':
        return 'Saving to offline library...';
      case 'completed':
        return 'Saved to Offline Library';
      case 'error':
        return item.errorMessage || 'Download failed';
      default:
        return 'Queued';
    }
  };

  return (
    <View
      style={[
        styles.outerWrapper,
        {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.85)',
          shadowColor: isDark ? '#000' : '#8CA0BA',
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 85 : 100}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
        style={styles.blurContainer}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.03)', 'transparent']
              : ['rgba(255, 255, 255, 0.8)', 'rgba(240, 246, 255, 0.5)', 'rgba(230, 240, 255, 0.3)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.contentRow}>
          {/* Thumbnail */}
          <View
            style={[
              styles.artWrapper,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
              },
            ]}
          >
            {item.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl }} style={styles.artImage} />
            ) : (
              <LinearGradient
                colors={isDark ? ['#1E293B', '#0F172A'] : ['#E2E8F0', '#CBD5E1']}
                style={styles.placeholderArt}
              >
                <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
              </LinearGradient>
            )}
          </View>

          {/* Info & Progress */}
          <View style={styles.detailsContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.artist}
            </Text>

            {/* Liquid Progress Bar */}
            {(item.status === 'downloading' ||
              item.status === 'resolving' ||
              item.status === 'saving') && (
              <View
                style={[
                  styles.progressBarBackground,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.max(5, item.progress * 100)}%`,
                      backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                    },
                  ]}
                />
              </View>
            )}

            <View style={styles.statusRow}>
              <View style={styles.statusBadgeRow}>
                {item.status === 'completed' && (
                  <Ionicons name="checkmark-circle" size={13} color={colors.success} style={{ marginRight: 3 }} />
                )}
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {getStatusLabel()}
                </Text>
              </View>
              {item.status === 'downloading' && item.bytesDownloaded > 0 && (
                <Text style={[styles.bytesText, { color: colors.textDim }]}>
                  {item.totalBytes > 0
                    ? `${formatBytes(item.bytesDownloaded)} / ${formatBytes(item.totalBytes)}`
                    : `${formatBytes(item.bytesDownloaded)}`}
                </Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            {item.status === 'downloading' || item.status === 'resolving' ? (
              onCancel && (
                <TouchableOpacity style={styles.actionBtn} onPress={onCancel}>
                  <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              )
            ) : item.status === 'completed' ? (
              <View style={styles.completedActions}>
                <TouchableOpacity
                  style={[
                    styles.exportBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                  onPress={handleExportToFiles}
                >
                  <Ionicons name="share-outline" size={18} color={colors.primary} />
                </TouchableOpacity>

                {onRemove && (
                  <TouchableOpacity style={styles.actionBtn} onPress={onRemove}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              onRemove && (
                <TouchableOpacity style={styles.actionBtn} onPress={onRemove}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    borderRadius: RADIUS.clay,
    marginVertical: SPACING.xs + 2,
    borderWidth: 1.4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  blurContainer: {
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  artWrapper: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1.2,
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
  detailsContainer: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  artist: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressBarBackground: {
    height: 5,
    borderRadius: 3,
    marginVertical: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bytesText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    padding: SPACING.xs,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
