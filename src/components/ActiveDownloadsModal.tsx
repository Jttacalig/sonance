import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDownloads } from '../context/DownloadContext';
import { useTheme } from '../context/ThemeContext';
import { DownloadCard } from './DownloadCard';
import { SPACING, RADIUS } from '../constants/theme';

export const ActiveDownloadsModal: React.FC = () => {
  const {
    downloads,
    activeCount,
    isDownloadsModalOpen,
    closeDownloadsModal,
    cancelDownload,
    removeDownload,
    clearCompleted,
  } = useDownloads();
  const { colors, isDark } = useTheme();

  const handleClose = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    closeDownloadsModal();
  };

  const completedCount = downloads.filter((d) => d.status === 'completed').length;

  return (
    <Modal
      visible={isDownloadsModalOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Ambient Liquid Glow */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)', 'transparent']
              : ['rgba(255, 255, 255, 0.9)', 'rgba(235, 243, 255, 0.7)', 'transparent']
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.5 }}
          style={styles.ambientGlow}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* iOS Sheet Grabber Bar */}
          <View style={styles.grabberRow}>
            <View
              style={[
                styles.grabberPill,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)' },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.titleWithBadge}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Downloads Manager
                </Text>
                {activeCount > 0 && (
                  <View
                    style={[
                      styles.activeBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.16)'
                          : colors.primary,
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeBadgeText,
                        { color: isDark ? '#FFFFFF' : '#FFFFFF' },
                      ]}
                    >
                      {activeCount} Active
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {activeCount > 0
                  ? `Downloading ${activeCount} ${activeCount === 1 ? 'track' : 'tracks'} to offline library`
                  : `${downloads.length} total ${downloads.length === 1 ? 'item' : 'items'} in queue`}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.12)',
                },
              ]}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Action Tools Bar */}
          {completedCount > 0 && (
            <View style={styles.toolbarRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  if (Haptics.impactAsync) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  clearCompleted();
                }}
                style={[
                  styles.clearBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>
                  Clear Completed ({completedCount})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Downloads List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {downloads.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <Ionicons name="cloud-download-outline" size={40} color={colors.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No Active Downloads
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Search songs or paste YouTube links in "Add Music" to download tracks offline.
                </Text>
              </View>
            ) : (
              downloads.map((item) => (
                <DownloadCard
                  key={item.id}
                  item={item}
                  onCancel={() => cancelDownload(item.id)}
                  onRemove={() => removeDownload(item.id)}
                />
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabberPill: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 6,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
});
