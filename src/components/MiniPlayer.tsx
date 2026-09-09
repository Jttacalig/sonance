import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  PanResponder,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
    stopPlayback,
    setFullPlayerVisible,
  } = usePlayer();

  const { colors, isDark } = useTheme();

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const fadeMultiplier = useRef(new Animated.Value(1)).current;

  // Silky GPU-driven Opacity & Scale Interpolations
  const gestureOpacityX = pan.x.interpolate({
    inputRange: [-240, -100, 0, 100, 240],
    outputRange: [0, 0.55, 1, 0.55, 0],
    extrapolate: 'clamp',
  });

  const gestureOpacityY = pan.y.interpolate({
    inputRange: [-15, 0, 45, 85],
    outputRange: [1, 1, 0.45, 0],
    extrapolate: 'clamp',
  });

  const dynamicOpacity = Animated.multiply(
    fadeMultiplier,
    Animated.multiply(gestureOpacityX, gestureOpacityY)
  );

  const dynamicScale = pan.x.interpolate({
    inputRange: [-240, 0, 240],
    outputRange: [0.88, 1, 0.88],
    extrapolate: 'clamp',
  });

  // Soft spring entrance on new song
  useEffect(() => {
    if (currentTrack) {
      pan.setValue({ x: 0, y: 0 });
      fadeMultiplier.setValue(0);
      Animated.parallel([
        Animated.timing(fadeMultiplier, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentTrack?.id]);

  const handleDismiss = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.parallel([
      Animated.timing(pan.y, {
        toValue: 70,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeMultiplier, {
        toValue: 0,
        duration: 190,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      stopPlayback();
      pan.setValue({ x: 0, y: 0 });
      fadeMultiplier.setValue(1);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isDown = gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isHorizontal || isDown;
      },
      onPanResponderGrant: () => {
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({
          x: gestureState.dx,
          y: Math.max(-10, gestureState.dy),
        });
      },
      onPanResponderRelease: (_, gestureState) => {
        const isHorizontalDismiss = Math.abs(gestureState.dx) > 65 || Math.abs(gestureState.vx) > 0.35;
        const isDownDismiss = gestureState.dy > 35 || gestureState.vy > 0.35;

        if (isHorizontalDismiss || isDownDismiss) {
          if (Haptics.impactAsync) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }

          let targetX = 0;
          let targetY = 0;

          if (isHorizontalDismiss) {
            targetX = gestureState.dx > 0 ? 380 : -380;
            targetY = gestureState.dy;
          } else {
            targetX = gestureState.dx;
            targetY = 90;
          }

          Animated.parallel([
            Animated.timing(pan, {
              toValue: { x: targetX, y: targetY },
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(fadeMultiplier, {
              toValue: 0,
              duration: 190,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(() => {
            stopPlayback();
            pan.setValue({ x: 0, y: 0 });
            fadeMultiplier.setValue(1);
          });
        } else {
          // Smooth elastic recovery if not dragged far enough
          Animated.parallel([
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              friction: 8,
              tension: 60,
              useNativeDriver: true,
            }),
            Animated.timing(fadeMultiplier, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (!currentTrack) return null;

  const totalDuration = duration > 0 ? duration : currentTrack.duration || 0;
  const progress = totalDuration > 0 ? Math.min(1, Math.max(0, position / totalDuration)) : 0;

  return (
    <Animated.View
      {...panResponder.panHandlers}
        style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.95)',
          shadowColor: '#000',
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: dynamicScale },
          ],
          opacity: dynamicOpacity,
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 85 : 100}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
        style={styles.blurWrapper}
      >
        {/* Crystal Clear Liquid Glass Sheen */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']
              : ['rgba(255, 255, 255, 0.95)', 'rgba(245, 248, 255, 0.7)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Edge Specular Reflection Line */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.18)', 'transparent']
              : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.25)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topSpecularLine}
        />

        {/* Top Liquid Progress Timeline Bar */}
        <View
          style={[
            styles.progressBarBackground,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)' },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
              },
            ]}
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
                borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
              },
            ]}
          >
            {currentTrack.artworkUri ? (
              <Image source={{ uri: currentTrack.artworkUri }} style={styles.artwork} />
            ) : (
              <LinearGradient
                colors={isDark ? ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.06)'] : ['#E2E8F0', '#CBD5E1']}
                style={styles.placeholderArt}
              >
                <Ionicons name="musical-note" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </LinearGradient>
            )}
          </View>

          {/* Info with Title, Seamless Floating Visualizer, Artist, and Live Timeline */}
          <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {currentTrack.title}
              </Text>

              {/* Seamless Clean Floating Visualizer */}
              <View style={styles.visualizerRow}>
                <VisualizerBar isPlaying={isPlaying} delay={0} color={isDark ? '#FFFFFF' : '#0F172A'} maxHeight={16} />
                <VisualizerBar isPlaying={isPlaying} delay={90} color={isDark ? '#FFFFFF' : '#0F172A'} maxHeight={16} />
                <VisualizerBar isPlaying={isPlaying} delay={180} color={isDark ? '#FFFFFF' : '#0F172A'} maxHeight={16} />
                <VisualizerBar isPlaying={isPlaying} delay={60} color={isDark ? '#FFFFFF' : '#0F172A'} maxHeight={16} />
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

          {/* Liquid Glass Controls with Circular Glass Buttons */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.playBtnWrapper}
              onPress={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                style={[
                  styles.playBtn,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                    shadowColor: '#000',
                  },
                ]}
              >
                {isLoading ? (
                  <Ionicons name="sync-outline" size={18} color={isDark ? '#000000' : '#FFFFFF'} />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={18}
                    color={isDark ? '#000000' : '#FFFFFF'}
                    style={isPlaying ? {} : { marginLeft: 2 }}
                  />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.circularGlassBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                skipToNext();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="play-forward" size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Close / Dismiss 'X' Button */}
            <TouchableOpacity
              style={[
                styles.closeGlassBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
              accessibilityLabel="Stop and close player"
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
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
  circularGlassBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 4,
  },
  closeGlassBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 3,
  },
  topSpecularLine: {
    height: 1.2,
    width: '100%',
  },
});
