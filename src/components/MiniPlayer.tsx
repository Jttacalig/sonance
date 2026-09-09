import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

interface MiniPlayerProps {
  bottomOffset?: number;
}

function formatTime(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '0:00';
  const totalSeconds = Math.floor(secs);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

const VisualizerBar: React.FC<{ isPlaying: boolean; delay: number; color: string; maxHeight: number }> = ({
  isPlaying,
  delay,
  color,
  maxHeight,
}) => {
  const anim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    let loopAnim: Animated.CompositeAnimation | null = null;
    if (isPlaying) {
      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 280 + delay * 1.4,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.2,
            duration: 240 + delay * 1.1,
            useNativeDriver: true,
          }),
        ])
      );
      const timer = setTimeout(() => {
        loopAnim?.start();
      }, delay);
      return () => {
        clearTimeout(timer);
        loopAnim?.stop();
      };
    } else {
      Animated.timing(anim, {
        toValue: 0.2,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isPlaying, delay]);

  return (
    <Animated.View
      style={[
        styles.vBar,
        {
          height: maxHeight,
          backgroundColor: color,
          transform: [{ scaleY: anim }],
        },
      ]}
    />
  );
};

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ bottomOffset = 0 }) => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    position,
    duration,
    togglePlayPause,
    skipToNext,
    setFullPlayerVisible,
  } = usePlayer();

  const { colors, isDark } = useTheme();

  if (!currentTrack) return null;

  const totalDuration = duration > 0 ? duration : currentTrack.duration || 0;
  const progress = totalDuration > 0 ? Math.min(1, Math.max(0, position / totalDuration)) : 0;

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.85)',
          shadowColor: isDark ? colors.primary : '#8CA0BA',
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 85 : 100}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurWrapper}
      >
        {/* Subtle Liquid Gradient Sheen */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 51, 92, 0.12)', 'rgba(139, 92, 246, 0.08)', 'rgba(20, 28, 43, 0.4)']
              : ['rgba(255, 255, 255, 0.7)', 'rgba(240, 246, 255, 0.5)', 'rgba(230, 240, 255, 0.3)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Liquid Progress Timeline Bar */}
        <View
          style={[
            styles.progressBarBackground,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, '#FF007A', '#9D4EDD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
          />
        </View>

        <TouchableOpacity
          style={styles.container}
          onPress={() => setFullPlayerVisible(true)}
          activeOpacity={0.9}
        >
          {/* Liquid Glass Artwork Thumbnail */}
          <View
            style={[
              styles.artContainer,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#FFFFFF',
              },
            ]}
          >
            {currentTrack.artworkUri ? (
              <Image source={{ uri: currentTrack.artworkUri }} style={styles.artwork} />
            ) : (
              <LinearGradient
                colors={isDark ? ['#1E293B', '#0F172A'] : ['#E2E8F0', '#CBD5E1']}
                style={styles.placeholderArt}
              >
                <Ionicons name="musical-note" size={18} color={colors.primary} />
              </LinearGradient>
            )}
          </View>

          {/* Info with Title, Seamless Floating Visualizer, Artist, and Live Timeline */}
          <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {currentTrack.title}
              </Text>

              {/* Seamless Clean Floating Visualizer (No Pill Box) */}
              <View style={styles.visualizerRow}>
                <VisualizerBar isPlaying={isPlaying} delay={0} color={colors.primary} maxHeight={16} />
                <VisualizerBar isPlaying={isPlaying} delay={90} color={colors.primary} maxHeight={16} />
                <VisualizerBar isPlaying={isPlaying} delay={180} color={colors.primary} maxHeight={16} />
                <VisualizerBar isPlaying={isPlaying} delay={60} color={colors.primary} maxHeight={16} />
              </View>
            </View>

            <View style={styles.subtitleRow}>
              <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
              <Text style={[styles.timeDot, { color: colors.textMuted }]}>•</Text>
              <Text style={[styles.timelineText, { color: colors.textMuted }]}>
                {formatTime(position)} / {formatTime(totalDuration)}
              </Text>
            </View>
          </View>

          {/* Liquid Glass Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.playBtnWrapper}
              onPress={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LinearGradient
                colors={[colors.primary, '#FF007A', colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.playBtn,
                  {
                    shadowColor: colors.primary,
                  },
                ]}
              >
                {isLoading ? (
                  <Ionicons name="sync-outline" size={18} color="#FFF" />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={18}
                    color="#FFF"
                    style={isPlaying ? {} : { marginLeft: 2 }}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={(e) => {
                e.stopPropagation();
                skipToNext();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="play-forward" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    borderRadius: RADIUS.clay,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  blurWrapper: {
    overflow: 'hidden',
  },
  progressBarBackground: {
    height: 4,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
  },
  artContainer: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  placeholderArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 3,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  visualizerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 16,
    marginLeft: 6,
    paddingBottom: 1,
  },
  vBar: {
    width: 2.8,
    borderRadius: 1.5,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  artist: {
    maxWidth: '50%',
    fontSize: 12,
    fontWeight: '600',
  },
  timeDot: {
    fontSize: 10,
    marginHorizontal: 1,
  },
  timelineText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  playBtnWrapper: {
    borderRadius: 18,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  controlBtn: {
    padding: SPACING.xs,
    marginLeft: 2,
  },
});
