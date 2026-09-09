import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LiquidBackground: React.FC = () => {
  const { isDark } = useTheme();

  // Progress: 0 = Light Mode, 1 = Dark Mode
  const themeProgress = useSharedValue(isDark ? 1 : 0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      themeProgress.value = isDark ? 1 : 0;
      return;
    }

    // Gentle, eye-comfort 750ms swooping curve (smooth deceleration, no sudden blinding flashes)
    themeProgress.value = withTiming(isDark ? 1 : 0, {
      duration: 750,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [isDark]);

  // Dark layer opacity and gentle liquid depth
  const darkAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(themeProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(themeProgress.value, [0, 1], [-20, 0], Extrapolation.CLAMP);
    const scale = interpolate(themeProgress.value, [0, 1], [1.02, 1.0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Light layer gentle expansion & soft luminescence for eye comfort
  const lightAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(themeProgress.value, [0, 1], [0, 20], Extrapolation.CLAMP);
    const scale = interpolate(themeProgress.value, [0, 1], [1.0, 1.02], Extrapolation.CLAMP);

    return {
      transform: [{ translateY }, { scale }],
    };
  });

  // Swooping Liquid Wave Refraction (creates an organic diagonal glide across the viewport)
  const swoopWaveStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      themeProgress.value,
      [0, 0.5, 1],
      [SCREEN_WIDTH * 0.5, 0, -SCREEN_WIDTH * 0.5],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      themeProgress.value,
      [0, 0.5, 1],
      [-SCREEN_HEIGHT * 0.25, 0, SCREEN_HEIGHT * 0.25],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      themeProgress.value,
      [0, 0.2, 0.5, 0.8, 1],
      [0, 0.45, 0.7, 0.45, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { rotate: '-22deg' },
      ],
    };
  });

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Light Crystal Foundation (Layer 1 - Soft, eye-pleasing tones) */}
      <Animated.View style={[StyleSheet.absoluteFill, lightAnimatedStyle]}>
        <LinearGradient
          colors={['#EEF3F9', '#F8FAFC', '#E2EAF4']}
          style={StyleSheet.absoluteFill}
        />
        {/* Soft Ambient Aurora */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.45)', 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.8, y: 0.7 }}
          style={styles.ambientTopBloom}
        />
        {/* Mid Ice Refraction Orb */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.80)', 'transparent']}
          start={{ x: 0.9, y: 0.2 }}
          end={{ x: 0.1, y: 0.9 }}
          style={styles.ambientMidOrb}
        />
        {/* Bottom Dock Bloom */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.85)', 'transparent']}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.ambientBottomDockBloom}
        />
      </Animated.View>

      {/* Dark Obsidian Foundation (Layer 2 - Deep starry glass) */}
      <Animated.View style={[StyleSheet.absoluteFill, darkAnimatedStyle]}>
        <LinearGradient
          colors={['#050810', '#0A101D', '#070C16']}
          style={StyleSheet.absoluteFill}
        />
        {/* Dark Top Ambient Aurora Bloom */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.12)', 'rgba(180, 210, 255, 0.04)', 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.8, y: 0.7 }}
          style={styles.ambientTopBloom}
        />
        {/* Dark Mid Ice Refraction Orb */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(148, 185, 255, 0.025)', 'transparent']}
          start={{ x: 0.9, y: 0.2 }}
          end={{ x: 0.1, y: 0.9 }}
          style={styles.ambientMidOrb}
        />
        {/* Dark Bottom Dock Bloom */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.10)', 'rgba(180, 210, 255, 0.03)', 'transparent']}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.ambientBottomDockBloom}
        />
      </Animated.View>

      {/* Eye-Comfort Silky Swooping Liquid Wave Refraction */}
      <Animated.View style={[styles.swoopWaveContainer, swoopWaveStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.60)',
            isDark ? 'rgba(180, 215, 255, 0.09)' : 'rgba(235, 245, 255, 0.80)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.swoopWaveGradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  ambientTopBloom: {
    position: 'absolute',
    top: -100,
    left: -60,
    width: SCREEN_WIDTH * 1.35,
    height: SCREEN_HEIGHT * 0.45,
    borderRadius: 999,
  },
  ambientMidOrb: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.32,
    right: -80,
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.38,
    borderRadius: 999,
  },
  ambientBottomDockBloom: {
    position: 'absolute',
    bottom: -60,
    left: -20,
    width: SCREEN_WIDTH * 1.1,
    height: 200,
    borderRadius: 999,
  },
  swoopWaveContainer: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.3,
    left: -SCREEN_WIDTH * 0.3,
    width: SCREEN_WIDTH * 1.6,
    height: SCREEN_HEIGHT * 1.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swoopWaveGradient: {
    width: '100%',
    height: '100%',
  },
});
