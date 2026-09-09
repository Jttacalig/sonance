import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCustomization } from '../context/CustomizationContext';
import { useTheme } from '../context/ThemeContext';
import { EQ_FREQUENCIES, BUILT_IN_EQ_PRESETS } from '../constants/equalizer';
import { SPACING, RADIUS } from '../constants/theme';

interface EqualizerModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ visible, onClose }) => {
  const {
    activePresetId,
    activePreset,
    bands,
    isEqEnabled,
    setIsEqEnabled,
    selectPreset,
    updateBandGain,
    resetEqToFlat,
  } = useCustomization();

  const { colors, isDark } = useTheme();

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
            <View style={styles.iconCircle}>
              <Ionicons name="options-outline" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Audio Equalizer</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {isEqEnabled ? `Preset: ${activePreset.name}` : 'Equalizer Bypassed'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#FFFFFF',
              },
            ]}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Dynamic Visual Frequency Response Curve Card */}
          <View
            style={[
              styles.curveCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? colors.primary : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.curveCardBlur}
            >
              <View style={styles.curveHeader}>
                <Text style={[styles.curveLabel, { color: colors.textSecondary }]}>
                  FREQUENCY RESPONSE (+12dB / -12dB)
                </Text>
                <TouchableOpacity
                  style={[
                    styles.enableTogglePill,
                    {
                      backgroundColor: isEqEnabled
                        ? colors.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                  onPress={() => setIsEqEnabled(!isEqEnabled)}
                >
                  <Text style={styles.enableToggleText}>
                    {isEqEnabled ? 'Active' : 'Disabled'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Graphical Bars & Curve Lines */}
              <View style={styles.chartArea}>
                <View style={styles.zeroDbLine} />
                {bands.map((gain, index) => {
                  const normalizedHeight = Math.max(6, Math.abs(gain) * 3.5);
                  const isPositive = gain >= 0;
                  return (
                    <View key={index} style={styles.chartCol}>
                      <View style={styles.chartBarWrapper}>
                        <LinearGradient
                          colors={
                            isPositive
                              ? [colors.primary, '#FF007A']
                              : ['#7928CA', colors.primaryLight]
                          }
                          style={[
                            styles.chartBar,
                            {
                              height: normalizedHeight,
                              opacity: isEqEnabled ? 1 : 0.35,
                              transform: [{ translateY: isPositive ? -normalizedHeight / 2 : normalizedHeight / 2 }],
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.chartGainText, { color: isEqEnabled ? colors.primary : colors.textMuted }]}>
                        {gain > 0 ? `+${gain}` : `${gain}`}dB
                      </Text>
                    </View>
                  );
                })}
              </View>
            </BlurView>
          </View>

          {/* Section: Ready-Made Presets */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Ready-Made Presets
            </Text>
            <TouchableOpacity onPress={resetEqToFlat}>
              <Text style={[styles.resetActionText, { color: colors.primary }]}>Reset Flat</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {BUILT_IN_EQ_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(255, 51, 92, 0.22)'
                          : 'rgba(255, 46, 85, 0.14)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.7)',
                      borderColor: isSelected
                        ? colors.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : '#FFFFFF',
                      shadowColor: isDark ? '#000' : '#8CA0BA',
                    },
                  ]}
                  onPress={() => selectPreset(preset.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      { color: isSelected ? colors.primary : colors.textSecondary },
                      isSelected && styles.activePresetText,
                    ]}
                  >
                    {preset.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Section: 5-Band Sliders */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Custom 5-Band Sliders
            </Text>
          </View>

          <View style={styles.slidersContainer}>
            {EQ_FREQUENCIES.map((freq) => {
              const gain = bands[freq.key];
              return (
                <View
                  key={freq.key}
                  style={[
                    styles.bandCard,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(255, 255, 255, 0.75)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(255, 255, 255, 0.9)',
                    },
                  ]}
                >
                  <View style={styles.bandHeader}>
                    <View>
                      <Text style={[styles.bandLabel, { color: colors.textPrimary }]}>
                        {freq.label}
                      </Text>
                      <Text style={[styles.bandName, { color: colors.textSecondary }]}>
                        {freq.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.gainBadge,
                        {
                          backgroundColor:
                            gain !== 0
                              ? isDark
                                ? 'rgba(255, 51, 92, 0.2)'
                                : 'rgba(255, 46, 85, 0.12)'
                              : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.04)',
                          borderColor:
                            gain !== 0 ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.gainBadgeText,
                          { color: gain !== 0 ? colors.primary : colors.textMuted },
                        ]}
                      >
                        {gain > 0 ? `+${gain}` : `${gain}`} dB
                      </Text>
                    </View>
                  </View>

                  <Slider
                    style={styles.bandSlider}
                    minimumValue={-12}
                    maximumValue={12}
                    step={1}
                    value={gain}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={
                      isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
                    }
                    thumbTintColor={colors.primary}
                    onValueChange={(val) => updateBandGain(freq.key, val)}
                  />

                  <View style={styles.scaleRow}>
                    <Text style={[styles.scaleText, { color: colors.textMuted }]}>-12 dB</Text>
                    <Text style={[styles.scaleText, { color: colors.textMuted }]}>0 dB</Text>
                    <Text style={[styles.scaleText, { color: colors.textMuted }]}>+12 dB</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
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
    height: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 51, 92, 0.12)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 60,
  },
  curveCard: {
    borderRadius: RADIUS.clay,
    borderWidth: 1.4,
    overflow: 'hidden',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  curveCardBlur: {
    padding: SPACING.md,
  },
  curveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  curveLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  enableTogglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  enableToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 90,
    position: 'relative',
  },
  zeroDbLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    top: 45,
  },
  chartCol: {
    alignItems: 'center',
    gap: 4,
  },
  chartBarWrapper: {
    height: 60,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartBar: {
    width: 10,
    borderRadius: 5,
  },
  chartGainText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  resetActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  presetsRow: {
    gap: 8,
    paddingVertical: SPACING.xs,
    paddingBottom: SPACING.md,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activePresetText: {
    fontWeight: '800',
  },
  slidersContainer: {
    gap: SPACING.sm,
  },
  bandCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
  },
  bandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bandLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  bandName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  gainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  gainBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bandSlider: {
    height: 36,
    width: '100%',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  scaleText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
});
