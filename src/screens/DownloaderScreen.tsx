import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDownloads } from '../context/DownloadContext';
import { useLibrary } from '../context/LibraryContext';
import { useTheme } from '../context/ThemeContext';
import { ExtractedInfo } from '../services/downloaderService';
import { youtubeSearchService, SearchResultItem } from '../services/youtubeSearchService';
import { storageService } from '../services/storageService';
import { DownloadCard } from '../components/DownloadCard';
import { LiquidBackground } from '../components/LiquidBackground';
import { AudioFormatModal } from '../components/AudioFormatModal';
import { StoragePermissionModal } from '../components/StoragePermissionModal';
import { MusicVideoModal } from '../components/MusicVideoModal';
import { SPACING, RADIUS } from '../constants/theme';
import { QUICK_SEARCH_CHIPS, AudioFormat } from '../constants/endpoints';

export const DownloaderScreen: React.FC = () => {
  const {
    downloads,
    activeCount,
    openDownloadsModal,
    addDownload,
    cancelDownload,
    removeDownload,
    clearCompleted,
  } = useDownloads();
  const { refreshLibrary } = useLibrary();
  const { colors, isDark } = useTheme();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

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

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (!q) return;

    Keyboard.dismiss();
    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await youtubeSearchService.search(q);
      setSearchResults(results);
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
      setIsStartingDownload(true);
      setIsFormatModalVisible(false);
      setSelectedTrackForFormat(null);
      setPendingDownload(null);

      await addDownload(info, format);
      await refreshLibrary();
    } catch (error: any) {
      Alert.alert('Download Error', error?.message || 'Failed to download audio track.');
    } finally {
      setIsStartingDownload(false);
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
                <Ionicons name="search" size={20} color={isDark ? '#FFFFFF' : colors.primary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  placeholder="Search song, artist, album, or paste URL..."
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
                <Text style={[styles.resultsCountHeader, { color: colors.textSecondary }]}>
                  FOUND {searchResults.length} TRACKS
                </Text>

                {searchResults.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.resultCard,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(255, 255, 255, 0.65)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(200, 212, 228, 0.5)',
                        shadowColor: isDark ? '#000' : '#8CA0BA',
                      },
                    ]}
                  >
                    {/* Thumbnail with duration badge & tap to play video preview */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenStreamPreview(item)}
                      style={styles.resultThumbContainer}
                    >
                      <Image
                        source={{ uri: item.thumbnailUrl }}
                        style={styles.resultThumb}
                      />
                      <View style={styles.thumbPlayOverlay}>
                        <Ionicons name="play-circle" size={24} color="#FFF" />
                      </View>
                      {item.duration && (
                        <View style={styles.resultDurationBadge}>
                          <Text style={styles.resultDurationText}>{item.duration}</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Title & Artist (Tap to Play Preview) */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleOpenStreamPreview(item)}
                      style={styles.resultInfo}
                    >
                      <Text
                        style={[styles.resultTitle, { color: colors.textPrimary }]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[styles.resultArtist, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {item.artist}
                      </Text>
                      {item.viewCount && (
                        <Text
                          style={[styles.resultViews, { color: colors.textMuted }]}
                          numberOfLines={1}
                        >
                          {item.viewCount}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Action Buttons: [ ▶ Play ] + [ ⬇ Save ] */}
                    <View style={styles.resultActions}>
                      {/* Play Preview Button */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleOpenStreamPreview(item)}
                        style={[
                          styles.playPreviewBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(235, 240, 248, 0.9)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.16)'
                              : 'rgba(200, 212, 228, 0.6)',
                          },
                        ]}
                      >
                        <Ionicons name="play" size={13} color={colors.primary} />
                        <Text style={[styles.playPreviewBtnText, { color: colors.primary }]}>
                          Play
                        </Text>
                      </TouchableOpacity>

                      {/* Save / Download Button */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleOpenFormatModalForSearchResult(item)}
                        style={[
                          styles.resultDownloadBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0, 0, 0, 0.06)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.2)'
                              : 'rgba(0, 0, 0, 0.12)',
                          },
                        ]}
                      >
                        <Ionicons name="arrow-down" size={13} color={isDark ? '#FFFFFF' : colors.primary} />
                        <Text style={[styles.resultDownloadBtnText, { color: isDark ? '#FFFFFF' : colors.primary }]}>
                          Save
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
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
  resultsCountHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs + 4,
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
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  resultArtist: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 1,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
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
});
