import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  LayoutChangeEvent,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { DownloadProvider, useDownloads } from './src/context/DownloadContext';
import { AudioRouteProvider } from './src/context/AudioRouteContext';
import { HeadphoneHud } from './src/components/HeadphoneHud';
import { GlobalDownloadIndicator } from './src/components/GlobalDownloadIndicator';
import { ActiveDownloadsModal } from './src/components/ActiveDownloadsModal';
import { GlassThemeTransitionVeil } from './src/components/GlassThemeTransitionVeil';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { DownloaderScreen } from './src/screens/DownloaderScreen';
import { PlaylistsScreen } from './src/screens/PlaylistsScreen';
import { PlaylistDetailScreen } from './src/screens/PlaylistDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MiniPlayer } from './src/components/MiniPlayer';
import { FullPlayerModal } from './src/components/FullPlayerModal';
import { logger } from './src/services/loggerService';
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
  const { activeCount } = useDownloads();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [barWidth, setBarWidth] = useState<number>(0);

  const activeIndex = useSharedValue<number>(0);
  const pillScale = useSharedValue<number>(1);

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      // 1. If viewing playlist detail, go back to playlists list
      if (selectedPlaylist) {
        setSelectedPlaylist(null);
        return true;
      }
      // 2. If not on Library tab, switch to Library tab
      if (activeTab !== 'library') {
        handleTabPress('library', 0);
        return true;
      }
      // 3. Otherwise allow default system back (exit app)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedPlaylist, activeTab]);

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

  const floatingPillBottom = Platform.OS === 'ios' ? 24 : Math.max(16, insets.bottom + 8);
  const miniPlayerBottom = floatingPillBottom + 70;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent
        animated={true}
      />

      {/* Global Dynamic Floating Download Pill */}
      <GlobalDownloadIndicator />

      {/* iOS 26 Dynamic Liquid Headphone HUD */}
      <HeadphoneHud />

      {/* Screen Content with Smooth Page Transitions */}
      <View style={styles.contentContainer}>{renderScreenContent()}</View>

      {/* Global Eye-Comfort Frosted Glass Theme Transition Veil */}
      <GlassThemeTransitionVeil />

      {/* Floating Liquid Mini Player above Floating Pill Bar */}
      <MiniPlayer bottomOffset={miniPlayerBottom} />

      {/* Full Player Modal */}
      <FullPlayerModal />

      {/* Global Active Downloads Modal */}
      <ActiveDownloadsModal />

      {/* Floating Crystal Clear Liquid Glass Pill Navigation Bar */}
      <View
        style={[
          styles.floatingPillWrapper,
          {
            bottom: floatingPillBottom,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.95)',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.45 : 0.16,
            shadowRadius: isDark ? 20 : 14,
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 85 : 100}
          tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
          style={styles.pillBlur}
        >
          {/* Crystal Clear Glass Sheen */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']
                : ['rgba(255, 255, 255, 0.95)', 'rgba(245, 248, 255, 0.7)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Top Specular Edge Highlight Line */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.70)', 'rgba(255, 255, 255, 0.20)', 'transparent']
                : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.25)', 'transparent']
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0 }}
            style={styles.dockTopRim}
          />

          <View style={styles.pillTabBar} onLayout={handleBarLayout}>
            {/* Smooth Gliding Crystal Frosted Lens Pill */}
            {tabItemWidth > 0 && (
              <Animated.View
                style={[
                  styles.activeIndicatorPill,
                  indicatorAnimatedStyle,
                  {
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.45)'
                      : 'rgba(0, 0, 0, 0.08)',
                    shadowColor: '#000',
                  },
                ]}
              >
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0.10)']
                      : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 246, 255, 0.75)']
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
              const tabColor = isActive ? (isDark ? '#FFFFFF' : '#0F172A') : colors.textMuted;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.pillTabItem}
                  onPress={() => handleTabPress(tab.id, idx)}
                  activeOpacity={0.75}
                >
                  <View style={styles.tabIconContainer}>
                    <Ionicons
                      name={isActive ? tab.activeIcon : tab.icon}
                      size={21}
                      color={tabColor}
                    />
                    {tab.id === 'downloader' && activeCount > 0 && (
                      <View
                        style={[
                          styles.tabActiveBadge,
                          {
                            backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                            borderColor: isDark ? '#070A10' : '#FFFFFF',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabActiveBadgeText,
                            { color: isDark ? '#070A10' : '#FFFFFF' },
                          ]}
                        >
                          {activeCount > 9 ? '9+' : activeCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.pillTabLabel,
                      { color: tabColor },
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
  useEffect(() => {
    logger.init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <CustomizationProvider>
            <LibraryProvider>
              <PlayerProvider>
                <AudioRouteProvider>
                  <DownloadProvider>
                    <MainNavigator />
                  </DownloadProvider>
                </AudioRouteProvider>
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
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
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
    borderWidth: 1.0,
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
  dockTopRim: {
    height: 1.0,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActiveBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabActiveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
});
