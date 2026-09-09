import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCustomization } from '../context/CustomizationContext';
import { useTheme } from '../context/ThemeContext';
import { LIQUID_WALLPAPER_PRESETS } from '../constants/equalizer';
import { PlayerBackgroundTheme } from '../types/music';
import { SPACING, RADIUS } from '../constants/theme';

interface PlayerBackgroundModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'aura' | 'presets' | 'custom';

export const PlayerBackgroundModal: React.FC<PlayerBackgroundModalProps> = ({
  visible,
  onClose,
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { playerTheme, updatePlayerTheme, pickCustomWallpaper } = useCustomization();
  const { colors, isDark } = useTheme();

  // Local draft state
  const [draftTheme, setDraftTheme] = useState<PlayerBackgroundTheme>(playerTheme);
  const [activeTab, setActiveTab] = useState<TabType>('presets');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  // Sync draft state whenever modal is opened
  useEffect(() => {
    if (visible) {
      setDraftTheme({ ...playerTheme });
      setIsSavedSuccess(false);
      setIsSaving(false);

      if (playerTheme.type === 'artwork_aura') {
        setActiveTab('aura');
      } else if (playerTheme.type === 'custom') {
        setActiveTab('custom');
      } else {
        setActiveTab('presets');
      }
    }
  }, [visible, playerTheme]);

  const isModified =
    draftTheme.type !== playerTheme.type ||
    draftTheme.presetId !== playerTheme.presetId ||
    draftTheme.customImageUri !== playerTheme.customImageUri ||
    Math.round(draftTheme.blurIntensity) !== Math.round(playerTheme.blurIntensity) ||
    Math.round(draftTheme.dimness * 100) !== Math.round(playerTheme.dimness * 100);

  const handlePickCustomPhoto = async () => {
    try {
      const uri = await pickCustomWallpaper(false);
      if (uri) {
        setDraftTheme((prev) => ({
          ...prev,
          type: 'custom',
          customImageUri: uri,
        }));
        setActiveTab('custom');
      }
    } catch (e: any) {
      Alert.alert('Upload Photo', e?.message || 'Could not select photo.');
    }
  };

  const handleSelectType = (type: PlayerBackgroundTheme['type'], presetId?: string) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setDraftTheme((prev) => ({
      ...prev,
      type,
      ...(presetId ? { presetId } : {}),
    }));
  };

  const handleResetToCurrent = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setDraftTheme({ ...playerTheme });
    if (playerTheme.type === 'artwork_aura') setActiveTab('aura');
    else if (playerTheme.type === 'custom') setActiveTab('custom');
    else setActiveTab('presets');
  };

  const handleSaveAndApply = async () => {
    try {
      setIsSaving(true);
      await updatePlayerTheme(draftTheme);
      setIsSaving(false);
      setIsSavedSuccess(true);

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      setTimeout(() => {
        onClose();
      }, 350);
    } catch (e: any) {
      setIsSaving(false);
      Alert.alert('Save Failed', e?.message || 'Could not save background settings.');
    }
  };

  // Render live preview background inside the mini mockup card
  const renderPreviewBackground = () => {
    if (draftTheme.type === 'custom' && draftTheme.customImageUri) {
      return (
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: draftTheme.customImageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <BlurView
            intensity={Platform.OS === 'ios' ? draftTheme.blurIntensity : 80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(0, 0, 0, ${draftTheme.dimness})` },
            ]}
          />
        </View>
      );
    }

    if (draftTheme.type === 'preset') {
      const preset =
        LIQUID_WALLPAPER_PRESETS.find((p) => p.id === draftTheme.presetId) ||
        LIQUID_WALLPAPER_PRESETS[0];
      return (
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={preset.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={preset.secondaryColors}
            start={{ x: 1, y: 0.2 }}
            end={{ x: 0, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
          <BlurView
            intensity={Platform.OS === 'ios' ? draftTheme.blurIntensity : 80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(0, 0, 0, ${draftTheme.dimness})` },
            ]}
          />
        </View>
      );
    }

    // Default: Dynamic Artwork Aura
    return (
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={
            isDark
              ? ['#FF007A', '#7928CA', '#00F2FE']
              : ['#FF2E55', '#00B4D8', '#8338EC']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView
          intensity={Platform.OS === 'ios' ? draftTheme.blurIntensity : 80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(0, 0, 0, ${draftTheme.dimness})` },
          ]}
        />
      </View>
    );
  };

  const presetCardWidth = (SCREEN_WIDTH - SPACING.lg * 2 - 20) / 3;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Ambient Top Glow */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 51, 92, 0.25)', 'rgba(139, 92, 246, 0.15)', 'transparent']
              : ['rgba(255, 46, 85, 0.18)', 'rgba(0, 180, 216, 0.1)', 'transparent']
          }
          style={styles.ambientGlow}
          pointerEvents="none"
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 51, 92, 0.16)'
                      : 'rgba(255, 46, 85, 0.12)',
                  },
                ]}
              >
                <Ionicons name="color-palette" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Player Wallpaper
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  {isModified ? 'Unsaved modifications' : 'Active backdrop'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {isModified && (
                <TouchableOpacity
                  style={styles.headerSaveBtnWrapper}
                  onPress={handleSaveAndApply}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.primary, '#FF007A']}
                    style={styles.headerSaveBtn}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                        <Text style={styles.headerSaveBtnText}>Save</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
                  },
                ]}
                onPress={onClose}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Content with generous paddingBottom to ensure 0 overlap */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: isModified ? 130 : 50 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Live Interactive Preview Card */}
            <View
              style={[
                styles.previewCard,
                {
                  borderColor: isModified
                    ? colors.primary
                    : isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(255, 255, 255, 0.9)',
                  shadowColor: isModified ? colors.primary : '#000',
                },
              ]}
            >
              {renderPreviewBackground()}

              {/* Mockup Player Overlay */}
              <View style={styles.mockPlayerContent}>
                <View style={styles.previewBadgeRow}>
                  <View
                    style={[
                      styles.previewStatusBadge,
                      {
                        backgroundColor: isModified
                          ? 'rgba(255, 145, 0, 0.35)'
                          : 'rgba(0, 242, 96, 0.25)',
                        borderColor: isModified ? '#FF9100' : '#00F260',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isModified ? 'eye-outline' : 'checkmark-circle'}
                      size={11}
                      color={isModified ? '#FFB74D' : '#00F260'}
                    />
                    <Text
                      style={[
                        styles.previewStatusText,
                        { color: isModified ? '#FFE0B2' : '#E8F5E9' },
                      ]}
                    >
                      {isModified ? 'Preview Mode' : 'Active Theme'}
                    </Text>
                  </View>
                </View>

                {/* Mini Player Mockup UI */}
                <View style={styles.mockPlayerBody}>
                  <LinearGradient
                    colors={['#FF007A', '#7928CA']}
                    style={styles.mockAlbumArt}
                  >
                    <Ionicons name="musical-note" size={16} color="#FFF" />
                  </LinearGradient>

                  <View style={styles.mockTrackInfo}>
                    <Text style={styles.mockTrackTitle} numberOfLines={1}>
                      Sonance Audio
                    </Text>
                    <Text style={styles.mockTrackArtist} numberOfLines={1}>
                      Live Wallpaper Preview
                    </Text>
                  </View>

                  <View style={styles.mockPlayBtn}>
                    <Ionicons name="play" size={12} color="#FFF" style={{ marginLeft: 1 }} />
                  </View>
                </View>
              </View>
            </View>

            {/* 2. Organized Segmented Tabs */}
            <View
              style={[
                styles.categoryTabs,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(255, 255, 255, 0.8)',
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.categoryTabBtn,
                  activeTab === 'presets' && [
                    styles.categoryTabBtnActive,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.14)'
                        : '#FFFFFF',
                      shadowColor: isDark ? '#000' : '#8CA0BA',
                    },
                  ],
                ]}
                onPress={() => {
                  setActiveTab('presets');
                  if (draftTheme.type !== 'preset') {
                    handleSelectType('preset', draftTheme.presetId || 'neon_liquid');
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="color-filter"
                  size={14}
                  color={activeTab === 'presets' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: activeTab === 'presets' ? colors.textPrimary : colors.textSecondary,
                      fontWeight: activeTab === 'presets' ? '800' : '600',
                    },
                  ]}
                >
                  Presets
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.categoryTabBtn,
                  activeTab === 'aura' && [
                    styles.categoryTabBtnActive,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.14)'
                        : '#FFFFFF',
                      shadowColor: isDark ? '#000' : '#8CA0BA',
                    },
                  ],
                ]}
                onPress={() => {
                  setActiveTab('aura');
                  handleSelectType('artwork_aura');
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="sparkles"
                  size={14}
                  color={activeTab === 'aura' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: activeTab === 'aura' ? colors.textPrimary : colors.textSecondary,
                      fontWeight: activeTab === 'aura' ? '800' : '600',
                    },
                  ]}
                >
                  Album Aura
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.categoryTabBtn,
                  activeTab === 'custom' && [
                    styles.categoryTabBtnActive,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.14)'
                        : '#FFFFFF',
                      shadowColor: isDark ? '#000' : '#8CA0BA',
                    },
                  ],
                ]}
                onPress={() => {
                  setActiveTab('custom');
                  if (draftTheme.customImageUri) {
                    handleSelectType('custom');
                  } else {
                    handlePickCustomPhoto();
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="image"
                  size={14}
                  color={activeTab === 'custom' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: activeTab === 'custom' ? colors.textPrimary : colors.textSecondary,
                      fontWeight: activeTab === 'custom' ? '800' : '600',
                    },
                  ]}
                >
                  Photo
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB CONTENT: 1. LIQUID PRESETS */}
            {activeTab === 'presets' && (
              <View style={styles.tabSection}>
                <View style={styles.presetsGrid}>
                  {LIQUID_WALLPAPER_PRESETS.map((preset) => {
                    const isSelected =
                      draftTheme.type === 'preset' && draftTheme.presetId === preset.id;
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        style={[
                          styles.presetCard,
                          {
                            width: presetCardWidth,
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(255, 255, 255, 0.75)',
                            borderColor: isSelected
                              ? colors.primary
                              : isDark
                              ? 'rgba(255, 255, 255, 0.12)'
                              : '#FFFFFF',
                            shadowColor: isSelected ? colors.primary : '#000',
                          },
                        ]}
                        onPress={() => handleSelectType('preset', preset.id)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={preset.colors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.presetGradient}
                        >
                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Ionicons name="checkmark" size={12} color="#FFF" />
                            </View>
                          )}
                        </LinearGradient>
                        <Text
                          style={[
                            styles.presetCardName,
                            { color: isSelected ? colors.primary : colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {preset.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* TAB CONTENT: 2. DYNAMIC AURA */}
            {activeTab === 'aura' && (
              <View style={styles.tabSection}>
                <TouchableOpacity
                  style={[
                    styles.auraCard,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 51, 92, 0.14)'
                        : 'rgba(255, 46, 85, 0.08)',
                      borderColor: colors.primary,
                      shadowColor: colors.primary,
                    },
                  ]}
                  onPress={() => handleSelectType('artwork_aura')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#FF007A', '#7928CA', '#00F2FE']}
                    style={styles.auraIconCircle}
                  >
                    <Ionicons name="sparkles" size={24} color="#FFF" />
                  </LinearGradient>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.auraTitleRow}>
                      <Text style={[styles.auraTitle, { color: colors.textPrimary }]}>
                        Adaptive Album Aura
                      </Text>
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    </View>
                    <Text style={[styles.auraSubtitle, { color: colors.textSecondary }]}>
                      Extracts vibrant color palettes from every playing track's cover art to produce a fluid glowing ambient mesh backdrop in real time.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB CONTENT: 3. CUSTOM PHOTO */}
            {activeTab === 'custom' && (
              <View style={styles.tabSection}>
                <View
                  style={[
                    styles.customCard,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(255, 255, 255, 0.75)',
                      borderColor:
                        draftTheme.type === 'custom'
                          ? colors.primary
                          : isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : '#FFFFFF',
                    },
                  ]}
                >
                  {draftTheme.customImageUri ? (
                    <View style={styles.customPhotoRow}>
                      <Image
                        source={{ uri: draftTheme.customImageUri }}
                        style={styles.customPhotoThumb}
                      />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text
                          style={[styles.customPhotoTitle, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          Custom Photo Active
                        </Text>
                        <TouchableOpacity
                          style={styles.changePhotoBtnWrapper}
                          onPress={handlePickCustomPhoto}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={[colors.primary, '#FF007A']}
                            style={styles.changePhotoBtn}
                          >
                            <Ionicons name="camera-reverse" size={13} color="#FFF" />
                            <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadBtnWrapper}
                      onPress={handlePickCustomPhoto}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[colors.primary, '#FF007A', colors.primaryDark]}
                        style={styles.uploadBtn}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                        <Text style={styles.uploadBtnText}>Choose Photo from Files</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* 3. Visual Adjustments (Glass Blur & Dimness Overlays) */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                VISUAL ADJUSTMENTS
              </Text>
            </View>

            {/* Glass Blur Slider Card */}
            <View
              style={[
                styles.sliderCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
                },
              ]}
            >
              <View style={styles.sliderHeader}>
                <View style={styles.sliderLabelRow}>
                  <Ionicons name="water-outline" size={15} color={colors.primary} />
                  <Text style={[styles.sliderLabel, { color: colors.textPrimary }]}>
                    Glass Blur
                  </Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.primary }]}>
                  {Math.round(draftTheme.blurIntensity)}%
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={draftTheme.blurIntensity}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={
                  isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
                }
                thumbTintColor={colors.primary}
                onValueChange={(val) =>
                  setDraftTheme((prev) => ({ ...prev, blurIntensity: val }))
                }
              />
            </View>

            {/* Dimness Overlay Slider Card */}
            <View
              style={[
                styles.sliderCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
                },
              ]}
            >
              <View style={styles.sliderHeader}>
                <View style={styles.sliderLabelRow}>
                  <Ionicons name="contrast-outline" size={15} color={colors.primary} />
                  <Text style={[styles.sliderLabel, { color: colors.textPrimary }]}>
                    Dim Overlay
                  </Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.primary }]}>
                  {Math.round(draftTheme.dimness * 100)}%
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={0.7}
                step={0.05}
                value={draftTheme.dimness}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={
                  isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
                }
                thumbTintColor={colors.primary}
                onValueChange={(val) =>
                  setDraftTheme((prev) => ({ ...prev, dimness: val }))
                }
              />
            </View>
          </ScrollView>

          {/* Floating Action Pill Bar - ONLY shows when modified, floating comfortably above content */}
          {isModified && (
            <View
              style={[
                styles.floatingBottomDock,
                {
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.18)'
                    : 'rgba(255, 255, 255, 0.9)',
                  shadowColor: isDark ? '#000' : '#8CA0BA',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={isDark ? 'dark' : 'light'}
                style={styles.dockBlur}
              >
                {/* Revert Button */}
                <TouchableOpacity
                  style={[
                    styles.revertBtn,
                    {
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.15)'
                        : 'rgba(0, 0, 0, 0.12)',
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                  onPress={handleResetToCurrent}
                  disabled={isSaving}
                  activeOpacity={0.75}
                >
                  <Ionicons name="refresh" size={15} color={colors.textSecondary} />
                  <Text style={[styles.revertBtnText, { color: colors.textSecondary }]}>
                    Revert
                  </Text>
                </TouchableOpacity>

                {/* Save & Apply Button */}
                <TouchableOpacity
                  style={styles.saveBtnWrapper}
                  onPress={handleSaveAndApply}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      isSavedSuccess
                        ? ['#00F260', '#0575E6']
                        : [colors.primary, '#FF007A', colors.primaryDark]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtn}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons
                          name={isSavedSuccess ? 'checkmark-circle' : 'checkmark-done'}
                          size={16}
                          color="#FFF"
                        />
                        <Text style={styles.saveBtnText}>
                          {isSavedSuccess ? 'Saved!' : 'Save & Apply'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSaveBtnWrapper: {
    borderRadius: RADIUS.full,
  },
  headerSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  headerSaveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  previewCard: {
    height: 96,
    borderRadius: RADIUS.lg,
    borderWidth: 1.4,
    overflow: 'hidden',
    marginBottom: SPACING.sm + 2,
    position: 'relative',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  mockPlayerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.sm,
    justifyContent: 'space-between',
  },
  previewBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  previewStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  previewStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  mockPlayerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: 6,
    borderRadius: RADIUS.md,
  },
  mockAlbumArt: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockTrackInfo: {
    flex: 1,
  },
  mockTrackTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  mockTrackArtist: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
  },
  mockPlayBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTabs: {
    flexDirection: 'row',
    borderRadius: RADIUS.full,
    padding: 3,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  categoryTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  categoryTabBtnActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTabText: {
    fontSize: 12,
  },
  tabSection: {
    marginBottom: SPACING.sm,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1.4,
    padding: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  presetGradient: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.sm - 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#FFF',
  },
  presetCardName: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  auraCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.4,
    gap: SPACING.md,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  auraIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auraTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  auraTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  auraSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  customCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.4,
  },
  customPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  customPhotoThumb: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.md,
  },
  customPhotoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  changePhotoBtnWrapper: {
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
  },
  changePhotoBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  uploadBtnWrapper: {
    borderRadius: RADIUS.full,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: RADIUS.full,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  sectionHeader: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sliderCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    marginBottom: SPACING.xs + 2,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  slider: {
    height: 32,
    width: '100%',
  },
  floatingBottomDock: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 16 : 12,
    left: 16,
    right: 16,
    borderRadius: RADIUS.full,
    borderWidth: 1.4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  dockBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 8,
  },
  revertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  revertBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtnWrapper: {
    flex: 1,
    borderRadius: RADIUS.full,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
});
