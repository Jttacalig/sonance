import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LiquidBackground: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Top Left Fluid Aura */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 51, 92, 0.22)', 'rgba(139, 92, 246, 0.14)', 'transparent']
            : ['rgba(255, 46, 85, 0.16)', 'rgba(0, 180, 216, 0.1)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.auraTopLeft}
      />

      {/* Center Right Fluid Aura */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(139, 92, 246, 0.16)', 'rgba(0, 242, 254, 0.1)', 'transparent']
            : ['rgba(121, 40, 202, 0.1)', 'rgba(255, 145, 0, 0.08)', 'transparent']
        }
        start={{ x: 1, y: 0.2 }}
        end={{ x: 0, y: 0.9 }}
        style={styles.auraCenterRight}
      />

      {/* Bottom Center Fluid Aura */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 51, 92, 0.15)', 'transparent']
            : ['rgba(0, 200, 83, 0.08)', 'transparent']
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.auraBottom}
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
  auraTopLeft: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_HEIGHT * 0.45,
    borderRadius: 999,
  },
  auraCenterRight: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
    right: -80,
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_HEIGHT * 0.45,
    borderRadius: 999,
  },
  auraBottom: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_HEIGHT * 0.35,
    borderRadius: 999,
  },
});
