import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Track } from '../types/music';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

interface TrackItemProps {
  track: Track;
  isPlaying?: boolean;
  isCurrent?: boolean;
  onPress: () => void;
  onFavoritePress?: () => void;
  onOptionsPress?: () => void;
}

export const TrackItem: React.FC<TrackItemProps> = ({
  track,
  isPlaying = false,
  isCurrent = false,
  onPress,
  onFavoritePress,
  onOptionsPress,
}) => {
  const { colors, isDark } = useTheme();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <View
      style={[
        styles.outerWrapper,
        {
          borderColor: isCurrent
            ? (isDark ? 'rgba(255, 80, 115, 0.65)' : 'rgba(250, 36, 60, 0.50)')
            : isDark
            ? 'rgba(255, 255, 255, 0.14)'
            : 'rgba(255, 255, 255, 0.85)',
          borderTopColor: isCurrent
            ? (isDark ? 'rgba(255, 150, 175, 0.90)' : 'rgba(255, 100, 130, 0.90)')
            : isDark
            ? 'rgba(255, 255, 255, 0.35)'
            : 'rgba(255, 255, 255, 0.98)',
          shadowColor: isCurrent ? '#FA243C' : isDark ? '#000' : '#8CA0BA',
        },
        isCurrent && styles.activeOuterWrapper,
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 75 : 85}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
        style={styles.blurContainer}
      >
        {/* Specular Glass Sheen */}
        <LinearGradient
          colors={
            isCurrent
              ? isDark
                ? ['rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']
                : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 246, 255, 0.85)', 'rgba(230, 240, 255, 0.6)']
              : isDark
              ? ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.03)', 'transparent']
              : ['rgba(255, 255, 255, 0.92)', 'rgba(240, 246, 255, 0.65)', 'rgba(230, 240, 255, 0.4)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Edge Specular Reflection Line */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.60)', 'rgba(255, 255, 255, 0.15)', 'transparent']
              : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.3)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.itemSpecularLine}
        />

        <TouchableOpacity
          style={styles.innerTouchable}
          onPress={onPress}
          activeOpacity={0.75}
        >
          {/* Liquid Artwork Thumbnail */}
          <View
            style={[
              styles.artContainer,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
              },
            ]}
          >
            {track.artworkUri ? (
              <Image source={{ uri: track.artworkUri }} style={styles.artImage} />
            ) : (
              <LinearGradient
                colors={isDark ? ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.06)'] : ['#E2E8F0', '#CBD5E1']}
                style={styles.placeholderArt}
              >
                <Ionicons name="musical-note" size={20} color={isDark ? '#FFFFFF' : colors.primary} />
              </LinearGradient>
            )}
            {isCurrent && isPlaying && (
              <View
                style={[
                  styles.playingBadge,
                  { backgroundColor: isDark ? '#FFFFFF' : colors.primary },
                ]}
              >
                <Ionicons name="volume-high" size={13} color={isDark ? '#070A10' : '#FFFFFF'} />
              </View>
            )}
          </View>

          {/* Track Info */}
          <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: isCurrent ? (isDark ? '#FA243C' : colors.primary) : (isDark ? '#FFFFFF' : colors.textPrimary) },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {track.title}
              </Text>
              {track.isCloudStream || track.sourceType === 'gdrive' ? (
                <View style={[styles.sourceBadge, { backgroundColor: 'rgba(66, 133, 244, 0.15)', borderColor: 'rgba(66, 133, 244, 0.3)' }]}>
                  <Ionicons name="cloud" size={10} color="#4285F4" style={{ marginRight: 3 }} />
                  <Text style={[styles.sourceBadgeText, { color: '#4285F4' }]}>Cloud</Text>
                </View>
              ) : track.sourceType === 'audius' ? (
                <View style={[styles.sourceBadge, { backgroundColor: 'rgba(250, 36, 60, 0.14)', borderColor: 'rgba(250, 36, 60, 0.3)' }]}>
                  <Ionicons name="globe" size={10} color="#FA243C" style={{ marginRight: 3 }} />
                  <Text style={[styles.sourceBadgeText, { color: '#FA243C' }]}>Online</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.artist, { color: isDark ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary }]} numberOfLines={1}>
                {track.artist}
              </Text>
              <Text style={[styles.dotSeparator, { color: isDark ? 'rgba(255, 255, 255, 0.4)' : colors.textMuted }]}>•</Text>
              <Text style={[styles.duration, { color: isDark ? 'rgba(255, 255, 255, 0.5)' : colors.textMuted }]}>
                {formatDuration(track.duration)}
              </Text>
              {track.fileSize && !track.isCloudStream ? (
                <>
                  <Text style={[styles.dotSeparator, { color: isDark ? 'rgba(255, 255, 255, 0.4)' : colors.textMuted }]}>•</Text>
                  <Text style={[styles.fileSize, { color: isDark ? 'rgba(255, 255, 255, 0.4)' : colors.textDim }]}>
                    {formatFileSize(track.fileSize)}
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Favorite Button */}
          {onFavoritePress && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onFavoritePress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={track.isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={track.isFavorite ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          )}

          {/* Options Button */}
          {onOptionsPress && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onOptionsPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    borderRadius: RADIUS.clay,
    marginVertical: 4,
    borderWidth: 1.4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  activeOuterWrapper: {
    borderWidth: 1.8,
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  blurContainer: {
    overflow: 'hidden',
  },
  innerTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.md + 2,
  },
  artContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1.2,
    position: 'relative',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  playingBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderRadius: 8,
    padding: 2,
  },
  infoContainer: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 0.8,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artist: {
    fontSize: 12.5,
    fontWeight: '500',
    maxWidth: 130,
  },
  dotSeparator: {
    fontSize: 11,
    marginHorizontal: 4,
  },
  duration: {
    fontSize: 12,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 11,
  },
  actionBtn: {
    padding: SPACING.xs + 2,
    marginLeft: 4,
  },
  itemSpecularLine: {
    height: 1,
    width: '100%',
  },
});
