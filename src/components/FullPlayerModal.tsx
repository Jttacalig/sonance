import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  FlatList,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { useCustomization } from '../context/CustomizationContext';
import { useAudioRoute } from '../context/AudioRouteContext';
import { LIQUID_WALLPAPER_PRESETS } from '../constants/equalizer';
import { EqualizerModal } from './EqualizerModal';
import { PlayerBackgroundModal } from './PlayerBackgroundModal';
import { SyncedLyricsView } from './SyncedLyricsView';
import { SPACING, RADIUS } from '../constants/theme';
import { TrackItem } from './TrackItem';

interface FullPlayerModalProps {
  onOpenSleepTimer?: () => void;
  onOpenTrackOptions?: () => void;
}

export const FullPlayerModal: React.FC<FullPlayerModalProps> = ({
  onOpenSleepTimer,
  onOpenTrackOptions,
}) => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const {
    currentTrack,
    queue,
    isPlaying,
    isLoading,
    position,
    duration,
    playbackRate,
    repeatMode,
    isShuffle,
    isFullPlayerVisible,
    sleepTimerMinutes,
    playTrack,
    togglePlayPause,
    skipToNext,
    skipToPrevious,
    seekTo,
    setPlaybackRate,
    toggleRepeatMode,
    toggleShuffle,
    setFullPlayerVisible,
  } = usePlayer();

  const { toggleFavorite } = useLibrary();
  const { colors, isDark } = useTheme();
  const { playerTheme, activePreset, isEqEnabled } = useCustomization();
  const { currentDevice, triggerHud } = useAudioRoute();

  const [showQueue, setShowQueue] = useState(false);
  const [showEqModal, setShowEqModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);

  if (!currentTrack) return null;

  const isSmallScreen = SCREEN_HEIGHT < 720;
  const artSize = Math.min(SCREEN_WIDTH * 0.82, SCREEN_HEIGHT * (isSmallScreen ? 0.32 : 0.38), 340);
  const playBtnSize = Math.min(SCREEN_WIDTH * 0.19, 78);
  const controlBtnSize = Math.min(SCREEN_WIDTH * 0.13, 52);
  const secondaryBtnSize = Math.min(SCREEN_WIDTH * 0.115, 46);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSlidingStart = () => {
    setIsSeeking(true);
    setSeekPosition(position);
  };

  const handleValueChange = (value: number) => {
    setSeekPosition(value);
  };

  const handleSlidingComplete = async (value: number) => {
    await seekTo(value);
    setIsSeeking(false);
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
  };

  const displayTime = isSeeking ? seekPosition : position;
  const remainingTime = Math.max(0, duration - displayTime);

  const renderCustomBackdrop = () => {
    if (playerTheme.type === 'custom' && playerTheme.customImageUri) {
      return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={{ uri: playerTheme.customImageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <BlurView
            intensity={Platform.OS === 'ios' ? playerTheme.blurIntensity : 100}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(0, 0, 0, ${playerTheme.dimness})` },
            ]}
          />
        </View>
      );
    }

    if (playerTheme.type === 'preset' && playerTheme.presetId) {
      const preset =
        LIQUID_WALLPAPER_PRESETS.find((p) => p.id === playerTheme.presetId) ||
        LIQUID_WALLPAPER_PRESETS[0];
      return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={preset.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={preset.secondaryColors}
            start={{ x: 1, y: 0.2 }}
            end={{ x: 0, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
          <BlurView
            intensity={Platform.OS === 'ios' ? playerTheme.blurIntensity : 100}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(0, 0, 0, ${playerTheme.dimness})` },
            ]}
          />
        </View>
      );
    }

    // Default: Dynamic Album Art Aura + Liquid Mesh
    return (
      <View style={styles.liquidAuraContainer} pointerEvents="none">
        {currentTrack.artworkUri && (
          <Image
            source={{ uri: currentTrack.artworkUri }}
            style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.35 : 0.25 }]}
            resizeMode="cover"
            blurRadius={Platform.OS === 'ios' ? 25 : 15}
          />
        )}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)', 'transparent']
              : ['rgba(255, 255, 255, 0.65)', 'rgba(240, 245, 255, 0.3)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.liquidAuraTop, { width: SCREEN_WIDTH * 1.3, height: SCREEN_HEIGHT * 0.55 }]}
        />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.03)', 'transparent']
              : ['rgba(240, 245, 255, 0.3)', 'transparent']
          }
          start={{ x: 1, y: 0.2 }}
          end={{ x: 0, y: 0.9 }}
          style={[styles.liquidAuraBottom, { width: SCREEN_WIDTH * 1.3, height: SCREEN_HEIGHT * 0.55 }]}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={isFullPlayerVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setFullPlayerVisible(false)}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Dynamic Customizable Backdrop */}
        {renderCustomBackdrop()}

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Top Header Bar */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.headerGlassBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
                },
              ]}
              onPress={() => setFullPlayerVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={[styles.headerTitleContainer, { maxWidth: SCREEN_WIDTH * 0.6 }]}>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                PLAYING FROM OFFLINE
              </Text>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {currentTrack.album || 'Local Library'}
              </Text>
            </View>

            {onOpenTrackOptions ? (
              <TouchableOpacity
                style={[
                  styles.headerGlassBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.75)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
                  },
                ]}
                onPress={onOpenTrackOptions}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {showQueue ? (
            /* Queue View */
            <View style={styles.queueContainer}>
              <View style={[styles.queueHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.queueTitle, { color: colors.textPrimary }]}>
                  Up Next ({queue.length})
                </Text>
                <TouchableOpacity
                  style={[
                    styles.closeQueueBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(255, 255, 255, 0.8)',
                    },
                  ]}
                  onPress={() => setShowQueue(false)}
                >
                  <Text style={[styles.closeQueueText, { color: colors.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={queue}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TrackItem
                    track={item}
                    isCurrent={item.id === currentTrack.id}
                    isPlaying={isPlaying && item.id === currentTrack.id}
                    onPress={() => playTrack(item, queue)}
                    onFavoritePress={() => toggleFavorite(item.id)}
                  />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </View>
          ) : (
            /* Main Player View: Flex-1 Full Height with generous balanced spacing */
            <ScrollView
              contentContainerStyle={styles.mainContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* 1. Artwork or Synced Lyrics Hero Section */}
              <View style={styles.artworkSection}>
                {showLyrics ? (
                  <View style={{ width: SCREEN_WIDTH * 0.9, height: artSize }}>
                    <SyncedLyricsView
                      track={currentTrack}
                      currentPosition={displayTime}
                      onSeekTo={seekTo}
                      height={artSize}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setShowLyrics(true)}
                    style={[
                      styles.artworkWrapper,
                      {
                        shadowColor: '#000',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.artworkContainer,
                        {
                          width: artSize,
                          height: artSize,
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.28)'
                            : 'rgba(255, 255, 255, 0.95)',
                        },
                      ]}
                    >
                      {currentTrack.artworkUri ? (
                        <Image
                          source={{ uri: currentTrack.artworkUri }}
                          style={styles.bigArtwork}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.placeholderBigArt}>
                          <BlurView
                            intensity={Platform.OS === 'ios' ? 85 : 100}
                            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                            style={StyleSheet.absoluteFill}
                          />
                          <LinearGradient
                            colors={
                              isDark
                                ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.04)', 'transparent']
                                : ['rgba(255, 255, 255, 0.9)', 'rgba(240, 246, 255, 0.6)']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <Ionicons name="musical-notes" size={artSize * 0.38} color={isDark ? '#FFFFFF' : colors.primary} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* 2. Controls & Details Section (fills the rest of screen naturally) */}
              <View style={styles.bottomControlsArea}>
                {/* Track Info & Favorite */}
                <View style={styles.trackInfoRow}>
                  <View style={styles.trackDetails}>
                    <Text
                      style={[styles.trackTitle, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {currentTrack.title}
                    </Text>
                    <Text
                      style={[styles.trackArtist, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {currentTrack.artist}
                    </Text>

                    {/* iOS Audio Output Chip */}
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => triggerHud(currentDevice)}
                      style={[
                        styles.audioRouteChip,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.75)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.06)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={currentDevice.type === 'airpods' || currentDevice.type === 'headphones' ? 'headset' : currentDevice.type === 'bluetooth' ? 'bluetooth' : 'volume-high'}
                        size={12}
                        color={isDark ? '#FFFFFF' : colors.primary}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.audioRouteText, { color: colors.textPrimary }]}>
                        {currentDevice.name}
                      </Text>
                      <Text style={[styles.audioRouteDot, { color: colors.textMuted }]}>•</Text>
                      <Text style={[styles.audioRouteQuality, { color: isDark ? 'rgba(255, 255, 255, 0.8)' : colors.primary }]}>
                        {currentDevice.quality.split('•')[0].trim()}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.favoriteButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.09)'
                          : 'rgba(255, 255, 255, 0.75)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
                      },
                    ]}
                    onPress={() => toggleFavorite(currentTrack.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={currentTrack.isFavorite ? 'heart' : 'heart-outline'}
                      size={24}
                      color={currentTrack.isFavorite ? (isDark ? '#FFFFFF' : colors.primary) : colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Frosted Glass Scrubber Card */}
                <BlurView
                  intensity={Platform.OS === 'ios' ? 85 : 100}
                  tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                  style={[
                    styles.scrubberCard,
                    {
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.26)'
                        : 'rgba(255, 255, 255, 0.95)',
                      shadowColor: '#000',
                      shadowOpacity: isDark ? 0.35 : 0.18,
                      shadowRadius: 14,
                    },
                  ]}
                >
                  {/* Subtle Liquid Glass Specular Gradient */}
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.03)', 'transparent']
                        : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 246, 255, 0.65)', 'rgba(225, 238, 255, 0.4)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Top Specular Rim Light Reflection */}
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.18)', 'transparent']
                        : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.3)', 'transparent']
                    }
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 0 }}
                    style={styles.scrubberTopRim}
                  />
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={Math.max(1, duration)}
                    value={displayTime}
                    minimumTrackTintColor={isDark ? '#FFFFFF' : '#0F172A'}
                    maximumTrackTintColor={
                      isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.12)'
                    }
                    thumbTintColor={isDark ? '#FFFFFF' : '#0F172A'}
                    onSlidingStart={handleSlidingStart}
                    onValueChange={handleValueChange}
                    onSlidingComplete={handleSlidingComplete}
                  />
                  <View style={styles.timeRow}>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatTime(displayTime)}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      -{formatTime(remainingTime)}
                    </Text>
                  </View>
                </BlurView>

                {/* Liquid Controls Row */}
                <View style={styles.controlsRow}>
                  {/* Shuffle */}
                  <TouchableOpacity
                    style={[
                      styles.controlGlassBtn,
                      {
                        width: secondaryBtnSize,
                        height: secondaryBtnSize,
                        borderRadius: secondaryBtnSize / 2,
                        backgroundColor: isDark
                          ? (isShuffle ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.09)')
                          : (isShuffle ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.75)'),
                        borderColor: isDark ? (isShuffle ? 'rgba(255, 255, 255, 0.40)' : 'rgba(255, 255, 255, 0.20)') : '#FFFFFF',
                      },
                    ]}
                    onPress={toggleShuffle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="shuffle"
                      size={20}
                      color={isShuffle ? (isDark ? '#FFFFFF' : colors.primary) : colors.textMuted}
                    />
                  </TouchableOpacity>

                  {/* Previous */}
                  <TouchableOpacity
                    style={[
                      styles.controlGlassBtn,
                      {
                        width: controlBtnSize,
                        height: controlBtnSize,
                        borderRadius: controlBtnSize / 2,
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.09)'
                          : 'rgba(255, 255, 255, 0.75)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : '#FFFFFF',
                      },
                    ]}
                    onPress={skipToPrevious}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="play-back" size={26} color={colors.textPrimary} />
                  </TouchableOpacity>

                  {/* Liquid Giant Play / Pause Button */}
                  <TouchableOpacity
                    style={[
                      styles.playPauseWrapper,
                      {
                        width: playBtnSize,
                        height: playBtnSize,
                        borderRadius: playBtnSize / 2,
                        backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                        shadowColor: '#000',
                      },
                    ]}
                    onPress={togglePlayPause}
                    activeOpacity={0.85}
                  >
                    {isLoading ? (
                      <Ionicons name="sync-outline" size={32} color={isDark ? '#070A10' : '#FFFFFF'} style={{ alignSelf: 'center' }} />
                    ) : (
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={32}
                        color={isDark ? '#070A10' : '#FFFFFF'}
                        style={isPlaying ? { alignSelf: 'center' } : { alignSelf: 'center', marginLeft: 3.5 }}
                      />
                    )}
                  </TouchableOpacity>

                  {/* Next */}
                  <TouchableOpacity
                    style={[
                      styles.controlGlassBtn,
                      {
                        width: controlBtnSize,
                        height: controlBtnSize,
                        borderRadius: controlBtnSize / 2,
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.09)'
                          : 'rgba(255, 255, 255, 0.75)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : '#FFFFFF',
                      },
                    ]}
                    onPress={skipToNext}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="play-forward" size={26} color={colors.textPrimary} />
                  </TouchableOpacity>

                  {/* Repeat Mode */}
                  <TouchableOpacity
                    style={[
                      styles.controlGlassBtn,
                      {
                        width: secondaryBtnSize,
                        height: secondaryBtnSize,
                        borderRadius: secondaryBtnSize / 2,
                        backgroundColor: isDark
                          ? (repeatMode !== 'off' ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.09)')
                          : (repeatMode !== 'off' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.75)'),
                        borderColor: isDark ? (repeatMode !== 'off' ? 'rgba(255, 255, 255, 0.40)' : 'rgba(255, 255, 255, 0.20)') : '#FFFFFF',
                      },
                    ]}
                    onPress={toggleRepeatMode}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={repeatMode === 'one' ? 'repeat-outline' : 'repeat'}
                      size={20}
                      color={repeatMode !== 'off' ? (isDark ? '#FFFFFF' : colors.primary) : colors.textMuted}
                    />
                    {repeatMode === 'one' && (
                      <View style={[styles.repeatBadge, { backgroundColor: isDark ? '#FFFFFF' : colors.primary }]}>
                        <Text style={[styles.repeatBadgeText, { color: isDark ? '#070A10' : '#FFFFFF' }]}>1</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Balanced Non-Overlapping Bottom Dock */}
                <View
                  style={[
                    styles.bottomDockCard,
                    {
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.24)'
                        : 'rgba(255, 255, 255, 0.85)',
                      shadowColor: '#000',
                    },
                  ]}
                >
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 85 : 100}
                    tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                    style={styles.bottomDockBlur}
                  >
                    {/* Lyrics Toggle Button */}
                    <TouchableOpacity
                      style={[
                        styles.dockActionBtn,
                        showLyrics && [
                          styles.dockActionBtnActive,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.16)'
                              : 'rgba(0, 0, 0, 0.08)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.15)',
                          },
                        ],
                      ]}
                      onPress={() => setShowLyrics(!showLyrics)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={17}
                        color={showLyrics ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dockActionLabel,
                          { color: showLyrics ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        Lyrics
                      </Text>
                    </TouchableOpacity>

                    {/* EQ Button */}
                    <TouchableOpacity
                      style={[
                        styles.dockActionBtn,
                        isEqEnabled && [
                          styles.dockActionBtnActive,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.16)'
                              : 'rgba(0, 0, 0, 0.08)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.15)',
                          },
                        ],
                      ]}
                      onPress={() => setShowEqModal(true)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="options"
                        size={17}
                        color={isEqEnabled ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dockActionLabel,
                          { color: isEqEnabled ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {isEqEnabled ? activePreset.name.slice(0, 6) : 'EQ'}
                      </Text>
                    </TouchableOpacity>

                    {/* Theme Button */}
                    <TouchableOpacity
                      style={[
                        styles.dockActionBtn,
                        playerTheme.type !== 'artwork_aura' && [
                          styles.dockActionBtnActive,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.16)'
                              : 'rgba(0, 0, 0, 0.08)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.15)',
                          },
                        ],
                      ]}
                      onPress={() => setShowWallpaperModal(true)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="color-palette"
                        size={17}
                        color={playerTheme.type !== 'artwork_aura' ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dockActionLabel,
                          { color: playerTheme.type !== 'artwork_aura' ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        Theme
                      </Text>
                    </TouchableOpacity>

                    {/* Speed Button */}
                    <TouchableOpacity
                      style={[
                        styles.dockActionBtn,
                        playbackRate !== 1.0 && [
                          styles.dockActionBtnActive,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.16)'
                              : 'rgba(0, 0, 0, 0.08)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.15)',
                          },
                        ],
                      ]}
                      onPress={cycleSpeed}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="speedometer-outline"
                        size={17}
                        color={playbackRate !== 1.0 ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dockActionLabel,
                          { color: playbackRate !== 1.0 ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {playbackRate}x
                      </Text>
                    </TouchableOpacity>

                    {/* Sleep Timer Button */}
                    <TouchableOpacity
                      style={[
                        styles.dockActionBtn,
                        sleepTimerMinutes !== null && [
                          styles.dockActionBtnActive,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.16)'
                              : 'rgba(0, 0, 0, 0.08)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.15)',
                          },
                        ],
                      ]}
                      onPress={onOpenSleepTimer}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="moon"
                        size={17}
                        color={sleepTimerMinutes !== null ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.dockActionLabel,
                          { color: sleepTimerMinutes !== null ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {sleepTimerMinutes !== null ? `${sleepTimerMinutes}m` : 'Timer'}
                      </Text>
                    </TouchableOpacity>

                    {/* Queue Button */}
                    <TouchableOpacity
                      style={styles.dockActionBtn}
                      onPress={() => setShowQueue(true)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.dockIconBadgeWrapper}>
                        <Ionicons name="list" size={17} color={colors.textSecondary} />
                        {queue.length > 0 && (
                          <View style={[styles.queueCountBadge, { backgroundColor: isDark ? '#FFFFFF' : colors.primary }]}>
                            <Text style={[styles.queueCountText, { color: isDark ? '#070A10' : '#FFFFFF' }]}>{queue.length}</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.dockActionLabel, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        Queue
                      </Text>
                    </TouchableOpacity>
                  </BlurView>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>

        {/* Audio Equalizer Modal */}
        <EqualizerModal
          visible={showEqModal}
          onClose={() => setShowEqModal(false)}
        />

        {/* Player Background & Wallpaper Customizer Modal */}
        <PlayerBackgroundModal
          visible={showWallpaperModal}
          onClose={() => setShowWallpaperModal(false)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  liquidAuraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  liquidAuraTop: {
    position: 'absolute',
    top: -80,
    left: -60,
    borderRadius: 999,
  },
  liquidAuraBottom: {
    position: 'absolute',
    bottom: -100,
    right: -60,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  headerGlassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  mainContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg + 2,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
  },
  artworkSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: SPACING.xs,
  },
  artworkWrapper: {
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 14,
  },
  artworkContainer: {
    borderRadius: RADIUS.clay + 8,
    overflow: 'hidden',
    borderWidth: 2,
  },
  bigArtwork: {
    width: '100%',
    height: '100%',
  },
  placeholderBigArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControlsArea: {
    width: '100%',
    gap: SPACING.md,
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  trackDetails: {
    flex: 1,
    marginRight: SPACING.md,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.4,
  },
  trackArtist: {
    fontSize: 16,
    fontWeight: '600',
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  scrubberCard: {
    width: '100%',
    borderRadius: RADIUS.clay,
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.sm,
    borderWidth: 1.4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  scrubberTopRim: {
    height: 1.5,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: SPACING.xs,
    marginVertical: 2,
  },
  controlGlassBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
    position: 'relative',
  },
  repeatBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 5,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatBadgeText: {
    fontSize: 7,
    color: '#FFF',
    fontWeight: 'bold',
  },
  playPauseWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  playPauseBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  bottomDockCard: {
    width: '100%',
    borderRadius: RADIUS.full,
    borderWidth: 1.4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomDockBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  dockActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 3,
  },
  dockActionBtnActive: {
    borderWidth: 1,
  },
  dockActionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  dockIconBadgeWrapper: {
    position: 'relative',
  },
  queueCountBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueCountText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
  },
  queueContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    marginBottom: SPACING.sm,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeQueueBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  closeQueueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  audioRouteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: 6,
  },
  audioRouteText: {
    fontSize: 11,
    fontWeight: '700',
  },
  audioRouteDot: {
    fontSize: 10,
    marginHorizontal: 4,
  },
  audioRouteQuality: {
    fontSize: 10.5,
    fontWeight: '800',
  },
});
