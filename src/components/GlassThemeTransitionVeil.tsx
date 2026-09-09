import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const GlassThemeTransitionVeil: React.FC = () => {
  const { isDark } = useTheme();
  const [isActive, setIsActive] = useState(false);
  const isFirstRender = useRef(true);

  const veilOpacity = useSharedValue(0);
  const veilScale = useSharedValue(0.98);
  const veilTranslateY = useSharedValue(-20);
  const sheenTranslateX = useSharedValue(-SCREEN_WIDTH * 0.5);

  const handleAnimationComplete = () => {
    setIsActive(false);
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setIsActive(true);

    veilOpacity.value = 0;
    veilScale.value = 0.98;
    veilTranslateY.value = isDark ? -20 : 20;
    sheenTranslateX.value = -SCREEN_WIDTH * 0.5;

    // Slow, soothing 950ms liquid glass transition
    // 1. Gently rise and frosted glass fades in (380ms)
    // 2. Soft hold while theme updates (90ms)
    // 3. Gracefully dissolve and glide away with Apple ease curve (520ms)
    veilOpacity.value = withSequence(
      withTiming(0.96, {
        duration: 380,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      withDelay(
        90,
        withTiming(0, {
          duration: 520,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }, (finished) => {
          if (finished) {
            runOnJS(handleAnimationComplete)();
          }
        })
      )
    );

    veilScale.value = withSequence(
      withTiming(1.0, {
        duration: 380,
        easing: Easing.out(Easing.cubic),
      }),
      withDelay(
        90,
        withTiming(1.02, {
          duration: 520,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      )
    );

    veilTranslateY.value = withSequence(
      withTiming(0, {
        duration: 380,
        easing: Easing.out(Easing.cubic),
      }),
      withDelay(
        90,
        withTiming(isDark ? 20 : -20, {
          duration: 520,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      )
    );

    sheenTranslateX.value = withTiming(SCREEN_WIDTH * 0.5, {
      duration: 950,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [isDark]);

  const animatedVeilStyle = useAnimatedStyle(() => {
    return {
      opacity: veilOpacity.value,
      transform: [
        { scale: veilScale.value },
        { translateY: veilTranslateY.value },
      ],
    };
  });

  const animatedSheenStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: sheenTranslateX.value },
        { rotate: '-18deg' },
      ],
    };
  });

  if (!isActive) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.veilContainer,
        animatedVeilStyle,
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 95 : 100}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
        style={StyleSheet.absoluteFill}
      >
        {/* Eye-comfort ambient diffusion layer */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(6, 8, 15, 0.65)', 'rgba(10, 16, 28, 0.50)', 'rgba(6, 8, 15, 0.70)']
              : ['rgba(238, 243, 249, 0.75)', 'rgba(245, 248, 252, 0.60)', 'rgba(230, 238, 248, 0.75)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Diagonal Soft Specular Liquid Glass Beam */}
        <Animated.View style={[styles.sheenBeam, animatedSheenStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.75)',
              isDark ? 'rgba(180, 215, 255, 0.08)' : 'rgba(225, 240, 255, 0.85)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  veilContainer: {
    zIndex: 99999,
    overflow: 'hidden',
  },
  sheenBeam: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.4,
    left: -SCREEN_WIDTH * 0.4,
    width: SCREEN_WIDTH * 1.8,
    height: SCREEN_HEIGHT * 1.8,
  },
});
