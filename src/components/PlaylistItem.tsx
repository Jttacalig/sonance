import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Playlist } from '../types/music';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

interface PlaylistItemProps {
  playlist: Playlist;
  onPress: () => void;
  onOptionsPress?: () => void;
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({
  playlist,
  onPress,
  onOptionsPress,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.outerWrapper,
        {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.85)',
          shadowColor: isDark ? '#000' : '#8CA0BA',
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 85 : 100}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
        style={styles.blurContainer}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.03)', 'transparent']
              : ['rgba(255, 255, 255, 0.8)', 'rgba(240, 246, 255, 0.5)', 'rgba(230, 240, 255, 0.3)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <TouchableOpacity
          style={styles.innerTouchable}
          onPress={onPress}
          activeOpacity={0.75}
        >
          {/* Cover / Icon */}
          <View
            style={[
              styles.artContainer,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
              },
            ]}
          >
            {playlist.coverUri ? (
              <Image source={{ uri: playlist.coverUri }} style={styles.artImage} />
            ) : (
              <LinearGradient
                colors={isDark ? ['#1E293B', '#0F172A'] : ['#E2E8F0', '#CBD5E1']}
                style={styles.placeholderArt}
              >
                <Ionicons name="albums" size={24} color={colors.primary} />
              </LinearGradient>
            )}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {playlist.name}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'song' : 'songs'}
              {playlist.description ? ` • ${playlist.description}` : ''}
            </Text>
          </View>

          {/* Options */}
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
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
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1.2,
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
  infoContainer: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionBtn: {
    padding: SPACING.xs + 2,
  },
});
