import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  Easing,
} from 'react-native-reanimated';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CustomizationProvider } from './src/context/CustomizationContext';
import { LibraryProvider } from './src/context/LibraryContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { DownloadProvider } from './src/context/DownloadContext';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { DownloaderScreen } from './src/screens/DownloaderScreen';
import { PlaylistsScreen } from './src/screens/PlaylistsScreen';
import { PlaylistDetailScreen } from './src/screens/PlaylistDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MiniPlayer } from './src/components/MiniPlayer';
import { FullPlayerModal } from './src/components/FullPlayerModal';
import { Playlist } from './src/types/music';
import { SPACING, RADIUS } from './src/constants/theme';

type Tab = 'library' | 'downloader' | 'playlists' | 'settings';

const TABS: { id: Tab; label: string; icon: any; activeIcon: any }[] = [
  {
    id: 'library',
    label: 'Library',
    icon: 'musical-notes-outline',
    activeIcon: 'musical-notes',
  },
  {
    id: 'downloader',
    label: 'Add Music',
    icon: 'cloud-download-outline',
    activeIcon: 'cloud-download',
  },
  {
    id: 'playlists',
    label: 'Playlists',
    icon: 'albums-outline',
    activeIcon: 'albums',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings-outline',
    activeIcon: 'settings',
  },
];

function MainNavigator() {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [barWidth, setBarWidth] = useState<number>(0);

  const activeIndex = useSharedValue<number>(0);
  const pillScale = useSharedValue<number>(1);

  const handleTabPress = (tab: Tab, index: number) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (activeTab === 'playlists' && tab === 'playlists') {
      setSelectedPlaylist(null);
    }

    setActiveTab(tab);
    activeIndex.value = withSpring(index, {
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });

    // Micro bounce effect on tap
    pillScale.value = withTiming(0.92, { duration: 80 }, () => {
      pillScale.value = withSpring(1.0, { damping: 14, stiffness: 200 });
    });
  };

  const handleBarLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setBarWidth(width);
    }
  };

  const horizontalPadding = SPACING.xs + 4;
  const availableWidth = Math.max(0, barWidth - horizontalPadding * 2);
  const tabItemWidth = availableWidth > 0 ? availableWidth / TABS.length : 0;

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: activeIndex.value * tabItemWidth },
        { scale: pillScale.value },
      ],
      width: tabItemWidth > 0 ? tabItemWidth : '25%',
    };
  });

  const renderScreenContent = () => {
    if (selectedPlaylist && activeTab === 'playlists') {
      return (
        <Animated.View
          key="playlist-detail"
          entering={SlideInRight.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutRight.duration(200)}
          style={styles.screenContainer}
        >
          <PlaylistDetailScreen
            playlist={selectedPlaylist}
            onBack={() => setSelectedPlaylist(null)}
          />
        </Animated.View>
      );
    }

    switch (activeTab) {
      case 'library':
        return (
          <Animated.View
            key="screen-library"
            entering={FadeIn.duration(240).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(150)}
            style={styles.screenContainer}
          >
            <LibraryScreen onNavigateToDownloader={() => handleTabPress('downloader', 1)} />
          </Animated.View>
        );
      case 'downloader':
        return (
          <Animated.View
            key="screen-downloader"
            entering={FadeIn.duration(240).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(150)}
            style={styles.screenContainer}
          >
            <DownloaderScreen />
          </Animated.View>
        );
      case 'playlists':
        return (
          <Animated.View
            key="screen-playlists"
            entering={FadeIn.duration(240).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(150)}
            style={styles.screenContainer}
          >
            <PlaylistsScreen
              onSelectPlaylist={(pl) => setSelectedPlaylist(pl)}
            />
          </Animated.View>
        );
      case 'settings':
        return (
          <Animated.View
            key="screen-settings"
            entering={FadeIn.duration(240).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(150)}
            style={styles.screenContainer}
          >
            <SettingsScreen />
          </Animated.View>
        );
      default:
        return (
          <Animated.View
            key="screen-default"
            entering={FadeIn.duration(240)}
            style={styles.screenContainer}
          >
            <LibraryScreen />
          </Animated.View>
        );
    }
  };

  const floatingPillBottom = Platform.OS === 'ios' ? 24 : 16;
  const miniPlayerBottom = floatingPillBottom + 70;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent
      />

      {/* Screen Content with Smooth Page Transitions */}
      <View style={styles.contentContainer}>{renderScreenContent()}</View>

      {/* Floating Liquid Mini Player above Floating Pill Bar */}
      <MiniPlayer bottomOffset={miniPlayerBottom} />

      {/* Full Player Modal */}
      <FullPlayerModal />

      {/* Floating Liquid Pill Dock Navigation Bar with Gliding Active Pill */}
      <View
        style={[
          styles.floatingPillWrapper,
          {
            bottom: floatingPillBottom,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.9)',
            shadowColor: isDark ? '#000' : '#8CA0BA',
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 90 : 100}
          tint={isDark ? 'dark' : 'light'}
          style={styles.pillBlur}
        >
          {/* Subtle Liquid Glass Specular Gradient */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 51, 92, 0.04)', 'rgba(15, 23, 42, 0.6)']
                : ['rgba(255, 255, 255, 0.85)', 'rgba(240, 246, 255, 0.6)', 'rgba(225, 238, 255, 0.4)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.pillTabBar} onLayout={handleBarLayout}>
            {/* Smooth Gliding Active Pill Indicator */}
            {tabItemWidth > 0 && (
              <Animated.View
                style={[
                  styles.activeIndicatorPill,
                  indicatorAnimatedStyle,
                  {
                    borderColor: isDark
                      ? 'rgba(255, 51, 92, 0.4)'
                      : 'rgba(255, 46, 85, 0.35)',
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(255, 51, 92, 0.25)', 'rgba(255, 0, 122, 0.16)']
                      : ['rgba(255, 46, 85, 0.16)', 'rgba(255, 0, 122, 0.1)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}

            {/* Tab Items */}
            {TABS.map((tab, idx) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.pillTabItem}
                  onPress={() => handleTabPress(tab.id, idx)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={isActive ? tab.activeIcon : tab.icon}
                    size={21}
                    color={isActive ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.pillTabLabel,
                      { color: isActive ? colors.primary : colors.textMuted },
                      isActive && styles.activePillTabLabel,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <CustomizationProvider>
            <LibraryProvider>
              <PlayerProvider>
                <DownloadProvider>
                  <MainNavigator />
                </DownloadProvider>
              </PlayerProvider>
            </LibraryProvider>
          </CustomizationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  floatingPillWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: RADIUS.full,
    borderWidth: 1.6,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  pillBlur: {
    overflow: 'hidden',
    borderRadius: RADIUS.full,
  },
  pillTabBar: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: SPACING.xs + 4,
  },
  activeIndicatorPill: {
    position: 'absolute',
    left: SPACING.xs + 4,
    top: 6,
    bottom: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1.3,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  pillTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    paddingVertical: 7,
    paddingHorizontal: 2,
    zIndex: 2,
  },
  pillTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  activePillTabLabel: {
    fontWeight: '800',
  },
});
