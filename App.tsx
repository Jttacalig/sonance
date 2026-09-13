import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Ensure OAuth redirects in web/mobile auth sessions complete cleanly
WebBrowser.maybeCompleteAuthSession();
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CustomizationProvider } from './src/context/CustomizationContext';
import { LibraryProvider } from './src/context/LibraryContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { AudioRouteProvider } from './src/context/AudioRouteContext';
import { HeadphoneHud } from './src/components/HeadphoneHud';
import { GlassThemeTransitionVeil } from './src/components/GlassThemeTransitionVeil';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { CloudDriveScreen } from './src/screens/CloudDriveScreen';
import { PlaylistsScreen } from './src/screens/PlaylistsScreen';
import { PlaylistDetailScreen } from './src/screens/PlaylistDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { LiquidBackground } from './src/components/LiquidBackground';
import { MiniPlayer } from './src/components/MiniPlayer';
import { FullPlayerModal } from './src/components/FullPlayerModal';
import { logger } from './src/services/loggerService';
import { Playlist } from './src/types/music';
import { SPACING, RADIUS } from './src/constants/theme';

type Tab = 'library' | 'cloud' | 'playlists' | 'settings' | 'search';

const TABS: { id: Tab; label: string; icon: any; activeIcon: any }[] = [
  {
    id: 'library',
    label: 'Home',
    icon: 'home-outline',
    activeIcon: 'home',
  },
  {
    id: 'cloud',
    label: 'Cloud',
    icon: 'cloud-outline',
    activeIcon: 'cloud',
  },
  {
    id: 'playlists',
    label: 'Library',
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
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

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
        handleTabPress('library');
        return true;
      }
      // 3. Otherwise allow default system back (exit app)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedPlaylist, activeTab]);

  const handleTabPress = (tab: Tab) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (activeTab === 'playlists' && tab === 'playlists') {
      setSelectedPlaylist(null);
    }

    setActiveTab(tab);
  };

  const renderScreenContent = () => {
    if (selectedPlaylist && activeTab === 'playlists') {
      return (
        <View key="playlist-detail" style={styles.screenContainer}>
          <PlaylistDetailScreen
            playlist={selectedPlaylist}
            onBack={() => setSelectedPlaylist(null)}
          />
        </View>
      );
    }

    switch (activeTab) {
      case 'library':
        return (
          <View key="screen-library" style={styles.screenContainer}>
            <LibraryScreen onNavigateToCloud={() => handleTabPress('cloud')} />
          </View>
        );
      case 'cloud':
        return (
          <View key="screen-cloud" style={styles.screenContainer}>
            <CloudDriveScreen />
          </View>
        );
      case 'playlists':
        return (
          <View key="screen-playlists" style={styles.screenContainer}>
            <PlaylistsScreen
              onSelectPlaylist={(pl) => setSelectedPlaylist(pl)}
            />
          </View>
        );
      case 'settings':
        return (
          <View key="screen-settings" style={styles.screenContainer}>
            <SettingsScreen />
          </View>
        );
      case 'search':
        return (
          <View key="screen-search" style={styles.screenContainer}>
            <SearchScreen />
          </View>
        );
      default:
        return (
          <View key="screen-default" style={styles.screenContainer}>
            <LibraryScreen />
          </View>
        );
    }
  };

  const floatingPillBottom = Platform.OS === 'ios' ? 24 : Math.max(16, insets.bottom + 8);
  const miniPlayerBottom = floatingPillBottom + 74;

  return (
    <View style={styles.container}>
      {/* Global iOS 26 Liquid Atmospheric Foundation */}
      <LiquidBackground />

      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
        animated={true}
      />

      {/* iOS 26 Dynamic Liquid Headphone HUD */}
      <HeadphoneHud />

      {/* Screen content avoids layout worklets on iOS. */}
      <View style={styles.contentContainer}>{renderScreenContent()}</View>

      {/* Global Eye-Comfort Frosted Glass Theme Transition Veil */}
      <GlassThemeTransitionVeil />

      {/* Floating Liquid Mini Player above Floating Pill Bar */}
      <MiniPlayer bottomOffset={miniPlayerBottom} />

      {/* Full Player Modal */}
      <FullPlayerModal />

      {/* Apple Music Floating Dual-Element Dock: Left Capsule Dock + Right Circular Search Button */}
      <View
        style={[
          styles.bottomBarContainer,
          { bottom: floatingPillBottom },
        ]}
      >
        {/* Left Floating Capsule Dock */}
        <View
          style={[
            styles.mainDockWrapper,
            {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.65)',
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.40)' : 'rgba(255, 255, 255, 0.95)',
              shadowColor: isDark ? '#000' : '#8CA0BA',
              shadowOpacity: isDark ? 0.45 : 0.18,
              shadowRadius: isDark ? 24 : 16,
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 85 : 95}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={styles.pillBlur}
          >
            {/* Pure Liquid Acrylic Tint & Ambient Backdrop */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? 'rgba(12, 16, 30, 0.52)' : 'rgba(255, 255, 255, 0.75)' },
              ]}
            />

            {/* Specular Liquid Sheen */}
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(245, 248, 255, 0.75)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Top Specular Edge Highlight Line */}
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.12)', 'transparent']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.25)', 'transparent']
              }
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 0 }}
              style={styles.dockTopRim}
            />

            <View style={styles.pillTabBar}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const tabColor = isActive
                  ? '#FA243C'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.85)'
                  : colors.textMuted;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.pillTabItem}
                    onPress={() => handleTabPress(tab.id)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.tabContentBox,
                        isActive && styles.activeTabContentBox,
                      ]}
                    >
                      {isActive && (
                        <LinearGradient
                          colors={['rgba(255, 45, 85, 0.38)', 'rgba(220, 20, 60, 0.18)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Ionicons
                        name={isActive ? tab.activeIcon : tab.icon}
                        size={21}
                        color={tabColor}
                      />
                      <Text
                        style={[
                          styles.pillTabLabel,
                          { color: tabColor },
                          isActive && styles.activePillTabLabel,
                        ]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>

        {/* Right Freestanding Circular Search Button */}
        <TouchableOpacity
          style={[
            styles.searchCircleWrapper,
            {
              borderColor: activeTab === 'search'
                ? (isDark ? 'rgba(255, 75, 105, 0.75)' : 'rgba(250, 36, 60, 0.55)')
                : (isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.65)'),
              borderTopColor: activeTab === 'search'
                ? 'rgba(255, 150, 175, 0.90)'
                : (isDark ? 'rgba(255, 255, 255, 0.40)' : 'rgba(255, 255, 255, 0.95)'),
              shadowColor: activeTab === 'search' ? '#FA243C' : (isDark ? '#000' : '#8CA0BA'),
              shadowOpacity: activeTab === 'search' ? 0.45 : (isDark ? 0.45 : 0.18),
              shadowRadius: isDark ? 24 : 16,
            },
          ]}
          onPress={() => handleTabPress('search')}
          activeOpacity={0.75}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 85 : 95}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={styles.searchCircleBlur}
          >
            {/* Liquid Acrylic Base */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? 'rgba(12, 16, 30, 0.52)' : 'rgba(255, 255, 255, 0.75)' },
              ]}
            />

            <LinearGradient
              colors={
                activeTab === 'search'
                  ? ['rgba(255, 45, 85, 0.38)', 'rgba(220, 20, 60, 0.18)']
                  : (isDark
                      ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                      : ['rgba(255, 255, 255, 0.95)', 'rgba(245, 248, 255, 0.75)'])
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons
              name="search"
              size={24}
              color={activeTab === 'search' ? '#FA243C' : (isDark ? '#FFFFFF' : '#0F172A')}
            />
          </BlurView>
        </TouchableOpacity>
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
                  <MainNavigator />
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
  bottomBarContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  mainDockWrapper: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  pillBlur: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
  },
  pillTabBar: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  pillTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 4,
  },
  tabContentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 6,
    width: '94%',
    minHeight: 52,
    overflow: 'hidden',
  },
  activeTabContentBox: {
    borderWidth: 1.2,
    borderColor: 'rgba(255, 80, 115, 0.65)',
    borderTopColor: 'rgba(255, 150, 175, 0.85)',
    shadowColor: '#FA243C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 4,
  },
  pillTabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: -0.1,
  },
  activePillTabLabel: {
    fontWeight: '700',
  },
  searchCircleWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.2,
    marginLeft: 10,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  searchCircleBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    overflow: 'hidden',
  },
  dockTopRim: {
    height: 1.2,
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
