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
import { SPACING, RADIUS } from '../constants/theme';
import { QUICK_SEARCH_CHIPS, AudioFormat } from '../constants/endpoints';

export const DownloaderScreen: React.FC = () => {
  const { downloads, addDownload, cancelDownload, removeDownload, clearCompleted } = useDownloads();
  const { refreshLibrary } = useLibrary();
  const { colors, isDark } = useTheme();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

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

  const handleOpenFormatModalForSearchResult = (item: SearchResultItem) => {
    const info: ExtractedInfo = {
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl,
      sourceType: 'youtube',
      duration: item.durationSec,
      durationText: item.duration,
      format: 'm4a',
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

          {/* Search Glass Input Card */}
          <View
            style={[
              styles.searchGlassCard,
              {
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.searchBlur}
            >
              <View
                style={[
                  styles.searchInputRow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 0, 0, 0.25)'
                      : 'rgba(255, 255, 255, 0.65)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(200, 212, 228, 0.5)',
                  },
                ]}
              >
                <Ionicons name="search" size={20} color={colors.primary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  placeholder="Search song, artist, album, or track..."
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
                <LinearGradient
                  colors={[colors.primary, '#FF007A', colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.searchSubmitBtn,
                    { shadowColor: colors.primary },
                    !searchQuery.trim() && styles.disabledBtn,
                  ]}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="search" size={16} color="#FFF" />
                      <Text style={styles.searchSubmitText}>Add Music</Text>
                    </>
                  )}
                </LinearGradient>
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
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.75)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
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
                  Searching high-quality music streams...
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
                    {/* Thumbnail with duration badge */}
                    <View style={styles.resultThumbContainer}>
                      <Image
                        source={{ uri: item.thumbnailUrl }}
                        style={styles.resultThumb}
                      />
                      {item.duration && (
                        <View style={styles.resultDurationBadge}>
                          <Text style={styles.resultDurationText}>{item.duration}</Text>
                        </View>
                      )}
                    </View>

                    {/* Title & Artist */}
                    <View style={styles.resultInfo}>
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
                    </View>

                    {/* Frosted Glass Download Button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenFormatModalForSearchResult(item)}
                      style={[
                        styles.resultDownloadBtn,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 51, 92, 0.18)'
                            : 'rgba(255, 46, 85, 0.12)',
                          borderColor: isDark
                            ? 'rgba(255, 51, 92, 0.4)'
                            : 'rgba(255, 46, 85, 0.3)',
                        },
                      ]}
                    >
                      <Ionicons name="arrow-down" size={18} color={colors.primary} />
                      <Text style={[styles.resultDownloadBtnText, { color: colors.primary }]}>
                        Format
                      </Text>
                    </TouchableOpacity>
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
                  No active or recent songs. Search and add music above for offline playback!
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
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 180,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  adFreeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  adFreeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  searchGlassCard: {
    borderRadius: RADIUS.clay,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBlur: {
    padding: SPACING.md + 2,
    overflow: 'hidden',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1.2,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 14,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 2,
  },
  searchSubmitWrapper: {
    borderRadius: RADIUS.full,
  },
  searchSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  searchSubmitText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  chipsSection: {
    marginBottom: SPACING.lg,
  },
  chipsHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs + 2,
  },
  chipsScroll: {
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  quickChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultsSection: {
    marginBottom: SPACING.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultsCountHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  resultsList: {
    gap: SPACING.sm + 2,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  resultThumbContainer: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  resultThumb: {
    width: '100%',
    height: '100%',
  },
  resultDurationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  resultDurationText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  resultInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 2,
  },
  resultArtist: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  resultViews: {
    fontSize: 11,
    fontWeight: '500',
  },
  resultDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
  },
  resultDownloadBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  downloadsSection: {
    marginTop: SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  clearCompletedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    borderRadius: RADIUS.clay,
    borderWidth: 1.4,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});
