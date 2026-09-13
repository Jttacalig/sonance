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
          borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.95)',
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
        intensity={Platform.OS === 'ios' ? 90 : 100}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
        style={styles.blurWrapper}
      >
        {/* Pure Acrylic Liquid Glass Base */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(12, 16, 28, 0.52)' : 'rgba(255, 255, 255, 0.75)' },
          ]}
        />

        {/* Specular Liquid Glass Sheen */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
              : ['rgba(255, 255, 255, 0.95)', 'rgba(245, 248, 255, 0.75)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Edge Specular Reflection Line */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.12)', 'transparent']
              : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.25)', 'transparent']
          }
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 0 }}
          style={styles.topSpecularLine}
        />

        {/* Top Liquid Progress Timeline Bar */}
        <View
          style={[
            styles.progressBarBackground,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)' },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: '#FA243C',
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
                borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
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

          {/* Info with Title, Floating Visualizer, Artist */}
          <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.textPrimary }]} numberOfLines={1}>
                {currentTrack.title}
              </Text>

              {/* Seamless Clean Floating Visualizer */}
              <View style={styles.visualizerRow}>
                <VisualizerBar isPlaying={isPlaying} delay={0} color={isDark ? '#FA243C' : colors.primary} maxHeight={14} />
                <VisualizerBar isPlaying={isPlaying} delay={90} color={isDark ? '#FA243C' : colors.primary} maxHeight={14} />
                <VisualizerBar isPlaying={isPlaying} delay={180} color={isDark ? '#FA243C' : colors.primary} maxHeight={14} />
                <VisualizerBar isPlaying={isPlaying} delay={60} color={isDark ? '#FA243C' : colors.primary} maxHeight={14} />
              </View>
            </View>

            <View style={styles.subtitleRow}>
              <Text style={[styles.artist, { color: isDark ? 'rgba(255, 255, 255, 0.72)' : colors.textSecondary }]} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
              <Text style={[styles.timeDot, { color: isDark ? 'rgba(255, 255, 255, 0.4)' : colors.textMuted }]}>•</Text>
              <Text style={[styles.timelineText, { color: isDark ? 'rgba(255, 255, 255, 0.5)' : colors.textMuted }]}>
                {formatTime(position)} / {formatTime(totalDuration)}
              </Text>
            </View>
          </View>

          {/* Liquid Glass Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.floatingActionBtn}
              onPress={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isLoading ? (
                <Ionicons name="sync-outline" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color={isDark ? '#FFFFFF' : '#0F172A'}
                  style={isPlaying ? {} : { marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingActionBtn}
              onPress={(e) => {
                e.stopPropagation();
                skipToNext();
              }}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="play-forward" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>

            {/* Close / Dismiss 'X' Button */}
            <TouchableOpacity
              style={[
                styles.closeGlassBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Stop and close player"
            >
              <Ionicons name="close" size={15} color={isDark ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary} />
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
    left: 14,
    right: 14,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 14,
  },
  blurWrapper: {
    overflow: 'hidden',
    borderRadius: 18,
  },
  progressBarBackground: {
    height: 2.5,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  artContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
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
    marginLeft: 12,
    marginRight: 8,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  visualizerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 14,
    marginLeft: 6,
    paddingBottom: 1,
  },
  vBar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  artist: {
    maxWidth: '52%',
    fontSize: 12,
    fontWeight: '500',
  },
  timeDot: {
    fontSize: 10,
    marginHorizontal: 1,
  },
  timelineText: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  floatingActionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlassBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 2,
  },
  topSpecularLine: {
    height: 1.2,
    width: '100%',
  },
});
