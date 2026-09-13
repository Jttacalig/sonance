import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
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

  // Continuous Fluid Liquid Waves & Refraction Orbs
  const fluidBreath = useSharedValue(0);
  const orbFloatX = useSharedValue(0);
  const orbFloatY = useSharedValue(0);
  const orbFloat2X = useSharedValue(0);
  const orbFloat2Y = useSharedValue(0);
  const waterSheen = useSharedValue(0);

  useEffect(() => {
    // 1. Continuous Organic Fluid Wave Breathing (8.5s slow celestial loop)
    fluidBreath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 8500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // 2. Primary Liquid Refraction Orb Floating Drift (12s slow harmonic float)
    orbFloatX.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 13000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 10000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    orbFloatY.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 13500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 11500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 12000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // 3. Secondary Counter-Drift Orb (15s celestial counter-rotation)
    orbFloat2X.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 14000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 12000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    orbFloat2Y.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 12500, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 15500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 13000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // 4. Watery Surface Caustics / Specular Shimmer
    waterSheen.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      themeProgress.value = isDark ? 1 : 0;
      return;
    }

    // Gentle 750ms deceleration curve for theme change
    themeProgress.value = withTiming(isDark ? 1 : 0, {
      duration: 750,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [isDark]);

  // Dark layer depth
  const darkAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(themeProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(themeProgress.value, [0, 1], [1.02, 1.0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // Light layer depth
  const lightAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(themeProgress.value, [0, 1], [1.0, 1.02], Extrapolation.CLAMP);

    return {
      transform: [{ scale }],
    };
  });

  // Top Liquid Aurora Motion
  const topAuroraStyle = useAnimatedStyle(() => {
    const translateY = interpolate(fluidBreath.value, [0, 1], [-20, 25]);
    const scaleX = interpolate(fluidBreath.value, [0, 1], [1.0, 1.18]);
    const scaleY = interpolate(fluidBreath.value, [0, 1], [1.0, 1.10]);

    return {
      transform: [{ translateY }, { scaleX }, { scaleY }],
    };
  });

  // Primary Floating Watery Refraction Orb
  const floatingOrbStyle = useAnimatedStyle(() => {
    const translateX = interpolate(orbFloatX.value, [-1, 0, 1], [-55, 0, 55]);
    const translateY = interpolate(orbFloatY.value, [-1, 0, 1], [-45, 0, 45]);
    const scale = interpolate(fluidBreath.value, [0, 1], [0.95, 1.15]);

    return {
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  // Secondary Floating Amethyst/Coral Orb
  const floatingOrb2Style = useAnimatedStyle(() => {
    const translateX = interpolate(orbFloat2X.value, [-1, 0, 1], [50, 0, -50]);
    const translateY = interpolate(orbFloat2Y.value, [-1, 0, 1], [-35, 0, 35]);
    const scale = interpolate(fluidBreath.value, [0, 1], [1.12, 0.96]);

    return {
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  // Watery Caustic Shimmer Wave
  const waterySheenStyle = useAnimatedStyle(() => {
    const opacity = interpolate(waterSheen.value, [0, 0.5, 1], [0.35, 0.75, 0.35]);
    const translateY = interpolate(waterSheen.value, [0, 1], [-35, 35]);

    return {
      opacity,
      transform: [{ translateY }, { rotate: '-16deg' }],
    };
  });

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Light Crystal Foundation (Layer 1) */}
      <Animated.View style={[StyleSheet.absoluteFill, lightAnimatedStyle]}>
        <LinearGradient
          colors={['#EDF3FA', '#F8FAFC', '#E3ECF6']}
          style={StyleSheet.absoluteFill}
        />
        {/* Soft Ambient Aurora */}
        <Animated.View style={[styles.ambientTopBloom, topAuroraStyle]}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.95)', 'rgba(235, 245, 255, 0.55)', 'transparent']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.8, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {/* Mid Water Refraction Orb */}
        <Animated.View style={[styles.ambientMidOrb, floatingOrbStyle]}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.85)', 'rgba(225, 240, 255, 0.35)', 'transparent']}
            start={{ x: 0.9, y: 0.2 }}
            end={{ x: 0.1, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {/* Bottom Dock Bloom */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.90)', 'transparent']}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.ambientBottomDockBloom}
        />
      </Animated.View>

      {/* Dark Obsidian Foundation (Layer 2 - Deep ethereal liquid glass canvas) */}
      <Animated.View style={[StyleSheet.absoluteFill, darkAnimatedStyle]}>
        <LinearGradient
          colors={['#060814', '#0A1028', '#070C1E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Liquid Ruby / Coral Aurora with Organic Breathing */}
        <Animated.View style={[styles.ambientTopBloom, topAuroraStyle]}>
          <LinearGradient
            colors={['rgba(255, 45, 85, 0.20)', 'rgba(138, 43, 226, 0.14)', 'transparent']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.85, y: 0.75 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Mid Right Electric Sapphire Orb */}
        <Animated.View style={[styles.ambientMidOrb, floatingOrbStyle]}>
          <LinearGradient
            colors={['rgba(0, 150, 255, 0.22)', 'rgba(0, 225, 255, 0.10)', 'transparent']}
            start={{ x: 0.85, y: 0.15 }}
            end={{ x: 0.15, y: 0.85 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Mid Left Violet / Magenta Nebula */}
        <Animated.View style={[styles.ambientLeftOrb, floatingOrb2Style]}>
          <LinearGradient
            colors={['rgba(168, 85, 247, 0.18)', 'rgba(255, 45, 85, 0.10)', 'transparent']}
            start={{ x: 0.1, y: 0.2 }}
            end={{ x: 0.9, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Bottom Ambient Dock Bloom */}
        <LinearGradient
          colors={['rgba(0, 160, 255, 0.14)', 'rgba(255, 45, 85, 0.08)', 'transparent']}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.ambientBottomDockBloom}
        />
      </Animated.View>

      {/* Watery Surface Specular Caustic Shimmer Wave */}
      <Animated.View style={[styles.swoopWaveContainer, waterySheenStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.55)',
            isDark ? 'rgba(180, 225, 255, 0.08)' : 'rgba(235, 245, 255, 0.75)',
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
    width: SCREEN_WIDTH * 1.4,
    height: SCREEN_HEIGHT * 0.48,
    borderRadius: 999,
  },
  ambientMidOrb: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.24,
    right: -90,
    width: SCREEN_WIDTH * 1.15,
    height: SCREEN_HEIGHT * 0.44,
    borderRadius: 999,
  },
  ambientLeftOrb: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.42,
    left: -100,
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_HEIGHT * 0.40,
    borderRadius: 999,
  },
  ambientBottomDockBloom: {
    position: 'absolute',
    bottom: -60,
    left: -20,
    width: SCREEN_WIDTH * 1.1,
    height: 240,
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

