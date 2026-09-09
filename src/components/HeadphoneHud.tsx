import React, { useEffect, useRef } from 'react';
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAudioRoute, AudioDeviceType } from '../context/AudioRouteContext';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING } from '../constants/theme';

function getDeviceIcon(type: AudioDeviceType): { name: any; color: string } {
  switch (type) {
    case 'airpods':
      return { name: 'headset', color: '#00F2FE' };
    case 'headphones':
      return { name: 'headset', color: '#FF335C' };
    case 'bluetooth':
      return { name: 'bluetooth', color: '#38BDF8' };
    case 'wired':
      return { name: 'git-commit-outline', color: '#10B981' };
    case 'speaker':
    default:
      return { name: 'volume-high', color: '#F59E0B' };
  }
}

export const HeadphoneHud: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { activeHudDevice, isHudVisible, hideHud } = useAudioRoute();
  const { colors, isDark } = useTheme();

  const translateY = useSharedValue<number>(-120);
  const opacity = useSharedValue<number>(0);
  const scale = useSharedValue<number>(0.88);
  const timerRef = useRef<any>(null);

  const dismissHud = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    translateY.value = withTiming(-120, { duration: 250, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(hideHud)();
    });
    opacity.value = withTiming(0, { duration: 200 });
    scale.value = withTiming(0.9, { duration: 220 });
  };

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isHudVisible && activeHudDevice) {
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 180,
        mass: 0.6,
      });
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, {
        damping: 14,
        stiffness: 220,
      });

      // Auto-hide after 3.8s
      timerRef.current = setTimeout(() => {
        dismissHud();
      }, 3800);
    } else {
      translateY.value = -120;
      opacity.value = 0;
      scale.value = 0.88;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHudVisible, activeHudDevice]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  if (!activeHudDevice) return null;

  const iconInfo = getDeviceIcon(activeHudDevice.type);
  const topPosition = Math.max(insets.top + 6, Platform.OS === 'ios' ? 44 : 16);

  return (
    <Animated.View
      pointerEvents={isHudVisible ? 'auto' : 'none'}
      style={[
        styles.container,
        { top: topPosition },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={dismissHud}
        style={[
          styles.capsuleWrapper,
          {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.95)',
            shadowColor: isDark ? '#000' : '#8CA0BA',
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 85 : 100}
          tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
          style={styles.blurCapsule}
        >
          {/* Specular Liquid Glass Gradient */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.04)', 'transparent']
                : ['rgba(255, 255, 255, 0.95)', 'rgba(235, 245, 255, 0.75)', 'rgba(215, 235, 255, 0.5)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Top Specular Rim Light Reflection */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.08)', 'transparent']
                : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.3)', 'transparent']
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0 }}
            style={styles.hudTopRim}
          />

          <View style={styles.contentRow}>
            {/* Icon Bubble */}
            <View
              style={[
                styles.iconBubble,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            >
              <Ionicons name={iconInfo.name} size={20} color={isDark ? '#FFFFFF' : iconInfo.color} />
            </View>

            {/* Device Info */}
            <View style={styles.textColumn}>
              <View style={styles.titleRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.deviceName, { color: colors.textPrimary }]}
                >
                  {activeHudDevice.name}
                </Text>
                <View style={[styles.connectedDot, { backgroundColor: '#10B981' }]} />
              </View>

              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.qualityChip,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <Ionicons name="sparkles" size={10} color={isDark ? '#FFFFFF' : colors.primary} style={{ marginRight: 3 }} />
                  <Text style={[styles.qualityText, { color: isDark ? '#FFFFFF' : colors.primary }]}>
                    {activeHudDevice.quality}
                  </Text>
                </View>

                {activeHudDevice.isSpatialAudioAvailable && (
                  <View
                    style={[
                      styles.qualityChip,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                        marginLeft: 6,
                      },
                    ]}
                  >
                    <Ionicons name="globe-outline" size={10} color={isDark ? '#FFFFFF' : colors.primary} style={{ marginRight: 3 }} />
                    <Text style={[styles.qualityText, { color: isDark ? '#FFFFFF' : colors.primary }]}>
                      Spatial
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Subtle dismiss chevron */}
            <Ionicons
              name="chevron-up"
              size={16}
              color={colors.textMuted}
              style={styles.chevron}
            />
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 9999,
    alignItems: 'center',
  },
  capsuleWrapper: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 14,
  },
  blurCapsule: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 11,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginRight: 6,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  qualityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chevron: {
    marginLeft: 8,
    opacity: 0.6,
  },
  hudTopRim: {
    height: 1.5,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
});
