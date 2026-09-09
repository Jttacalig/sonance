import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useCustomization } from '../context/CustomizationContext';
import { storageService } from '../services/storageService';
import { SleepTimerModal } from '../components/SleepTimerModal';
import { EqualizerModal } from '../components/EqualizerModal';
import { PlayerBackgroundModal } from '../components/PlayerBackgroundModal';
import { TransferConfirmationModal } from '../components/TransferConfirmationModal';
import { LiquidBackground } from '../components/LiquidBackground';
import { AppSettings } from '../types/music';
import { CandidateFile } from '../services/fileImportService';
import { SPACING, RADIUS } from '../constants/theme';
import { AUDIO_FORMAT_OPTIONS } from '../constants/endpoints';

export const SettingsScreen: React.FC = () => {
  const {
    storageUsage,
    refreshLibrary,
    scanCandidateFiles,
    pickCandidateFiles,
    transferCandidateFiles,
  } = useLibrary();
  const { sleepTimerMinutes } = usePlayer();
  const { colors, isDark, mode, setMode } = useTheme();
  const { activePreset, playerTheme } = useCustomization();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showEqModal, setShowEqModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  // Transfer Modal states
  const [candidateModalVisible, setCandidateModalVisible] = useState(false);
  const [candidates, setCandidates] = useState<CandidateFile[]>([]);
  const [candidateSkippedCount, setCandidateSkippedCount] = useState(0);
  const [candidateSourceType, setCandidateSourceType] = useState<'autoscan' | 'picker'>('autoscan');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    storageService.getSettings().then((s) => {
      setSettings(s);
    });
  }, []);

  const formatStorage = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const handleSaveSettings = async (updates: Partial<AppSettings>) => {
    if (!settings) return;
    const newSettings: AppSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await storageService.saveSettings(newSettings);
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clean Temporary Cache',
      'This will clear temporary audio buffers and refresh storage statistics. (Your saved songs will NOT be deleted)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clean Now',
          onPress: async () => {
            await refreshLibrary();
            Alert.alert('Done', 'Cache cleared successfully.');
          },
        },
      ]
    );
  };

  const handleAutoScanStorage = async () => {
    try {
      const res = await scanCandidateFiles();
      if (res.candidates.length > 0) {
        setCandidates(res.candidates);
        setCandidateSkippedCount(res.skippedCount);
        setCandidateSourceType('autoscan');
        setCandidateModalVisible(true);
      } else if (res.foundCount > 0) {
        Alert.alert(
          'Library Up to Date',
          `Scanned ${res.foundCount} file(s). All songs are already organized in your Sonance Music Folder.`
        );
      } else {
        Alert.alert(
          'No Local Files Found',
          'No audio files found in local storage. Drop songs into the Sonance folder in Files.'
        );
      }
    } catch (e: any) {
      Alert.alert('Scan Error', e?.message || 'Failed to scan storage.');
    }
  };

  const handleImportFiles = async () => {
    try {
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
      Alert.alert('Import Error', e?.message || 'Failed to import files.');
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

  const themeOptions: { id: ThemeMode; label: string; icon: any }[] = [
    { id: 'auto', label: 'Auto (System)', icon: 'phone-portrait-outline' },
    { id: 'dark', label: 'Dark Mode', icon: 'moon-outline' },
    { id: 'light', label: 'Light Mode', icon: 'sunny-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LiquidBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Appearance, Storage & Audio Preferences
            </Text>
          </View>

          {/* Theme Appearance Selector - Frosted Glass Card */}
          <View
            style={[
              styles.glassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.cardBlur}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Appearance</Text>
              </View>

              <View style={styles.themeOptionsRow}>
                {themeOptions.map((opt) => {
                  const isSelected = mode === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.themeOptionChip,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(255, 255, 255, 0.7)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
                        },
                        isSelected && {
                          borderColor: colors.primary,
                          backgroundColor: isDark
                            ? 'rgba(255, 51, 92, 0.2)'
                            : 'rgba(255, 46, 85, 0.14)',
                        },
                      ]}
                      onPress={() => setMode(opt.id)}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.themeOptionText,
                          { color: isSelected ? colors.primary : colors.textSecondary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </BlurView>
          </View>

          {/* Audio Equalizer Shortcut Card */}
          <View
            style={[
              styles.glassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.cardBlur}
            >
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowEqModal(true)}
              >
                <View style={styles.settingRowLeft}>
                  <Ionicons name="options-outline" size={20} color={colors.primary} />
                  <View>
                    <Text style={[styles.settingRowTitle, { color: colors.textPrimary }]}>
                      Audio Equalizer
                    </Text>
                    <Text style={[styles.settingRowSubtitle, { color: colors.textSecondary }]}>
                      Preset: {activePreset.name} (5-Band Custom)
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </BlurView>
          </View>

          {/* Player Wallpaper & Theme Customizer Card */}
          <View
            style={[
              styles.glassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.cardBlur}
            >
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowWallpaperModal(true)}
              >
                <View style={styles.settingRowLeft}>
                  <Ionicons name="color-palette-outline" size={20} color={colors.accentCyan} />
                  <View>
                    <Text style={[styles.settingRowTitle, { color: colors.textPrimary }]}>
                      Player Wallpaper & Theme
                    </Text>
                    <Text style={[styles.settingRowSubtitle, { color: colors.textSecondary }]}>
                      {playerTheme.type === 'custom'
                        ? 'Custom Photo Active'
                        : playerTheme.type === 'preset'
                        ? 'Liquid Preset'
                        : 'Dynamic Album Art Aura'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </BlurView>
          </View>

          {/* Storage Usage Card */}
          <View
            style={[
              styles.glassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.cardBlur}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="pie-chart-outline" size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Offline Storage
                </Text>
              </View>

              <View style={styles.storageMeter}>
                <Text style={[styles.storageBigText, { color: colors.primary }]}>
                  {formatStorage(storageUsage.totalBytes)}
                </Text>
                <Text style={[styles.storageSubText, { color: colors.textSecondary }]}>
                  used across {storageUsage.trackCount} offline{' '}
                  {storageUsage.trackCount === 1 ? 'song' : 'songs'}
                </Text>
              </View>

              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.outlineBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.7)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
                    },
                  ]}
                  onPress={handleAutoScanStorage}
                >
                  <Ionicons name="scan-outline" size={15} color={colors.primary} />
                  <Text style={[styles.outlineBtnText, { color: colors.primary }]}>
                    Auto-Scan
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.outlineBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.7)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
                    },
                  ]}
                  onPress={handleImportFiles}
                >
                  <Ionicons name="folder-open-outline" size={15} color={colors.textSecondary} />
                  <Text style={[styles.outlineBtnText, { color: colors.textSecondary }]}>
                    Choose Files
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.outlineBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.7)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
                    },
                  ]}
                  onPress={handleClearCache}
                >
                  <Ionicons name="trash-bin-outline" size={15} color={colors.textSecondary} />
                  <Text style={[styles.outlineBtnText, { color: colors.textSecondary }]}>
                    Clean
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>

          {/* Audio Quality Preferences */}
          <View
            style={[
              styles.glassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.cardBlur}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="options-outline" size={20} color={colors.accentCyan} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Audio Quality
                </Text>
              </View>

              <View style={styles.optionsGroup}>
                {AUDIO_FORMAT_OPTIONS.map((opt) => {
                  const isSelected = settings?.preferredAudioQuality === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.radioItem,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(255, 255, 255, 0.7)',
                          borderColor: isSelected
                            ? colors.primary
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#FFFFFF',
                        },
                        isSelected && {
                          backgroundColor: isDark
                            ? 'rgba(255, 51, 92, 0.14)'
                            : 'rgba(255, 46, 85, 0.1)',
                        },
                      ]}
                      onPress={() => handleSaveSettings({ preferredAudioQuality: opt.id as any })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          { color: isSelected ? colors.primary : colors.textPrimary },
                          isSelected && styles.activeRadioText,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </BlurView>
          </View>

          {/* Sleep Timer Shortcut */}
          <View
            style={[
              styles.glassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.cardBlur}
            >
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowSleepModal(true)}
              >
                <View style={styles.settingRowLeft}>
                  <Ionicons name="moon-outline" size={20} color={colors.accentOrange} />
                  <View>
                    <Text style={[styles.settingRowTitle, { color: colors.textPrimary }]}>
                      Sleep Timer
                    </Text>
                    <Text style={[styles.settingRowSubtitle, { color: colors.textSecondary }]}>
                      {sleepTimerMinutes !== null
                        ? `Pauses in ${sleepTimerMinutes} minutes`
                        : 'Off'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </BlurView>
          </View>

          {/* About Info with Official Wordmark Logo */}
          <View
            style={[
              styles.glassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.cardBlur}
            >
              <View style={{ alignItems: 'center', marginVertical: SPACING.sm }}>
                <Image
                  source={
                    isDark
                      ? require('../../assets/sonance-logo-white.png')
                      : require('../../assets/sonance-logo-black.png')
                  }
                  style={{ width: 180, height: 28 }}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.cardHeader}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  About Sonance
                </Text>
              </View>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                SONANCE is a high-fidelity offline music player built for iOS & Android. Features 5-band studio equalizer, liquid glass UI, customizable wallpapers, and in-app music search.
              </Text>
              <View style={[styles.versionRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.versionLabel, { color: colors.textMuted }]}>Developer</Text>
                <Text style={[styles.versionValue, { color: colors.primary, fontWeight: '700' }]}>
                  Jhet Tacalig
                </Text>
              </View>
              <View style={[styles.versionRow, { borderTopColor: colors.border, marginTop: SPACING.xs }]}>
                <Text style={[styles.versionLabel, { color: colors.textMuted }]}>Version</Text>
                <Text style={[styles.versionValue, { color: colors.textSecondary }]}>
                  1.0.0 (Release)
                </Text>
              </View>
            </BlurView>
          </View>
        </ScrollView>

        {/* Modals */}
        <SleepTimerModal
          visible={showSleepModal}
          onClose={() => setShowSleepModal(false)}
        />

        <EqualizerModal
          visible={showEqModal}
          onClose={() => setShowEqModal(false)}
        />

        <PlayerBackgroundModal
          visible={showWallpaperModal}
          onClose={() => setShowWallpaperModal(false)}
        />

        <TransferConfirmationModal
          visible={candidateModalVisible}
          candidates={candidates}
          skippedCount={candidateSkippedCount}
          sourceType={candidateSourceType}
          isTransferring={isTransferring}
          onConfirm={handleConfirmTransfer}
          onCancel={handleCancelTransfer}
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
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 180,
    gap: SPACING.md,
  },
  header: {
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  glassCard: {
    borderRadius: RADIUS.clay,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBlur: {
    padding: SPACING.lg,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  themeOptionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  themeOptionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
  },
  themeOptionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  storageMeter: {
    marginVertical: SPACING.xs,
  },
  storageBigText: {
    fontSize: 32,
    fontWeight: '800',
  },
  storageSubText: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: SPACING.md,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.full,
    borderWidth: 1.4,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionsGroup: {
    gap: SPACING.xs,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
  },
  radioText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeRadioText: {
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  settingRowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingRowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.md,
    fontWeight: '500',
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  versionValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
