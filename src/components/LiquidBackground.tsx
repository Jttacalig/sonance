import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LiquidBackground: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Base Deep Cinematic Foundation */}
      <LinearGradient
        colors={
          isDark
            ? ['#050B14', '#0A1220', '#070D18']
            : ['#DCE8F5', '#EBF3FC', '#E2EDF8']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Top Ambient Cyan & Teal Light Bloom (Reference Cinematic Style) */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(0, 229, 255, 0.22)', 'rgba(14, 116, 144, 0.12)', 'transparent']
            : ['rgba(0, 180, 216, 0.18)', 'rgba(14, 165, 233, 0.08)', 'transparent']
        }
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.6 }}
        style={styles.ambientTopBloom}
      />

      {/* Center Subtle Blue & Rose Backlight */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(37, 99, 235, 0.14)', 'rgba(255, 51, 92, 0.08)', 'transparent']
            : ['rgba(59, 130, 246, 0.1)', 'rgba(255, 46, 85, 0.06)', 'transparent']
        }
        start={{ x: 0.8, y: 0.3 }}
        end={{ x: 0.1, y: 0.8 }}
        style={styles.ambientCenterBloom}
      />

      {/* Bottom Ambient Glow */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(0, 242, 254, 0.12)', 'transparent']
            : ['rgba(0, 180, 216, 0.08)', 'transparent']
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.ambientBottomBloom}
      />
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
    top: -60,
    left: -40,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 0.48,
    borderRadius: 999,
  },
  ambientCenterBloom: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
    right: -60,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 0.45,
    borderRadius: 999,
  },
  ambientBottomBloom: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 0.35,
    borderRadius: 999,
  },
});
