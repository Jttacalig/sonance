import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { TrackItem } from '../components/TrackItem';
import { TrackOptionsModal } from '../components/TrackOptionsModal';
import { TransferConfirmationModal } from '../components/TransferConfirmationModal';
import { LiquidBackground } from '../components/LiquidBackground';
import { Track } from '../types/music';
import { CandidateFile } from '../services/fileImportService';
import { SPACING, RADIUS } from '../constants/theme';

type FilterTab = 'all' | 'favorites' | 'imported' | 'recent';
type SortOption = 'date_desc' | 'date_asc' | 'alpha_asc' | 'alpha_desc';

interface LibraryScreenProps {
  onNavigateToDownloader?: () => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ onNavigateToDownloader }) => {
  const {
    tracks,
    favorites,
    isLoading,
    refreshLibrary,
    toggleFavorite,
    scanCandidateFiles,
    pickCandidateFiles,
    transferCandidateFiles,
    cleanupCandidateFiles,
  } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);
  const [selectedTrackForOptions, setSelectedTrackForOptions] = useState<Track | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const flatListRef = React.useRef<FlatList<Track>>(null);

  // Load saved sort option on mount
  React.useEffect(() => {
    AsyncStorage.getItem('librarySortOption').then((saved) => {
      if (saved) {
        setSortOption(saved as SortOption);
      }
    }).catch(() => {});
  }, []);

  const handleSortChange = (newSort: SortOption) => {
    setSortOption(newSort);
    setIsSortMenuVisible(false);
    AsyncStorage.setItem('librarySortOption', newSort).catch(() => {});
  };

  // Transfer Modal states
  const [candidateModalVisible, setCandidateModalVisible] = useState(false);
  const [candidates, setCandidates] = useState<CandidateFile[]>([]);
  const [candidateSkippedCount, setCandidateSkippedCount] = useState(0);
  const [candidateSourceType, setCandidateSourceType] = useState<'autoscan' | 'picker'>('autoscan');
  const [isTransferring, setIsTransferring] = useState(false);

  const filteredTracks = useMemo(() => {
    let list: Track[] = [];

    switch (activeTab) {
      case 'favorites':
        list = [...favorites];
        break;
      case 'imported':
        list = tracks.filter((t) => t.sourceType === 'imported');
        break;
      case 'recent':
        list = [...tracks];
        break;
      case 'all':
      default:
        list = [...tracks];
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q))
      );
    }

    if (activeTab === 'recent') {
      list.sort((a, b) => b.dateAdded - a.dateAdded);
    } else {
      list.sort((a, b) => {
        if (sortOption === 'date_desc') return b.dateAdded - a.dateAdded;
        if (sortOption === 'date_asc') return a.dateAdded - b.dateAdded;
        if (sortOption === 'alpha_asc') return a.title.localeCompare(b.title);
        if (sortOption === 'alpha_desc') return b.title.localeCompare(a.title);
        return 0;
      });
    }

    return list;
  }, [tracks, favorites, activeTab, searchQuery, sortOption]);

  const handlePlayAll = (shuffle = false) => {
    if (filteredTracks.length === 0) return;
    if (shuffle) {
      const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      playTrack(filteredTracks[0], filteredTracks);
    }
  };

  const scrollToCurrentTrack = () => {
    if (!currentTrack) return;
    const index = filteredTracks.findIndex((t) => t.id === currentTrack.id);
    if (index !== -1) {
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } else {
      Alert.alert('Not Found', 'The currently playing track is not in the current view.');
    }
  };

  const handleAutoScan = async () => {
    try {
      setIsScanning(true);
      const res = await scanCandidateFiles();
      if (res.candidates.length > 0) {
        setCandidates(res.candidates);
        setCandidateSkippedCount(res.skippedCount);
        setCandidateSourceType('autoscan');
        setCandidateModalVisible(true);
      } else if (res.foundCount > 0) {
        Alert.alert(
          'Library Up to Date',
          `Scanned ${res.foundCount} audio file(s). All songs are already organized in your Sonance Music Folder. No duplicate songs were added.`
        );
      } else {
        Alert.alert(
          'No Local Files Found',
          'No audio files found in local storage. Drop songs into the "Sonance" folder in Files or choose "Browse & Select Files" to import from iCloud Drive.'
        );
      }
    } catch (e: any) {
      Alert.alert('Scan Failed', e?.message || 'Could not scan local audio files.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleBrowseImport = async () => {
    try {
      setIsScanning(true);
      const res = await pickCandidateFiles();
      if (res.canceled) return;

      if (res.candidates.length > 0) {
        setCandidates(res.candidates);
        setCandidateSkippedCount(res.skippedCount);
        setCandidateSourceType('picker');
        setCandidateModalVisible(true);
      } else if (res.skippedCount > 0) {
        Alert.alert(
          'Duplicate Detected',
          `All ${res.skippedCount} selected file(s) are already in your Sonance Music Folder. No duplicates were added.`
        );
      }
    } catch (e: any) {
      Alert.alert('Import Failed', e?.message || 'Could not import audio files.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (candidates.length === 0) return;
    try {
      setIsTransferring(true);
      const importedTracks = await transferCandidateFiles(candidates);
      setCandidateModalVisible(false);
      Alert.alert(
        'Transfer Complete',
        `Successfully transferred ${importedTracks.length} song(s) into your Sonance Music Folder!${
          candidateSkippedCount > 0 ? ` (${candidateSkippedCount} duplicate(s) skipped)` : ''
        }`
      );
      setCandidates([]);
      setCandidateSkippedCount(0);
    } catch (e: any) {
      Alert.alert('Transfer Error', e?.message || 'Failed to transfer songs to folder.');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCancelTransfer = () => {
    if (candidates.length > 0) {
      cleanupCandidateFiles(candidates);
    }
    setCandidateModalVisible(false);
    setCandidates([]);
    setCandidateSkippedCount(0);
  };

  const handleOpenImportMenu = () => {
    Alert.alert(
      'Add Music to Sonance',
      'Select how you want to add music to your offline library:',
      [
        {
          text: '🔍 Auto-Scan Phone for Songs',
          onPress: handleAutoScan,
        },
        {
          text: '📁 Browse & Select Files',
          onPress: handleBrowseImport,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LiquidBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Sleek Minimal Branding Header with Official Wordmark Logo */}
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <View style={styles.brandTitleRow}>
              <Image
                source={
                  isDark
                    ? require('../../assets/sonance-logo-white.png')
                    : require('../../assets/sonance-logo-black.png')
                }
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.textPrimary }]}>
                  {tracks.length}
                </Text>
              </View>
            </View>
            <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>
              MUSIC PLAYER
            </Text>
          </View>

          {/* Action Button: Auto-Scan & Import */}
          <TouchableOpacity
            style={styles.headerIconBtnWrapper}
            onPress={handleOpenImportMenu}
            disabled={isScanning || isTransferring}
            activeOpacity={0.8}
            accessibilityLabel="Add Music"
          >
            <View
              style={[
                styles.headerIconBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.85)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
                  shadowColor: isDark ? '#000' : '#8CA0BA',
                },
              ]}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : colors.primary} />
              ) : (
                <Ionicons name="add" size={22} color={isDark ? '#FFFFFF' : colors.primary} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Compact Integrated Glass Control Bar (Search + Play + Shuffle) */}
        <View style={styles.compactControlBar}>
          {/* Frosted Glass Search Capsule */}
          <View
            style={[
              styles.searchCapsule,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 85 : 100}
              tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
              style={styles.searchBlur}
            >
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search songs, artists, albums..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </BlurView>
          </View>

          {/* Quick Play Icon Button */}
          {filteredTracks.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.iconBtnWrapper}
                onPress={() => handlePlayAll(false)}
                activeOpacity={0.8}
                accessibilityLabel="Play All"
              >
                <View
                  style={[
                    styles.playIconBtn,
                    {
                      backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                      shadowColor: isDark ? '#FFFFFF' : colors.primary,
                    },
                  ]}
                >
                  <Ionicons name="play" size={18} color={isDark ? '#070A10' : '#FFF'} style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>

              {/* Quick Shuffle Icon Button */}
              <TouchableOpacity
                style={[
                  styles.shuffleIconBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.09)'
                      : 'rgba(255, 255, 255, 0.75)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : '#FFFFFF',
                    shadowColor: isDark ? '#000' : '#8CA0BA',
                  },
                ]}
                onPress={() => handlePlayAll(true)}
                activeOpacity={0.8}
                accessibilityLabel="Shuffle"
              >
                <Ionicons name="shuffle" size={18} color={isDark ? '#FFFFFF' : colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Micro Filter Pills */}
        <View style={styles.tabsRow}>
          {(
            [
              { key: 'all', label: 'All Songs' },
              { key: 'favorites', label: '★ Favs (' + favorites.length + ')' },
              { key: 'imported', label: 'Files' },
              { key: 'recent', label: 'Recent' },
            ] as { key: FilterTab; label: string }[]
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.22)'
                        : 'rgba(0, 0, 0, 0.08)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.65)',
                    borderColor: isActive
                      ? (isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.2)')
                      : isDark
                      ? 'rgba(255, 255, 255, 0.16)'
                      : '#FFFFFF',
                    shadowColor: isDark ? '#000' : '#8CA0BA',
                  },
                ]}
                onPress={() => {
                  if (Haptics.impactAsync) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }
                  setActiveTab(tab.key);
                }}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    { color: isActive ? (isDark ? '#FFFFFF' : '#000000') : colors.textSecondary },
                    isActive && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action Row: Locate & Sort */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { opacity: currentTrack ? 1 : 0.5 }]}
            onPress={scrollToCurrentTrack}
            disabled={!currentTrack}
          >
            <Ionicons name="locate" size={16} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Locate Playing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setIsSortMenuVisible(true)}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.textPrimary} />
            <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
              {sortOption === 'date_desc' ? 'Newest First' : sortOption === 'date_asc' ? 'Oldest First' : sortOption === 'alpha_asc' ? 'A-Z' : 'Z-A'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Songs List */}
        <FlatList
          ref={flatListRef}
          data={filteredTracks}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshLibrary}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              isCurrent={currentTrack?.id === item.id}
              isPlaying={isPlaying && currentTrack?.id === item.id}
              onPress={() => playTrack(item, filteredTracks)}
              onFavoritePress={() => toggleFavorite(item.id)}
              onOptionsPress={() => setSelectedTrackForOptions(item)}
            />
          )}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise((resolve) => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            });
          }}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <Ionicons name="musical-notes-outline" size={40} color={isDark ? '#FFFFFF' : colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {searchQuery ? 'No matching songs found' : 'Your Library is Empty'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? 'Try searching with a different keyword.'
                    : 'Auto-scan your phone storage for music, import files from iCloud/Files, or download from YouTube!'}
                </Text>
                {!searchQuery && (
                  <View style={styles.emptyActionsRow}>
                    {/* Auto-Scan Button */}
                    <TouchableOpacity
                      style={styles.emptyCtaWrapper}
                      onPress={handleAutoScan}
                      disabled={isScanning || isTransferring}
                    >
                      <View
                        style={[
                          styles.emptyCtaBtn,
                          {
                            backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                            shadowColor: isDark ? '#FFF' : colors.primary,
                          },
                        ]}
                      >
                        {isScanning ? (
                          <ActivityIndicator size="small" color={isDark ? '#000' : '#FFF'} />
                        ) : (
                          <>
                            <Ionicons name="scan-outline" size={18} color={isDark ? '#000' : '#FFF'} />
                            <Text style={[styles.emptyCtaText, { color: isDark ? '#000' : '#FFF' }]}>
                              Auto-Scan Phone
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Choose Files Button */}
                    <TouchableOpacity
                      style={[
                        styles.emptyCtaBtn,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(255, 255, 255, 0.75)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF',
                          shadowColor: isDark ? '#000' : '#8CA0BA',
                        },
                      ]}
                      onPress={handleBrowseImport}
                      disabled={isScanning || isTransferring}
                    >
                      <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
                      <Text style={[styles.emptySecondaryText, { color: colors.primary }]}>
                        Browse Files (iCloud / Local)
                      </Text>
                    </TouchableOpacity>

                    {/* Go to Downloader Button */}
                    {onNavigateToDownloader && (
                      <TouchableOpacity
                        style={[
                          styles.emptyCtaBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(255, 255, 255, 0.65)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(200, 212, 228, 0.5)',
                          },
                        ]}
                        onPress={onNavigateToDownloader}
                      >
                        <Ionicons name="search" size={18} color={colors.textSecondary} />
                        <Text style={[styles.emptySecondaryText, { color: colors.textSecondary }]}>
                          Search & Add Music
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ) : null
          }
        />

        {/* Sort Modal */}
        {isSortMenuVisible && (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={() => setIsSortMenuVisible(false)} 
            />
            <View style={[styles.sortModalContainer, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
              <View style={styles.sortModalHeader}>
                <Text style={[styles.sortModalTitle, { color: colors.textPrimary }]}>Sort Library</Text>
                <TouchableOpacity onPress={() => setIsSortMenuVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.sortOptionRow} onPress={() => handleSortChange('date_desc')}>
                <Text style={[styles.sortOptionText, { color: colors.textPrimary }]}>Date Added (Newest First)</Text>
                {sortOption === 'date_desc' && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortOptionRow} onPress={() => handleSortChange('date_asc')}>
                <Text style={[styles.sortOptionText, { color: colors.textPrimary }]}>Date Added (Oldest First)</Text>
                {sortOption === 'date_asc' && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortOptionRow} onPress={() => handleSortChange('alpha_asc')}>
                <Text style={[styles.sortOptionText, { color: colors.textPrimary }]}>Alphabetical (A to Z)</Text>
                {sortOption === 'alpha_asc' && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortOptionRow} onPress={() => handleSortChange('alpha_desc')}>
                <Text style={[styles.sortOptionText, { color: colors.textPrimary }]}>Alphabetical (Z to A)</Text>
                {sortOption === 'alpha_desc' && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Transfer Confirmation Modal */}
        <TransferConfirmationModal
          visible={candidateModalVisible}
          candidates={candidates}
          skippedCount={candidateSkippedCount}
          sourceType={candidateSourceType}
          isTransferring={isTransferring}
          onConfirm={handleConfirmTransfer}
          onCancel={handleCancelTransfer}
        />

        {/* Track Options Action Sheet */}
        <TrackOptionsModal
          visible={!!selectedTrackForOptions}
          track={selectedTrackForOptions}
          onClose={() => setSelectedTrackForOptions(null)}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  brandContainer: {
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoImage: {
    width: 140,
    height: 24,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginTop: 2,
    marginLeft: 2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  headerIconBtnWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  compactControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    marginVertical: SPACING.xs + 2,
  },
  searchCapsule: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchBlur: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  iconBtnWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  playIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  shuffleIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    gap: 6,
    marginBottom: SPACING.xs,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: 180,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xl,
    fontWeight: '500',
  },
  emptyActionsRow: {
    gap: SPACING.md,
    width: '100%',
  },
  emptyCtaWrapper: {
    width: '100%',
    borderRadius: RADIUS.full,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    width: '100%',
    borderWidth: 1.4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  emptySecondaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sortModalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: 110, // Extra padding to clear the floating tab bar
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
