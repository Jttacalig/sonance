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
  } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackForOptions, setSelectedTrackForOptions] = useState<Track | null>(null);
  const [isScanning, setIsScanning] = useState(false);

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
        list = favorites;
        break;
      case 'imported':
        list = tracks.filter((t) => t.sourceType === 'imported');
        break;
      case 'recent':
        list = [...tracks].sort((a, b) => b.dateAdded - a.dateAdded);
        break;
      case 'all':
      default:
        list = tracks;
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

    return list;
  }, [tracks, favorites, activeTab, searchQuery]);

  const handlePlayAll = (shuffle = false) => {
    if (filteredTracks.length === 0) return;
    if (shuffle) {
      const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      playTrack(filteredTracks[0], filteredTracks);
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
                      ? 'rgba(255, 51, 92, 0.16)'
                      : 'rgba(255, 46, 85, 0.12)',
                    borderColor: isDark ? 'rgba(255, 51, 92, 0.35)' : 'rgba(255, 46, 85, 0.3)',
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.primary }]}>
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
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.05)']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 245, 255, 0.8)']
              }
              style={[
                styles.headerIconBtn,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
                  shadowColor: isDark ? '#000' : '#8CA0BA',
                },
              ]}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="add" size={22} color={colors.primary} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Compact Integrated Glass Control Bar (Search + Play + Shuffle) */}
        <View style={styles.compactControlBar}>
          {/* Frosted Glass Search Capsule */}
          <View
            style={[
              styles.searchCapsule,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
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
                <LinearGradient
                  colors={[colors.primary, '#FF007A', colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.playIconBtn, { shadowColor: colors.primary }]}
                >
                  <Ionicons name="play" size={18} color="#FFF" style={{ marginLeft: 2 }} />
                </LinearGradient>
              </TouchableOpacity>

              {/* Quick Shuffle Icon Button */}
              <TouchableOpacity
                style={[
                  styles.shuffleIconBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.75)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#FFFFFF',
                    shadowColor: isDark ? '#000' : '#8CA0BA',
                  },
                ]}
                onPress={() => handlePlayAll(true)}
                activeOpacity={0.8}
                accessibilityLabel="Shuffle"
              >
                <Ionicons name="shuffle" size={18} color={colors.primary} />
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
                        ? 'rgba(255, 51, 92, 0.22)'
                        : 'rgba(255, 46, 85, 0.14)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(255, 255, 255, 0.65)',
                    borderColor: isActive
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
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
                    { color: isActive ? colors.primary : colors.textSecondary },
                    isActive && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Songs List */}
        <FlatList
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
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(255, 51, 92, 0.2)', 'rgba(139, 92, 246, 0.1)']
                      : ['rgba(255, 46, 85, 0.14)', 'rgba(0, 180, 216, 0.08)']
                  }
                  style={styles.emptyIconCircle}
                >
                  <Ionicons name="musical-notes-outline" size={40} color={colors.primary} />
                </LinearGradient>
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
                      <LinearGradient
                        colors={[colors.primary, '#FF007A', colors.primaryDark]}
                        style={[styles.emptyCtaBtn, { shadowColor: colors.primary }]}
                      >
                        <Ionicons name="scan-outline" size={18} color="#FFF" />
                        <Text style={styles.emptyCtaText}>Auto-Scan Phone for Songs</Text>
                      </LinearGradient>
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
});
