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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useCustomization } from '../context/CustomizationContext';
import { useAudioRoute } from '../context/AudioRouteContext';
import { storageService } from '../services/storageService';
import { SleepTimerModal } from '../components/SleepTimerModal';
import { EqualizerModal } from '../components/EqualizerModal';
import { PlayerBackgroundModal } from '../components/PlayerBackgroundModal';
import { TransferConfirmationModal } from '../components/TransferConfirmationModal';
import { DiagnosticsModal } from '../components/DiagnosticsModal';
import { LiquidBackground } from '../components/LiquidBackground';
import { AppSettings } from '../types/music';
import { CandidateFile } from '../services/fileImportService';
import { SPACING, RADIUS, ACCENT_THEMES } from '../constants/theme';
import { AUDIO_FORMAT_OPTIONS } from '../constants/endpoints';

export const SettingsScreen: React.FC = () => {
  const {
    storageUsage,
    refreshLibrary,
    scanCandidateFiles,
    pickCandidateFiles,
    transferCandidateFiles,
    cleanupCandidateFiles,
  } = useLibrary();
  const { sleepTimerMinutes } = usePlayer();
  const { colors, isDark, mode, setMode, accentId, setAccent } = useTheme();
  const { activePreset, playerTheme } = useCustomization();
  const { currentDevice, triggerHud } = useAudioRoute();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showEqModal, setShowEqModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);

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
            if (FileSystem.cacheDirectory) {
              try {
                const cacheFiles = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
                for (const f of cacheFiles) {
                  await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${f}`, { idempotent: true });
                }
              } catch (e) {
                console.warn('Error clearing cache directory:', e);
              }
            }
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
    if (candidates.length > 0) {
      cleanupCandidateFiles(candidates);
    }
    setCandidateModalVisible(false);
    setCandidates([]);
    setCandidateSkippedCount(0);
  };

  const handleCycleAudioQuality = () => {
    if (Haptics.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const formats: Array<'m4a' | 'mp3' | 'flac'> = ['m4a', 'mp3', 'flac'];
    const current = settings?.preferredAudioQuality || 'm4a';
    const nextIdx = (formats.indexOf(current as any) + 1) % formats.length;
    handleSaveSettings({ preferredAudioQuality: formats[nextIdx] });
  };

  const themeModes: { id: ThemeMode; label: string; icon: any }[] = [
    { id: 'auto', label: 'Auto', icon: 'phone-portrait-outline' },
    { id: 'dark', label: 'Dark', icon: 'moon-outline' },
    { id: 'light', label: 'Light', icon: 'sunny-outline' },
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
              Preferences, Appearance & Storage
            </Text>
          </View>

          {/* SECTION 1: APPEARANCE & THEME (Centralized Card) */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              APPEARANCE & THEME
            </Text>
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
                  shadowColor: '#000',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                {/* Theme Mode Segmented Selector */}
                <View style={styles.segmentedRow}>
                  {themeModes.map((opt) => {
                    const isSelected = mode === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        activeOpacity={0.8}
                        style={[
                          styles.segmentBtn,
                          isSelected && [
                            styles.activeSegmentBtn,
                            {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0,0,0,0.06)',
                            },
                          ],
                        ]}
                        onPress={() => {
                          if (Haptics.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setMode(opt.id);
                        }}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={15}
                          color={isSelected ? (isDark ? '#FFFFFF' : colors.primary) : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.segmentText,
                            { color: isSelected ? colors.textPrimary : colors.textSecondary },
                            isSelected && { fontWeight: '800' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Accent Color Palette Dots */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <View style={styles.paletteRow}>
                  <Text style={[styles.paletteLabel, { color: colors.textSecondary }]}>
                    Accent Color
                  </Text>
                  <View style={styles.paletteDots}>
                    {ACCENT_THEMES.map((accent) => {
                      const isSelected = accentId === accent.id;
                      const dotColor = isDark
                        ? accent.primary
                        : accent.lightPrimary || accent.primary;
                      return (
                        <TouchableOpacity
                          key={accent.id}
                          activeOpacity={0.75}
                          onPress={() => {
                            if (Haptics.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setAccent(accent.id);
                          }}
                          style={[
                            styles.accentDotWrapper,
                            isSelected && { borderColor: dotColor, borderWidth: 2 },
                          ]}
                        >
                          <View
                            style={[
                              styles.accentDot,
                              {
                                backgroundColor: dotColor,
                                borderWidth: 1,
                                borderColor: isDark
                                  ? 'rgba(255, 255, 255, 0.3)'
                                  : 'rgba(0, 0, 0, 0.12)',
                              },
                            ]}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Wallpaper Row */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={() => setShowWallpaperModal(true)}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="color-palette" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      Player Wallpaper & Aura
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                      {playerTheme.type === 'custom' ? 'Photo' : playerTheme.type === 'preset' ? 'Liquid' : 'Album Aura'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>

                {/* Equalizer Row */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={() => setShowEqModal(true)}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="options" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      Audio Equalizer (5-Band)
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: isDark ? '#FFFFFF' : colors.primary, fontWeight: '700' }]}>
                      {activePreset.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </BlurView>
            </View>
          </View>

          {/* SECTION 2: AUDIO & HARDWARE (Centralized Card) */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              AUDIO & PLAYBACK
            </Text>
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
                  shadowColor: '#000',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                {/* Connected Audio Device & HUD Trigger */}
                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={() => triggerHud(currentDevice)}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="headset" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                        Audio Route & HUD
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                        {currentDevice.name} ({currentDevice.quality.split('•')[0].trim()})
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.badgePillText, { color: isDark ? '#FFFFFF' : colors.primary }]}>
                      Test HUD
                    </Text>
                    <Ionicons name="play-circle" size={18} color={isDark ? '#FFFFFF' : colors.primary} />
                  </View>
                </TouchableOpacity>

                {/* Download Audio Quality */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={handleCycleAudioQuality}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="sparkles" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                        Preferred Download Quality
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                        Tap to switch audio stream format
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: isDark ? '#FFFFFF' : colors.primary, fontWeight: '800' }]}>
                      {(settings?.preferredAudioQuality || 'm4a').toUpperCase()}
                    </Text>
                    <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>

                {/* Sleep Timer */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={() => setShowSleepModal(true)}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="moon" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      Sleep Timer
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                      {sleepTimerMinutes !== null ? `${sleepTimerMinutes} min` : 'Off'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </BlurView>
            </View>
          </View>

          {/* SECTION 3: OFFLINE STORAGE & FILES (Centralized Card) */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              OFFLINE STORAGE & FILES
            </Text>
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
                  shadowColor: '#000',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                {/* Storage Header */}
                <View style={styles.storageSummaryRow}>
                  <View>
                    <Text style={[styles.storageHeading, { color: colors.textPrimary }]}>
                      {formatStorage(storageUsage.totalBytes)} Used
                    </Text>
                    <Text style={[styles.storageSubheading, { color: colors.textSecondary }]}>
                      {storageUsage.trackCount} offline {storageUsage.trackCount === 1 ? 'track' : 'tracks'} stored
                    </Text>
                  </View>
                  <View style={[styles.storageBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}>
                    <Ionicons name="folder-outline" size={16} color={isDark ? '#FFFFFF' : colors.primary} />
                  </View>
                </View>

                {/* Auto Scan Row */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={handleAutoScanStorage}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="scan" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      Auto-Scan Phone for Audio
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Browse Files Row */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={handleImportFiles}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="folder-open" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      Browse & Select Audio Files
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Clean Cache Row */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={handleClearCache}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.1)' }]}>
                      <Ionicons name="trash-outline" size={17} color={colors.error} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      Clean Temporary Cache
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </BlurView>
            </View>
          </View>

          {/* SECTION 4: ABOUT & SYSTEM (Centralized Card) */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              ABOUT & SYSTEM
            </Text>
            <View
              style={[
                styles.unifiedCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
                  shadowColor: '#000',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.cardBlur}
              >
                <View style={styles.brandRow}>
                  <Image
                    source={
                      isDark
                        ? require('../../assets/sonance-logo-white.png')
                        : require('../../assets/sonance-logo-black.png')
                    }
                    style={{ width: 140, height: 24 }}
                    resizeMode="contain"
                  />
                  <Text style={[styles.appVersionTag, { color: isDark ? '#FFFFFF' : colors.primary }]}>v1.2.1</Text>
                </View>

                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Developer</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>Jhet Tacalig</Text>
                </View>

                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Architecture</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>Native iOS (React Native 0.86)</Text>
                </View>

                {/* Windows Console & Live Logs */}
                <View style={[styles.cardDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />

                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.75}
                  onPress={() => setShowDiagnosticsModal(true)}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
                      <Ionicons name="terminal" size={17} color={isDark ? '#FFFFFF' : colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                        Windows Console & Live Logs
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                        Stream real-time diagnostics to Windows PC
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </BlurView>
            </View>
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

        <DiagnosticsModal
          visible={showDiagnosticsModal}
          onClose={() => setShowDiagnosticsModal(false)}
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
    paddingBottom: 160,
    gap: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  sectionContainer: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  unifiedCard: {
    borderRadius: RADIUS.clay,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  cardBlur: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    padding: 3,
    gap: 4,
    marginVertical: SPACING.xs,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  activeSegmentBtn: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    width: '100%',
    marginVertical: SPACING.xs,
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.xs,
  },
  paletteLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  paletteDots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  accentDotWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accentDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    flex: 1,
  },
  rowIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  storageSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  storageHeading: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  storageSubheading: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  storageBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  appVersionTag: {
    fontSize: 12.5,
    fontWeight: '800',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  infoLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
