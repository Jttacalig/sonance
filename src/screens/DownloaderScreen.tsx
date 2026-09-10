import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useDownloads } from '../context/DownloadContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { ExtractedInfo, downloaderService } from '../services/downloaderService';
import { youtubeSearchService, SearchResultItem } from '../services/youtubeSearchService';
import { storageService } from '../services/storageService';
import { Track } from '../types/music';
import { DownloadCard } from '../components/DownloadCard';
import { LiquidBackground } from '../components/LiquidBackground';
import { AudioFormatModal } from '../components/AudioFormatModal';
import { StoragePermissionModal } from '../components/StoragePermissionModal';
import { MusicVideoModal } from '../components/MusicVideoModal';
import { SPACING, RADIUS } from '../constants/theme';
import { QUICK_SEARCH_CHIPS, AudioFormat, PLATFORM_PATTERNS } from '../constants/endpoints';

export const DownloaderScreen: React.FC = () => {
  const {
    downloads,
    activeCount,
    queuedCount,
    openDownloadsModal,
    addDownload,
    addBulkDownloads,
    cancelDownload,
    removeDownload,
    clearCompleted,
  } = useDownloads();
  const { tracks, refreshLibrary } = useLibrary();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();
  const { colors, isDark } = useTheme();

  const [streamingTrackId, setStreamingTrackId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Bulk Mode state
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Embedded Video/Stream Modal state
  const [previewVideoItem, setPreviewVideoItem] = useState<SearchResultItem | null>(null);
  const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);

  // Audio Format Modal state
  const [selectedTrackForFormat, setSelectedTrackForFormat] = useState<ExtractedInfo | null>(null);
  const [isFormatModalVisible, setIsFormatModalVisible] = useState(false);
  const [isStartingDownload, setIsStartingDownload] = useState(false);

  // Storage Access Permission Modal state
  const [isStoragePermissionModalVisible, setIsStoragePermissionModalVisible] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ info: ExtractedInfo; format: AudioFormat } | null>(null);

  // Clipboard detection state
  const [detectedClipboardUrl, setDetectedClipboardUrl] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<{ name: string; icon: string } | null>(null);
  const [isClipboardBannerVisible, setIsClipboardBannerVisible] = useState(false);

  useEffect(() => {
    checkClipboard();
  }, []);

  const checkClipboard = async () => {
    try {
      const hasString = await Clipboard.hasStringAsync();
      if (hasString) {
        const content = await Clipboard.getStringAsync();
        if (content) {
          const trimmed = content.trim();
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            // Check if it's a supported platform
            const platform = PLATFORM_PATTERNS.find(p => p.pattern.test(trimmed));
            if (platform) {
              setDetectedClipboardUrl(trimmed);
              setDetectedPlatform(platform);
              setIsClipboardBannerVisible(true);
            } else if (trimmed.match(/\.(mp3|m4a|wav|flac|ogg)$/i)) {
              setDetectedClipboardUrl(trimmed);
              setDetectedPlatform({ name: 'Direct Audio', icon: '🎵' });
              setIsClipboardBannerVisible(true);
            }
          }
        }
      }
    } catch (e) {
      console.log('Clipboard access error:', e);
    }
  };

  const handleUseClipboardUrl = () => {
    if (detectedClipboardUrl) {
      setSearchQuery(detectedClipboardUrl);
      setIsClipboardBannerVisible(false);
      // Wait a bit for the state to update, then search or show format modal
      setTimeout(() => {
         // Auto-trigger search or URL parsing
         handleSearch(detectedClipboardUrl);
      }, 100);
    }
  };

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (!q) return;

    Keyboard.dismiss();
    setIsSearching(true);
    setHasSearched(true);
    setIsBulkMode(false);
    setSelectedItemIds([]);

    try {
      // Check if it's a supported platform URL or direct audio URL
      const isUrl = q.startsWith('http://') || q.startsWith('https://');
      const platform = isUrl ? PLATFORM_PATTERNS.find(p => p.pattern.test(q)) : null;
      const isDirectAudio = isUrl && q.match(/\.(mp3|m4a|wav|flac|ogg)$/i);
      
      // If it's a YouTube URL, let the youtubeSearchService handle it (it works well for YT URLs)
      // If it's another platform or direct audio, create a mock result card
      if (isUrl && (platform?.name !== 'YouTube') || isDirectAudio) {
        const mockResult: SearchResultItem = {
          id: 'url_' + Date.now().toString(),
          title: platform ? `Download from ${platform.name}` : 'Direct Audio Download',
          artist: 'External Source',
          duration: 'Unknown',
          durationSec: 0,
          thumbnailUrl: 'https://via.placeholder.com/300x300.png?text=Link',
          sourceUrl: q,
          compatibilityType: 'standard',
          badgeLabel: platform?.name || 'Direct Link',
        };
        setSearchResults([mockResult]);
      } else {
        const results = await youtubeSearchService.search(q);
        setSearchResults(results);
      }
    } catch (error: any) {
      Alert.alert('Search Error', error?.message || 'Could not fetch search results.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectQuickChip = (chipQuery: string) => {
    setSearchQuery(chipQuery);
    handleSearch(chipQuery);
  };

  // Bulk Mode Actions
  const handleToggleBulkMode = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (isBulkMode) {
      setIsBulkMode(false);
      setSelectedItemIds([]);
    } else {
      setIsBulkMode(true);
    }
  };

  const handleToggleSelectItem = (id: string) => {
    if (Haptics.selectionAsync) {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (selectedItemIds.length === searchResults.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(searchResults.map(s => s.id));
    }
  };

  const handleExecuteBulkDownload = async () => {
    if (selectedItemIds.length === 0) return;

    const isGranted = await storageService.isStoragePermissionGranted();
    if (!isGranted) {
      setIsStoragePermissionModalVisible(true);
      return;
    }

    try {
      const settings = await storageService.getSettings();
      const preferredFormat = settings.preferredAudioQuality || 'm4a';

      const selectedItems = searchResults.filter(s => selectedItemIds.includes(s.id));
      const bulkEntries = selectedItems.map(item => ({
        info: {
          title: item.title,
          artist: item.artist,
          thumbnailUrl: item.thumbnailUrl,
          sourceUrl: item.sourceUrl,
          sourceType: 'youtube' as const,
          duration: item.durationSec,
          durationText: item.duration,
          format: preferredFormat,
        },
        format: preferredFormat,
      }));

      await addBulkDownloads(bulkEntries);

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      const count = selectedItems.length;
      setIsBulkMode(false);
      setSelectedItemIds([]);
      Alert.alert(
        'Downloads Queued 🚀',
        `Added ${count} tracks (${preferredFormat.toUpperCase()}) to your background download queue.`
      );
    } catch (err: any) {
      Alert.alert('Bulk Download Error', err?.message || 'Could not queue selected tracks.');
    }
  };

  // Play direct audio stream in background using native player
  const handlePlayOnlineStream = async (item: SearchResultItem) => {
    const onlineTrackId = `online_${item.id}`;

    // If currently playing/paused this track, toggle play/pause
    if (currentTrack?.id === onlineTrackId) {
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      await togglePlayPause();
      return;
    }

    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    setStreamingTrackId(item.id);

    try {
      const resolved = await downloaderService.resolveAudioStreamUrl(item.sourceUrl, 'm4a');
      if (!resolved || !resolved.streamUrl) {
        throw new Error('Could not resolve direct audio stream.');
      }

      const onlineTrack: Track = {
        id: onlineTrackId,
        title: item.title,
        artist: item.artist,
        album: 'Online Stream',
        duration: item.durationSec || 0,
        uri: resolved.streamUrl,
        artworkUri: item.thumbnailUrl,
        sourceUrl: item.sourceUrl,
        sourceType: 'youtube',
        dateAdded: Date.now(),
      };

      const queueTracks: Track[] = searchResults.map(s => ({
        id: `online_${s.id}`,
        title: s.title,
        artist: s.artist,
        album: 'Online Stream',
        duration: s.durationSec || 0,
        uri: s.id === item.id ? resolved.streamUrl : s.sourceUrl,
        artworkUri: s.thumbnailUrl,
        sourceUrl: s.sourceUrl,
        sourceType: 'youtube',
        dateAdded: Date.now(),
      }));

      await playTrack(onlineTrack, queueTracks);

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err: any) {
      Alert.alert('Stream Error', err?.message || 'Failed to stream audio. Please check your network connection.');
    } finally {
      setStreamingTrackId(null);
    }
  };

  // Open embedded video / audio stream player
  const handleOpenStreamPreview = (item: SearchResultItem) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setPreviewVideoItem(item);
    setIsVideoModalVisible(true);
  };

  const handleOpenFormatModalForSearchResult = async (item: SearchResultItem) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const settings = await storageService.getSettings();
    const preferredFormat = settings.preferredAudioQuality || 'm4a';

    const info: ExtractedInfo = {
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl,
      sourceType: 'youtube',
      duration: item.durationSec,
      durationText: item.duration,
      format: preferredFormat,
    };
    setSelectedTrackForFormat(info);
    setIsFormatModalVisible(true);
  };

  const handleExecuteDownload = async (info: ExtractedInfo, format: AudioFormat) => {
    try {
      setIsFormatModalVisible(false);
      setSelectedTrackForFormat(null);
      setPendingDownload(null);

      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      // Non-blocking asynchronous queueing
      await addDownload(info, format);
    } catch (error: any) {
      Alert.alert('Download Error', error?.message || 'Failed to queue audio track.');
    }
  };

  const handleConfirmDownload = async (info: ExtractedInfo, format: AudioFormat) => {
    const isGranted = await storageService.isStoragePermissionGranted();
    if (!isGranted) {
      setPendingDownload({ info, format });
      setIsFormatModalVisible(false);
      setIsStoragePermissionModalVisible(true);
      return;
    }
    await handleExecuteDownload(info, format);
  };

  const handleAllowStoragePermission = async () => {
    setIsStoragePermissionModalVisible(false);
    if (pendingDownload) {
      await handleExecuteDownload(pendingDownload.info, pendingDownload.format);
    }
  };

  // Helper to get live download/library status of an item
  const getItemStatus = (item: SearchResultItem) => {
    const inLib = tracks.some(
      t =>
        (t.sourceUrl === item.sourceUrl ||
          (t.title.toLowerCase() === item.title.toLowerCase() &&
            t.artist.toLowerCase() === item.artist.toLowerCase())) &&
        (t.fileSize || 0) > 0
    );
    if (inLib) return { type: 'in_library', label: 'In Library' };

    const activeDl = downloads.find(d => d.url === item.sourceUrl);
    if (activeDl) {
      if (activeDl.status === 'queued') return { type: 'queued', label: 'Queued' };
      if (activeDl.status === 'resolving') return { type: 'resolving', label: 'Resolving...' };
      if (activeDl.status === 'downloading')
        return {
          type: 'downloading',
          label: `${Math.round(activeDl.progress * 100)}%`,
          progress: activeDl.progress,
        };
      if (activeDl.status === 'saving') return { type: 'saving', label: 'Saving...' };
      if (activeDl.status === 'completed') return { type: 'completed', label: 'Saved' };
      if (activeDl.status === 'error') return { type: 'error', label: 'Retry' };
    }
    return null;
  };

  const renderCompatibilityBadge = (item: SearchResultItem) => {
    let badgeColor = colors.primary;
    let badgeBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
    let badgeBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    let iconName: any = 'musical-note';
    let label = item.badgeLabel || 'Track';

    switch (item.compatibilityType) {
      case 'official_audio':
        badgeColor = '#10B981';
        badgeBg = isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)';
        badgeBorder = isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)';
        iconName = 'sparkles';
        label = 'Official Audio';
        break;
      case 'music_video':
        badgeColor = '#8B5CF6';
        badgeBg = isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.12)';
        badgeBorder = isDark ? 'rgba(139, 92, 246, 0.35)' : 'rgba(139, 92, 246, 0.3)';
        iconName = 'videocam';
        label = 'Music Video';
        break;
      case 'lyrics':
        badgeColor = '#F59E0B';
        badgeBg = isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.12)';
        badgeBorder = isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.3)';
        iconName = 'mic-outline';
        label = 'Lyrics';
        break;
      case 'live':
        badgeColor = '#F43F5E';
        badgeBg = isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 63, 94, 0.12)';
        badgeBorder = isDark ? 'rgba(244, 63, 94, 0.35)' : 'rgba(244, 63, 94, 0.3)';
        iconName = 'radio-outline';
        label = 'Live';
        break;
      case 'remix':
        badgeColor = '#6366F1';
        badgeBg = isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.12)';
        badgeBorder = isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.3)';
        iconName = 'disc-outline';
        label = 'Remix';
        break;
    }

    return (
      <View style={[styles.compatBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
        <Ionicons name={iconName} size={10} color={badgeColor} style={{ marginRight: 3 }} />
        <Text style={[styles.compatBadgeText, { color: badgeColor }]}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LiquidBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Add Music</Text>
              <View style={styles.headerBadgesRight}>
                {downloads.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => openDownloadsModal()}
                    style={[
                      styles.downloadsHeaderBtn,
                      {
                        backgroundColor: isDark
                          ? (activeCount > 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)')
                          : (activeCount > 0 ? colors.primary : 'rgba(0, 0, 0, 0.05)'),
                        borderColor: isDark
                          ? (activeCount > 0 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.16)')
                          : (activeCount > 0 ? colors.primary : 'rgba(0, 0, 0, 0.1)'),
                      },
                    ]}
                  >
                    <Ionicons
                      name={activeCount > 0 ? 'arrow-down-circle' : 'cloud-download-outline'}
                      size={13}
                      color={activeCount > 0 ? '#FFFFFF' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.downloadsHeaderText,
                        { color: activeCount > 0 ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {activeCount > 0 ? `${activeCount} Active` : `${downloads.length} Queue`}
                    </Text>
                  </TouchableOpacity>
                )}
                <View
                  style={[
                    styles.adFreeBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(0, 230, 118, 0.14)'
                        : 'rgba(0, 200, 83, 0.1)',
                      borderColor: isDark
                        ? 'rgba(0, 230, 118, 0.35)'
                        : 'rgba(0, 200, 83, 0.35)',
                    },
                  ]}
                >
                  <Ionicons name="shield-checkmark" size={13} color={colors.accentGreen} />
                  <Text style={[styles.adFreeText, { color: colors.accentGreen }]}>Ad-Free</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Clipboard Banner */}
          {isClipboardBannerVisible && detectedClipboardUrl && detectedPlatform && (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleUseClipboardUrl}
                style={[
                  styles.clipboardBanner,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'
                  }
                ]}
              >
                <View style={styles.clipboardBannerContent}>
                  <Text style={styles.clipboardBannerIcon}>{detectedPlatform.icon}</Text>
                  <View style={styles.clipboardBannerTextContainer}>
                    <Text style={[styles.clipboardBannerTitle, { color: colors.textPrimary }]}>
                      Link detected
                    </Text>
                    <Text style={[styles.clipboardBannerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      Download from {detectedPlatform.name}?
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsClipboardBannerVisible(false)}
                  style={styles.clipboardBannerClose}
                >
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Search Glass Input Card */}
          <View
            style={[
              styles.searchGlassCard,
              {
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.22)'
                  : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 85 : 100}
              tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
              style={styles.searchBlur}
            >
              <View
                style={[
                  styles.searchInputRow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 0, 0, 0.22)'
                      : 'rgba(255, 255, 255, 0.65)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(200, 212, 228, 0.5)',
                  },
                ]}
              >
                {PLATFORM_PATTERNS.find(p => p.pattern.test(searchQuery)) ? (
                  <Text style={{ fontSize: 18, marginRight: 4 }}>
                    {PLATFORM_PATTERNS.find(p => p.pattern.test(searchQuery))?.icon}
                  </Text>
                ) : searchQuery.match(/\.(mp3|m4a|wav|flac|ogg)$/i) ? (
                  <Text style={{ fontSize: 18, marginRight: 4 }}>🎵</Text>
                ) : (
                  <Ionicons name="search" size={20} color={isDark ? '#FFFFFF' : colors.primary} />
                )}
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  placeholder="Search songs or paste any link..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => handleSearch()}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setHasSearched(false);
                    }}
                    style={styles.clearBtn}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.searchSubmitWrapper}
                onPress={() => handleSearch()}
                disabled={!searchQuery.trim() || isSearching}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.searchSubmitBtn,
                    {
                      backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                      shadowColor: isDark ? '#FFFFFF' : colors.primary,
                    },
                    !searchQuery.trim() && styles.disabledBtn,
                  ]}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color={isDark ? '#070A10' : '#FFF'} />
                  ) : (
                    <>
                      <Ionicons name="search" size={16} color={isDark ? '#070A10' : '#FFF'} />
                      <Text style={[styles.searchSubmitText, { color: isDark ? '#070A10' : '#FFF' }]}>Search Music</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </BlurView>
          </View>

          {/* Quick Discovery Pills */}
          <View style={styles.chipsSection}>
            <Text style={[styles.chipsHeading, { color: colors.textSecondary }]}>
              DISCOVER & QUICK SEARCH
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {QUICK_SEARCH_CHIPS.map((chip, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.75}
                  onPress={() => handleSelectQuickChip(chip.query)}
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(255, 255, 255, 0.75)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.16)'
                        : 'rgba(255, 255, 255, 0.9)',
                    },
                  ]}
                >
                  <Text style={[styles.quickChipText, { color: colors.textPrimary }]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search Results List */}
          <View style={styles.resultsSection}>
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  Searching music tracks...
                </Text>
              </View>
            ) : searchResults.length > 0 ? (
              <View style={styles.resultsList}>
                {/* Results Header with Bulk Select Toggle */}
                <View style={styles.resultsSectionHeader}>
                  <Text style={[styles.resultsCountHeader, { color: colors.textSecondary }]}>
                    FOUND {searchResults.length} TRACKS
                  </Text>
                  <View style={styles.bulkHeaderActions}>
                    {isBulkMode && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleSelectAll}
                        style={[
                          styles.bulkHeaderBtn,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                          },
                        ]}
                      >
                        <Text style={[styles.bulkHeaderBtnText, { color: colors.primary }]}>
                          {selectedItemIds.length === searchResults.length ? 'Deselect All' : 'Select All'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleToggleBulkMode}
                      style={[
                        styles.bulkToggleBtn,
                        isBulkMode
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                            },
                      ]}
                    >
                      <Ionicons
                        name={isBulkMode ? 'checkmark-done' : 'checkbox-outline'}
                        size={13}
                        color={isBulkMode ? '#FFFFFF' : (isDark ? '#FFFFFF' : colors.textPrimary)}
                      />
                      <Text
                        style={[
                          styles.bulkToggleBtnText,
                          { color: isBulkMode ? '#FFFFFF' : (isDark ? '#FFFFFF' : colors.textPrimary) },
                        ]}
                      >
                        {isBulkMode ? 'Done' : 'Bulk Select'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {searchResults.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);
                  const itemStatus = getItemStatus(item);
                  const isThisTrackCurrent = currentTrack?.id === `online_${item.id}`;
                  const isThisTrackPlaying = isThisTrackCurrent && isPlaying;
                  const isThisTrackStreaming = streamingTrackId === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={isBulkMode ? 0.85 : 1}
                      onPress={() => {
                        if (isBulkMode) {
                          handleToggleSelectItem(item.id);
                        } else {
                          handlePlayOnlineStream(item);
                        }
                      }}
                      style={[
                        styles.resultCard,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.12)')
                            : isThisTrackCurrent
                            ? (isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)')
                            : isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(255, 255, 255, 0.65)',
                          borderColor: isSelected
                            ? colors.primary
                            : isThisTrackCurrent
                            ? colors.primary
                            : isDark
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(200, 212, 228, 0.5)',
                          shadowColor: isDark ? '#000' : '#8CA0BA',
                        },
                      ]}
                    >
                      {/* Checkbox in Bulk Mode */}
                      {isBulkMode && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleToggleSelectItem(item.id)}
                          style={styles.checkboxContainer}
                        >
                          <View
                            style={[
                              styles.checkboxCircle,
                              isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                              !isSelected && {
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
                              },
                            ]}
                          >
                            {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* Thumbnail with duration badge & tap to play video preview */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => (isBulkMode ? handleToggleSelectItem(item.id) : handleOpenStreamPreview(item))}
                        style={styles.resultThumbContainer}
                      >
                        <Image
                          source={{ uri: item.thumbnailUrl }}
                          style={styles.resultThumb}
                        />
                        <View style={styles.thumbPlayOverlay}>
                          <Ionicons name="videocam" size={20} color="#FFF" />
                        </View>
                        {item.duration && (
                          <View style={styles.resultDurationBadge}>
                            <Text style={styles.resultDurationText}>{item.duration}</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Title, Artist, & Badges */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => (isBulkMode ? handleToggleSelectItem(item.id) : handlePlayOnlineStream(item))}
                        style={styles.resultInfo}
                      >
                        <Text
                          style={[
                            styles.resultTitle,
                            { color: isThisTrackCurrent ? colors.primary : colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[styles.resultArtist, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {item.artist}
                        </Text>
                        <View style={styles.metaBadgeRow}>
                          {renderCompatibilityBadge(item)}
                          {item.viewCount && (
                            <Text
                              style={[styles.resultViews, { color: colors.textMuted }]}
                              numberOfLines={1}
                            >
                              {item.viewCount}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Action Buttons: Play + Save / Status */}
                      {!isBulkMode && (
                        <View style={styles.resultActions}>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handlePlayOnlineStream(item)}
                            disabled={isThisTrackStreaming}
                            style={[
                              styles.playPreviewBtn,
                              isThisTrackCurrent
                                ? {
                                    backgroundColor: colors.primary,
                                    borderColor: colors.primary,
                                  }
                                : {
                                    backgroundColor: isDark
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(235, 240, 248, 0.9)',
                                    borderColor: isDark
                                      ? 'rgba(255, 255, 255, 0.16)'
                                      : 'rgba(200, 212, 228, 0.6)',
                                  },
                            ]}
                          >
                            {isThisTrackStreaming ? (
                              <ActivityIndicator size="small" color={isThisTrackCurrent ? '#FFFFFF' : colors.primary} />
                            ) : isThisTrackPlaying ? (
                              <Ionicons name="pause" size={13} color={isThisTrackCurrent ? '#FFFFFF' : colors.primary} />
                            ) : (
                              <Ionicons name="play" size={13} color={isThisTrackCurrent ? '#FFFFFF' : colors.primary} />
                            )}
                          </TouchableOpacity>

                          {/* Download / Status Badge Button */}
                          {itemStatus ? (
                            <View
                              style={[
                                styles.statusBadgeBtn,
                                itemStatus.type === 'in_library' || itemStatus.type === 'completed'
                                  ? {
                                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                                      borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)',
                                    }
                                  : itemStatus.type === 'downloading' || itemStatus.type === 'resolving' || itemStatus.type === 'queued'
                                  ? {
                                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.12)',
                                      borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.3)',
                                    }
                                  : {
                                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                                      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.3)',
                                    },
                              ]}
                            >
                              <Ionicons
                                name={
                                  itemStatus.type === 'in_library' || itemStatus.type === 'completed'
                                    ? 'checkmark-circle'
                                    : itemStatus.type === 'downloading'
                                    ? 'arrow-down'
                                    : itemStatus.type === 'queued'
                                    ? 'hourglass-outline'
                                    : itemStatus.type === 'error'
                                    ? 'alert-circle'
                                    : 'sync'
                                }
                                size={11}
                                color={
                                  itemStatus.type === 'in_library' || itemStatus.type === 'completed'
                                    ? '#10B981'
                                    : itemStatus.type === 'error'
                                    ? '#EF4444'
                                    : colors.primary
                                }
                              />
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  {
                                    color:
                                      itemStatus.type === 'in_library' || itemStatus.type === 'completed'
                                        ? '#10B981'
                                        : itemStatus.type === 'error'
                                        ? '#EF4444'
                                        : colors.primary,
                                  },
                                ]}
                              >
                                {itemStatus.label}
                              </Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleOpenFormatModalForSearchResult(item)}
                              style={[
                                styles.resultDownloadBtn,
                                {
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)',
                                },
                              ]}
                            >
                              <Ionicons name="arrow-down" size={13} color={isDark ? '#FFFFFF' : colors.primary} />
                              <Text style={[styles.resultDownloadBtnText, { color: isDark ? '#FFFFFF' : colors.primary }]}>
                                Save
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : hasSearched ? (
              <View
                style={[
                  styles.emptyBox,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(255, 255, 255, 0.65)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                  },
                ]}
              >
                <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No music tracks found for "{searchQuery}". Try a different search!
                </Text>
              </View>
            ) : null}
          </View>

          {/* Downloads Queue / History */}
          <View style={styles.downloadsSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Downloads {downloads.length > 0 ? `(${downloads.length})` : ''}
              </Text>
              {downloads.some((d) => d.status === 'completed') && (
                <TouchableOpacity onPress={clearCompleted}>
                  <Text style={[styles.clearCompletedText, { color: colors.primary }]}>
                    Clear Finished
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {downloads.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(255, 255, 255, 0.65)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                  },
                ]}
              >
                <Ionicons name="cloud-download-outline" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No active or recent downloads. Search and download music above for offline playback!
                </Text>
              </View>
            ) : (
              downloads.map((item) => (
                <DownloadCard
                  key={item.id}
                  item={item}
                  onCancel={() => cancelDownload(item.id)}
                  onRemove={() => removeDownload(item.id)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Floating Bulk Action Bar */}
      {isBulkMode && selectedItemIds.length > 0 && (
        <View style={[styles.floatingBulkBarWrapper, { bottom: Platform.OS === 'ios' ? 88 : 74 }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 90 : 100}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={[
              styles.floatingBulkBar,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.95)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <View style={styles.bulkBarLeft}>
              <Text style={[styles.bulkBarCount, { color: colors.textPrimary }]}>
                {selectedItemIds.length} {selectedItemIds.length === 1 ? 'song' : 'songs'} selected
              </Text>
              <Text style={[styles.bulkBarSubtext, { color: colors.textMuted }]}>
                Parallel download queue
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleExecuteBulkDownload}
              style={[styles.bulkDownloadBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
              <Text style={styles.bulkDownloadBtnText}>
                Download ({selectedItemIds.length})
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      {/* Embedded Music Video & Stream Preview Modal */}
      <MusicVideoModal
        visible={isVideoModalVisible}
        item={previewVideoItem}
        onClose={() => {
          setIsVideoModalVisible(false);
          setPreviewVideoItem(null);
        }}
        onSaveOffline={(extractedInfo) => {
          setIsVideoModalVisible(false);
          setSelectedTrackForFormat(extractedInfo);
          setIsFormatModalVisible(true);
        }}
      />

      {/* Audio Format Selection Modal */}
      <AudioFormatModal
        visible={isFormatModalVisible}
        trackInfo={selectedTrackForFormat}
        onClose={() => {
          setIsFormatModalVisible(false);
          setSelectedTrackForFormat(null);
        }}
        onConfirmDownload={handleConfirmDownload}
        isDownloading={isStartingDownload}
      />

      {/* Storage Access & Files Permission Modal */}
      <StoragePermissionModal
        visible={isStoragePermissionModalVisible}
        onAllow={handleAllowStoragePermission}
        onCancel={() => {
          setIsStoragePermissionModalVisible(false);
          setPendingDownload(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 140,
  },
  header: {
    marginBottom: SPACING.md,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  headerBadgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  downloadsHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  adFreeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  adFreeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchGlassCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: SPACING.lg,
  },
  searchBlur: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm + 4,
    height: 48,
    marginBottom: SPACING.sm + 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: SPACING.xs + 2,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  searchSubmitWrapper: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  searchSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: RADIUS.md,
    gap: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  searchSubmitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chipsSection: {
    marginBottom: SPACING.lg,
  },
  chipsHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
    marginBottom: SPACING.xs + 2,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultsSection: {
    marginBottom: SPACING.lg,
  },
  resultsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs + 4,
  },
  resultsCountHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bulkHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  bulkHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bulkToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  bulkToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkboxContainer: {
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultsList: {
    gap: 10,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  resultThumbContainer: {
    position: 'relative',
    width: 62,
    height: 62,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  resultThumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlayOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultDurationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  resultDurationText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
    marginLeft: SPACING.sm + 2,
    marginRight: SPACING.xs,
    justifyContent: 'center',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  resultArtist: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  compatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  compatBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  resultViews: {
    fontSize: 10,
    fontWeight: '400',
  },
  resultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  playPreviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 3,
  },
  resultDownloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 3,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  downloadsSection: {
    marginTop: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  clearCompletedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: SPACING.xs,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  floatingBulkBarWrapper: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
  },
  floatingBulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  bulkBarLeft: {
    flex: 1,
  },
  bulkBarCount: {
    fontSize: 14,
    fontWeight: '800',
  },
  bulkBarSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  bulkDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  bulkDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  clipboardBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clipboardBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  clipboardBannerTextContainer: {
    flex: 1,
  },
  clipboardBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  clipboardBannerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  clipboardBannerClose: {
    padding: 4,
  },
});
