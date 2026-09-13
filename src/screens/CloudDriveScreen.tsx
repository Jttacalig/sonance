import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { CloudProviderType, UnifiedCloudItem, CloudAccountInfo } from '../types/music';
import { cloudStorageService } from '../services/cloudStorageService';
import { googleDriveService } from '../services/googleDriveService';
import { dropboxService } from '../services/dropboxService';
import { oneDriveService } from '../services/oneDriveService';
import { webDavService } from '../services/webDavService';
import { fileImportService, CandidateFile } from '../services/fileImportService';
import { TransferConfirmationModal } from '../components/TransferConfirmationModal';
import { CloudConnectModal } from '../components/CloudConnectModal';
import { SPACING, RADIUS } from '../constants/theme';

interface BreadcrumbItem {
  id: string;
  name: string;
  path?: string;
}

const PROVIDERS: { id: CloudProviderType; label: string; icon: any; color: string }[] = [
  { id: 'gdrive', label: 'Google Drive', icon: 'logo-google', color: '#4285F4' },
  { id: 'dropbox', label: 'Dropbox', icon: 'logo-dropbox', color: '#0061FF' },
  { id: 'onedrive', label: 'OneDrive', icon: 'cloudy', color: '#0078D4' },
  { id: 'webdav', label: 'WebDAV / NAS', icon: 'server', color: '#00A86B' },
];

export const CloudDriveScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    refreshLibrary,
    scanCandidateFiles,
    pickCandidateFiles,
    transferCandidateFiles,
    cleanupCandidateFiles,
  } = useLibrary();
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  // Active Provider Tab
  const [activeTab, setActiveTab] = useState<CloudProviderType>('gdrive');

  // Connection states
  const [connectedAccounts, setConnectedAccounts] = useState<CloudAccountInfo[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Cloud Explorer State
  const [items, setItems] = useState<UnifiedCloudItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'Root', path: '' },
  ]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Connect Modal State
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<CloudProviderType | null>(null);

  // Local File Transfer Modal States
  const [candidateModalVisible, setCandidateModalVisible] = useState(false);
  const [candidates, setCandidates] = useState<CandidateFile[]>([]);
  const [candidateSkippedCount, setCandidateSkippedCount] = useState(0);
  const [candidateSourceType, setCandidateSourceType] = useState<'autoscan' | 'picker'>('picker');
  const [isTransferring, setIsTransferring] = useState(false);

  // Sync Folder State
  const [isSyncingFolder, setIsSyncingFolder] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');

  // Initial load
  useEffect(() => {
    checkAllConnections();
  }, []);

  const checkAllConnections = async () => {
    try {
      setIsAuthLoading(true);
      const accounts = await cloudStorageService.getConnectedAccounts();
      setConnectedAccounts(accounts);

      // If current active tab is connected, load its root folder
      const isCurrentConnected = accounts.some((a) => a.provider === activeTab);
      if (isCurrentConnected) {
        loadFolder(activeTab, 'root', '');
      } else {
        setItems([]);
        setBreadcrumbs([{ id: 'root', name: 'Root', path: '' }]);
      }
    } catch (e) {
      console.warn('Failed to check cloud connections:', e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const currentAccount = connectedAccounts.find((a) => a.provider === activeTab);
  const isCurrentConnected = !!currentAccount;

  const handleTabChange = (provider: CloudProviderType) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setActiveTab(provider);
    setBreadcrumbs([{ id: 'root', name: getProviderRootName(provider), path: '' }]);

    const account = connectedAccounts.find((a) => a.provider === provider);
    if (account) {
      loadFolder(provider, 'root', '');
    } else {
      setItems([]);
    }
  };

  const getProviderRootName = (provider: CloudProviderType) => {
    switch (provider) {
      case 'gdrive':
        return 'My Drive';
      case 'dropbox':
        return 'Dropbox';
      case 'onedrive':
        return 'OneDrive';
      case 'webdav':
        return 'Server Root';
      default:
        return 'Cloud';
    }
  };

  const loadFolder = async (provider: CloudProviderType, folderId: string, path = '') => {
    try {
      setIsLoadingItems(true);
      const res = await cloudStorageService.listFolder(provider, path || folderId);
      setItems(res);
    } catch (err: any) {
      Alert.alert('Cloud Error', err?.message || 'Failed to load folder contents.');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleNavigateToFolder = (folderItem: UnifiedCloudItem) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const newBreadcrumb: BreadcrumbItem = {
      id: folderItem.id,
      name: folderItem.name,
      path: folderItem.path || folderItem.id,
    };
    setBreadcrumbs((prev) => [...prev, newBreadcrumb]);
    loadFolder(activeTab, folderItem.id, folderItem.path || folderItem.id);
  };

  const handleBreadcrumbPress = (index: number) => {
    if (index === breadcrumbs.length - 1) return;
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    loadFolder(activeTab, target.id, target.path || target.id);
  };

  const handleSyncCurrentFolder = async () => {
    const currentCrumb = breadcrumbs[breadcrumbs.length - 1];
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      setIsSyncingFolder(true);
      setSyncStatusText(`Scanning "${currentCrumb.name}" and subfolders...`);
      const res = await cloudStorageService.syncFolderRecursively(
        activeTab,
        currentCrumb.path || currentCrumb.id,
        currentCrumb.name,
        (scanned, added) => {
          setSyncStatusText(`Scanned ${scanned} folder(s) • Found ${added} audio track(s)`);
        }
      );

      await refreshLibrary();

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert(
        '✨ Folder Synced to Sonance',
        `Successfully synced ${res.syncedCount} song(s) from "${currentCrumb.name}"!\n\nAll songs are indexed in your Sonance Library and streamable with 0 MB storage taken.`
      );
    } catch (err: any) {
      Alert.alert('Sync Error', err?.message || 'Failed to sync folder.');
    } finally {
      setIsSyncingFolder(false);
      setSyncStatusText('');
    }
  };

  const handleResyncAllFolders = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      setIsSyncingFolder(true);
      setSyncStatusText('Re-syncing all registered cloud folders...');
      const res = await cloudStorageService.resyncAllProviders((prov, folderName, scanned, added) => {
        setSyncStatusText(`[${prov}] "${folderName}" (${scanned} folders, ${added} songs)...`);
      });

      await refreshLibrary();

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert('Sync Complete', `Synced all cloud folders! Found ${res.totalSynced} new/updated track(s).`);
    } catch (err: any) {
      Alert.alert('Re-sync Error', err?.message || 'Failed to re-sync folders.');
    } finally {
      setIsSyncingFolder(false);
      setSyncStatusText('');
    }
  };

  const handlePlayDriveFile = async (item: UnifiedCloudItem) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      setStreamingId(item.id);
      const streamTrack = await cloudStorageService.getStreamableTrack(activeTab, item);
      await playTrack(streamTrack, [streamTrack]);
    } catch (err: any) {
      Alert.alert('Playback Error', err?.message || 'Failed to stream cloud track.');
    } finally {
      setStreamingId(null);
    }
  };

  const handleAddCloudTrackToLibrary = async (item: UnifiedCloudItem) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      const streamTrack = await cloudStorageService.getStreamableTrack(activeTab, item);
      const { storageService } = await import('../services/storageService');
      await storageService.saveTrack(streamTrack);
      await refreshLibrary();

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert(
        'Bookmarked to Library',
        `"${streamTrack.title}" added to your Sonance Library! (0 MB storage taken)`
      );
    } catch (err: any) {
      Alert.alert('Bookmark Failed', err?.message || 'Failed to add cloud track.');
    }
  };

  const handleDownloadFile = async (item: UnifiedCloudItem) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      setDownloadingId(item.id);
      setDownloadProgress(0);

      const downloadedTrack = await cloudStorageService.downloadFile(activeTab, item, (p) => {
        setDownloadProgress(p);
      });

      await refreshLibrary();

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert(
        'Download Complete',
        `"${downloadedTrack.title}" is now available offline in your Library!`
      );
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Failed to download audio file.');
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      `Disconnect ${activeTab.toUpperCase()}`,
      `Are you sure you want to disconnect your ${activeTab.toUpperCase()} account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await cloudStorageService.disconnectProvider(activeTab);
            await checkAllConnections();
          },
        },
      ]
    );
  };

  const handleOpenConnectModal = (provider: CloudProviderType) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setConnectingProvider(provider);
    setConnectModalVisible(true);
  };

  // Local file import handlers
  const handleBrowseFiles = async () => {
    try {
      const res = await pickCandidateFiles();
      if (res.canceled) return;
      if (res.candidates.length > 0) {
        setCandidates(res.candidates);
        setCandidateSkippedCount(res.skippedCount);
        setCandidateSourceType('picker');
        setCandidateModalVisible(true);
      } else if (res.skippedCount > 0) {
        Alert.alert('Duplicates Detected', `All ${res.skippedCount} selected file(s) are already in your Library.`);
      }
    } catch (e: any) {
      Alert.alert('Browse Error', e?.message || 'Failed to pick files.');
    }
  };

  const handleAutoScanFolder = async () => {
    try {
      const res = await scanCandidateFiles();
      if (res.candidates.length > 0) {
        setCandidates(res.candidates);
        setCandidateSkippedCount(res.skippedCount);
        setCandidateSourceType('autoscan');
        setCandidateModalVisible(true);
      } else if (res.foundCount > 0) {
        Alert.alert('Library Up to Date', `All ${res.foundCount} file(s) in Sonance folder are already indexed.`);
      } else {
        Alert.alert('No Files Found', 'Drop audio files into the Sonance folder in Files app.');
      }
    } catch (e: any) {
      Alert.alert('Scan Error', e?.message || 'Failed to scan storage.');
    }
  };

  const handleConfirmTransfer = async () => {
    if (candidates.length === 0) return;
    try {
      setIsTransferring(true);
      const importedTracks = await transferCandidateFiles(candidates);
      setCandidateModalVisible(false);
      Alert.alert('Import Complete', `Successfully imported ${importedTracks.length} song(s) into your Sonance Library!`);
      setCandidates([]);
      setCandidateSkippedCount(0);
    } catch (e: any) {
      Alert.alert('Import Error', e?.message || 'Failed to transfer files.');
    } finally {
      setIsTransferring(false);
    }
  };

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];
  const activeProviderMeta = PROVIDERS.find((p) => p.id === activeTab) || PROVIDERS[0];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Cloud & Files</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            VLC-Style Cloud Storage • Stream with 0 MB storage
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 130 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            isCurrentConnected ? (
              <RefreshControl
                refreshing={isLoadingItems}
                onRefresh={() => loadFolder(activeTab, currentFolder.id, currentFolder.path || currentFolder.id)}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {/* Quick Import Actions */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Fast Import</Text>

          <View style={styles.cardsRow}>
            {/* Native Files / iCloud / Drive */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.65)',
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 255, 255, 0.95)',
                },
              ]}
              onPress={handleBrowseFiles}
              activeOpacity={0.75}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 70 : 85}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.72)' },
                  ]}
                />
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                      : ['rgba(255, 255, 255, 0.90)', 'rgba(240, 245, 255, 0.60)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.cardInner}>
                  <View style={styles.glassIconRoundelBlue}>
                    <Ionicons name="folder-open" size={22} color="#007AFF" />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Browse Files</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                    iCloud, Drive & Local
                  </Text>
                  <View style={styles.crystalBadgeBlue}>
                    <Text style={styles.crystalBadgeTextBlue}>Zero Setup</Text>
                  </View>
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Auto-Scan Folder */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.65)',
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 255, 255, 0.95)',
                },
              ]}
              onPress={handleAutoScanFolder}
              activeOpacity={0.75}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 70 : 85}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.72)' },
                  ]}
                />
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                      : ['rgba(255, 255, 255, 0.90)', 'rgba(240, 245, 255, 0.60)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.cardInner}>
                  <View style={styles.glassIconRoundelRed}>
                    <Ionicons name="scan-circle" size={24} color="#FF2D55" />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Auto-Scan</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                    Files &gt; Sonance Folder
                  </Text>
                  <View style={styles.crystalBadgeRed}>
                    <Text style={styles.crystalBadgeTextRed}>AirDrop Ready</Text>
                  </View>
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* VLC Multi-Cloud Storage Selector */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cloud Storage Services</Text>

          {/* Liquid Glass Multi-Provider Switcher Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.providerScroll}
            contentContainerStyle={styles.providerScrollContent}
          >
            {PROVIDERS.map((prov) => {
              const isSelected = activeTab === prov.id;
              const isConnected = connectedAccounts.some((a) => a.provider === prov.id);

              return (
                <TouchableOpacity
                  key={prov.id}
                  style={[
                    styles.providerTabChip,
                    {
                      borderColor: isSelected
                        ? (isDark ? 'rgba(255, 80, 115, 0.65)' : 'rgba(250, 36, 60, 0.45)')
                        : (isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)'),
                      borderTopColor: isSelected
                        ? (isDark ? 'rgba(255, 150, 175, 0.85)' : 'rgba(250, 36, 60, 0.70)')
                        : (isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.95)'),
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(255, 45, 85, 0.35)' : 'rgba(250, 36, 60, 0.18)')
                        : (isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.72)'),
                    },
                  ]}
                  onPress={() => handleTabChange(prov.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={prov.icon}
                    size={16}
                    color={isSelected ? '#FA243C' : isConnected ? prov.color : colors.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.providerTabLabel,
                      {
                        color: isSelected ? '#FA243C' : colors.textPrimary,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {prov.label}
                  </Text>
                  {isConnected && (
                    <View style={styles.connectedDotSmall} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Cloud Provider Panel */}
          <View style={styles.driveSectionHeader}>
            <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>
              {activeProviderMeta.label}
            </Text>
            {isCurrentConnected && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={handleResyncAllFolders} disabled={isSyncingFolder}>
                  <Text style={[styles.syncAllText, { color: activeProviderMeta.color }]}>
                    {isSyncingFolder ? 'Syncing...' : '🔄 Re-sync All'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDisconnect}>
                  <Text style={[styles.disconnectText, { color: colors.textMuted }]}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!isCurrentConnected ? (
            /* Disconnected Cloud Promo Card */
            <View
              style={[
                styles.gdrivePromoCard,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.65)',
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.40)' : 'rgba(255, 255, 255, 0.95)',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 75 : 85}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.promoBlur}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.72)' },
                  ]}
                />
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.02)', 'transparent']
                      : ['rgba(255, 255, 255, 0.90)', 'rgba(240, 245, 255, 0.60)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.promoInner}>
                  {/* Provider Glass Orb */}
                  <View style={[styles.googleGlassOrb, { borderColor: `${activeProviderMeta.color}80` }]}>
                    <LinearGradient
                      colors={[`${activeProviderMeta.color}40`, `${activeProviderMeta.color}15`]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name={activeProviderMeta.icon} size={28} color={activeProviderMeta.color} />
                  </View>

                  <Text style={[styles.gdrivePromoTitle, { color: colors.textPrimary }]}>
                    Direct {activeProviderMeta.label} Sync
                  </Text>
                  <Text style={[styles.gdrivePromoDesc, { color: colors.textMuted }]}>
                    Connect your {activeProviderMeta.label} account just like in VLC. Sync any music folder directly into Sonance and stream with 0 MB storage taken!
                  </Text>

                  {/* Translucent Liquid Sapphire / Emerald Glass Button */}
                  <TouchableOpacity
                    style={[
                      styles.connectGoogleGlassBtn,
                      {
                        shadowColor: activeProviderMeta.color,
                        borderColor: `${activeProviderMeta.color}90`,
                      },
                    ]}
                    onPress={() => handleOpenConnectModal(activeTab)}
                    activeOpacity={0.8}
                  >
                    <BlurView
                      intensity={Platform.OS === 'ios' ? 70 : 80}
                      tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : 'dark'}
                      style={styles.connectGoogleBlur}
                    >
                      <LinearGradient
                        colors={[`${activeProviderMeta.color}90`, `${activeProviderMeta.color}50`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.40)', 'rgba(255, 255, 255, 0.05)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons name={activeProviderMeta.icon} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.connectGoogleBtnText}>
                        {activeTab === 'webdav' ? 'Configure WebDAV Server' : `Connect ${activeProviderMeta.label}`}
                      </Text>
                    </BlurView>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          ) : (
            /* Connected Cloud Browser */
            <View style={styles.connectedContainer}>
              {/* User Profile Bar */}
              {currentAccount && (
                <View
                  style={[
                    styles.profileBar,
                    {
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.65)',
                      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.95)',
                    },
                  ]}
                >
                  <BlurView
                    intensity={Platform.OS === 'ios' ? 70 : 85}
                    tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                    style={styles.profileBlur}
                  >
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.72)' },
                      ]}
                    />
                    <View style={styles.profileInner}>
                      {currentAccount.avatar ? (
                        <Image source={{ uri: currentAccount.avatar }} style={styles.profileAvatar} />
                      ) : (
                        <View style={[styles.profileAvatarFallback, { backgroundColor: activeProviderMeta.color }]}>
                          <Text style={styles.profileAvatarInitial}>
                            {currentAccount.name?.charAt(0) || 'C'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {currentAccount.name}
                        </Text>
                        <Text style={[styles.profileEmail, { color: colors.textMuted }]} numberOfLines={1}>
                          {currentAccount.email || currentAccount.serverUrl || activeProviderMeta.label}
                        </Text>
                      </View>
                      <View style={styles.connectedPill}>
                        <View style={styles.connectedDot} />
                        <Text style={styles.connectedPillText}>Connected</Text>
                      </View>
                    </View>
                  </BlurView>
                </View>
              )}

              {/* Prominent 1-Tap Folder Sync Glass CTA */}
              <TouchableOpacity
                style={styles.syncFolderBanner}
                onPress={handleSyncCurrentFolder}
                disabled={isSyncingFolder}
                activeOpacity={0.8}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 75 : 85}
                  tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                  style={styles.syncBannerBlur}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(255, 45, 85, 0.35)', 'rgba(66, 133, 244, 0.22)']
                        : ['rgba(255, 45, 85, 0.18)', 'rgba(66, 133, 244, 0.12)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.30)', 'rgba(255, 255, 255, 0.05)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.syncFolderBannerContent}>
                    <View style={styles.syncBannerIconBox}>
                      {isSyncingFolder ? (
                        <ActivityIndicator size="small" color="#FA243C" />
                      ) : (
                        <Ionicons name="sync" size={20} color="#FA243C" />
                      )}
                    </View>
                    <View style={styles.syncBannerTextBox}>
                      <Text style={[styles.syncBannerTitle, { color: colors.textPrimary }]}>
                        {isSyncingFolder ? 'Syncing Cloud Folder...' : `⚡ Sync "${currentFolder.name}" to Sonance`}
                      </Text>
                      <Text style={[styles.syncBannerSubtitle, { color: colors.textMuted }]}>
                        {isSyncingFolder
                          ? syncStatusText || 'Indexing audio tracks...'
                          : 'Recursively indexes all songs into Library (0 MB storage)'}
                      </Text>
                    </View>
                    {!isSyncingFolder && (
                      <Ionicons name="chevron-forward" size={18} color="#FA243C" />
                    )}
                  </View>
                </BlurView>
              </TouchableOpacity>

              {/* Breadcrumb Navigation */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.breadcrumbBar}
                contentContainerStyle={styles.breadcrumbContent}
              >
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id + idx}>
                    {idx > 0 && (
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={colors.textMuted}
                        style={{ marginHorizontal: 4 }}
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => handleBreadcrumbPress(idx)}
                      disabled={idx === breadcrumbs.length - 1}
                    >
                      <Text
                        style={[
                          styles.breadcrumbText,
                          {
                            color: idx === breadcrumbs.length - 1 ? colors.textPrimary : activeProviderMeta.color,
                            fontWeight: idx === breadcrumbs.length - 1 ? '700' : '500',
                          },
                        ]}
                      >
                        {crumb.name}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </ScrollView>

              {/* Items List */}
              {isLoadingItems ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={activeProviderMeta.color} />
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                    Loading {activeProviderMeta.label} files...
                  </Text>
                </View>
              ) : items.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="musical-notes-outline" size={36} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No audio files or folders found here.
                  </Text>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  {items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.itemRow,
                        {
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.14)'
                            : 'rgba(255, 255, 255, 0.65)',
                          borderTopColor: isDark
                            ? 'rgba(255, 255, 255, 0.28)'
                            : 'rgba(255, 255, 255, 0.90)',
                        },
                      ]}
                      onPress={() =>
                        item.isFolder
                          ? handleNavigateToFolder(item)
                          : handlePlayDriveFile(item)
                      }
                      activeOpacity={0.7}
                    >
                      <BlurView
                        intensity={Platform.OS === 'ios' ? 65 : 80}
                        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                        style={styles.itemRowBlur}
                      >
                        <View
                          style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.70)' },
                          ]}
                        />
                        <View style={styles.itemRowInner}>
                          <View
                            style={[
                              styles.itemIconBox,
                              {
                                backgroundColor: item.isFolder
                                  ? `${activeProviderMeta.color}25`
                                  : 'rgba(255, 45, 85, 0.15)',
                              },
                            ]}
                          >
                            <Ionicons
                              name={item.isFolder ? 'folder' : 'musical-note'}
                              size={20}
                              color={item.isFolder ? activeProviderMeta.color : '#FF2D55'}
                            />
                          </View>

                          <View style={styles.itemInfo}>
                            <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                              {item.isFolder
                                ? 'Folder'
                                : `${item.size ? (item.size / 1024 / 1024).toFixed(1) : '?'} MB • Cloud Stream`}
                            </Text>
                          </View>

                          {item.isFolder ? (
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              {/* Bookmark to Library (Cloud Reference) */}
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleAddCloudTrackToLibrary(item);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="bookmark-outline" size={19} color={colors.textMuted} />
                              </TouchableOpacity>

                              {/* Download for offline */}
                              {downloadingId === item.id ? (
                                <View style={styles.downloadProgressBadge}>
                                  <ActivityIndicator size="small" color={colors.primary} />
                                  <Text style={[styles.progressText, { color: colors.primary }]}>
                                    {Math.round(downloadProgress * 100)}%
                                  </Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDownloadFile(item);
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons name="cloud-download-outline" size={19} color={colors.textMuted} />
                                </TouchableOpacity>
                              )}

                              {/* Instant Stream Play Icon */}
                              {streamingId === item.id ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                              ) : currentTrack?.id.includes(item.id.replace(/:/g, '_')) && isPlaying ? (
                                <Ionicons name="volume-high" size={20} color="#FA243C" />
                              ) : (
                                <Ionicons name="play-circle" size={24} color="#FA243C" />
                              )}
                            </View>
                          )}
                        </View>
                      </BlurView>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Candidate File Transfer Confirmation Modal */}
      <TransferConfirmationModal
        visible={candidateModalVisible}
        candidates={candidates}
        skippedCount={candidateSkippedCount}
        isTransferring={isTransferring}
        sourceType={candidateSourceType}
        onConfirm={handleConfirmTransfer}
        onCancel={() => setCandidateModalVisible(false)}
      />

      {/* Cloud Connect OAuth / WebDAV Modal */}
      <CloudConnectModal
        visible={connectModalVisible}
        provider={connectingProvider}
        onClose={() => {
          setConnectModalVisible(false);
          setConnectingProvider(null);
        }}
        onConnected={checkAllConnections}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  actionCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardBlur: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  cardInner: {
    alignItems: 'flex-start',
    width: '100%',
  },
  glassIconRoundelBlue: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0, 122, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  glassIconRoundelRed: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 45, 85, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  crystalBadgeBlue: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 0.8,
    borderColor: 'rgba(0, 122, 255, 0.30)',
    marginTop: 4,
  },
  crystalBadgeTextBlue: {
    fontSize: 9,
    fontWeight: '800',
    color: '#007AFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  crystalBadgeRed: {
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 45, 85, 0.30)',
    marginTop: 4,
  },
  crystalBadgeTextRed: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF2D55',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  providerScroll: {
    marginBottom: SPACING.md,
  },
  providerScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  providerTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  providerTabLabel: {
    fontSize: 13,
  },
  connectedDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
    marginLeft: 6,
  },
  driveSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  disconnectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gdrivePromoCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 18,
    elevation: 6,
  },
  promoBlur: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    alignItems: 'center',
  },
  promoInner: {
    alignItems: 'center',
    width: '100%',
  },
  googleGlassOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  gdrivePromoTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  gdrivePromoDesc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  connectGoogleGlassBtn: {
    width: '100%',
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
    borderTopColor: 'rgba(255, 255, 255, 0.90)',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  connectGoogleBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  connectGoogleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  syncAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncFolderBanner: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 75, 105, 0.55)',
    borderTopColor: 'rgba(255, 140, 165, 0.85)',
    overflow: 'hidden',
    marginVertical: SPACING.xs,
    shadowColor: '#FA243C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  syncBannerBlur: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  syncFolderBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    gap: 12,
  },
  syncBannerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(250, 36, 60, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 105, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBannerTextBox: {
    flex: 1,
  },
  syncBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  syncBannerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  connectedContainer: {
    gap: SPACING.sm,
  },
  profileBar: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  profileBlur: {
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.sm,
  },
  profileAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  profileAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 11,
    fontWeight: '500',
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.18)',
    borderWidth: 0.8,
    borderColor: 'rgba(52, 199, 89, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  connectedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34C759',
  },
  breadcrumbBar: {
    marginVertical: SPACING.xs,
  },
  breadcrumbContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breadcrumbText: {
    fontSize: 13,
  },
  itemsList: {
    gap: SPACING.xs,
  },
  itemRow: {
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  itemRowBlur: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  itemRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  itemIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  downloadProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
