import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDownloads } from '../context/DownloadContext';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING } from '../constants/theme';

export const GlobalDownloadIndicator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { activeCount, activeDownload, openDownloadsModal } = useDownloads();
  const { colors, isDark } = useTheme();

  if (activeCount === 0 || !activeDownload) {
    return null;
  }

  const handlePress = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    openDownloadsModal();
  };

  const currentProgressPct = Math.max(5, Math.round(activeDownload.progress * 100));

  return (
    <View
      style={[
        styles.container,
        {
          top: Math.max(insets.top + 6, Platform.OS === 'ios' ? 48 : 28),
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        style={[
          styles.pillCard,
          {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.95)',
            shadowColor: isDark ? '#000000' : '#8CA0BA',
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 90 : 100}
          tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
          style={styles.pillBlur}
        >
          {/* Specular Top Rim Reflection Line */}
          <View
            style={[
              styles.specularRim,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.35)'
                  : 'rgba(255, 255, 255, 0.95)',
              },
            ]}
          />

          <View style={styles.pillContent}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.16)'
                    : colors.primary,
                },
              ]}
            >
              <Ionicons
                name="arrow-down"
                size={13}
                color={isDark ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            {/* Song title & active count */}
            <View style={styles.textColumn}>
              <View style={styles.titleRow}>
                <Text style={[styles.downloadLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                  {activeDownload.title || 'Downloading Track'}
                </Text>
                <Text style={[styles.percentBadge, { color: colors.primary }]}>
                  {currentProgressPct}%
                </Text>
              </View>
              <Text style={[styles.statusSubtext, { color: colors.textSecondary }]} numberOfLines={1}>
                {activeCount > 1
                  ? `${activeCount} tracks downloading • Tap to view`
                  : activeDownload.status === 'resolving'
                  ? 'Extracting stream audio...'
                  : activeDownload.status === 'saving'
                  ? 'Saving to library...'
                  : 'Downloading high-res audio...'}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>

          {/* Bottom Slim Progress Line */}
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.06)',
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${currentProgressPct}%`,
                  backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                },
              ]}
            />
          </View>
        </BlurView>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    alignItems: 'center',
  },
  pillCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  pillBlur: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    position: 'relative',
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  downloadLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    flex: 1,
  },
  percentBadge: {
    fontSize: 12,
    fontWeight: '900',
  },
  statusSubtext: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});
