import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';
import { storageService } from '../services/storageService';

interface StoragePermissionModalProps {
  visible: boolean;
  onAllow: () => void;
  onCancel: () => void;
}

export const StoragePermissionModal: React.FC<StoragePermissionModalProps> = ({
  visible,
  onAllow,
  onCancel,
}) => {
  const { colors, isDark } = useTheme();

  const handleAllow = async () => {
    await storageService.setStoragePermissionGranted(true);
    onAllow();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(18, 24, 38, 0.92)'
                    : 'rgba(255, 255, 255, 0.94)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(255, 255, 255, 0.9)',
                  shadowColor: isDark ? colors.primary : '#8CA0BA',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={isDark ? 'dark' : 'light'}
                style={styles.cardBlur}
              >
                {/* Glowing Icon Header */}
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={[colors.primary, '#FF007A', '#7928CA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                  >
                    <Ionicons name="folder-open" size={36} color="#FFF" />
                  </LinearGradient>
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Save to Phone Storage
                </Text>

                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Allow Sonance to store high-fidelity music directly in your phone's storage and Files app for 100% offline playback.
                </Text>

                {/* Feature highlights */}
                <View style={styles.featuresList}>
                  <View
                    style={[
                      styles.featureRow,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureIconBadge,
                        { backgroundColor: 'rgba(0, 230, 118, 0.15)' },
                      ]}
                    >
                      <Ionicons name="phone-portrait-outline" size={18} color={colors.accentGreen} />
                    </View>
                    <View style={styles.featureTextContainer}>
                      <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
                        Direct Phone Storage
                      </Text>
                      <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                        Visible in the native Files app (On My iPhone &gt; Sonance).
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.featureRow,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureIconBadge,
                        { backgroundColor: 'rgba(0, 229, 255, 0.15)' },
                      ]}
                    >
                      <Ionicons name="airplane" size={18} color={colors.accentCyan} />
                    </View>
                    <View style={styles.featureTextContainer}>
                      <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
                        Offline Listening
                      </Text>
                      <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                        Play your tracks anytime without internet or cellular data.
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.featureRow,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureIconBadge,
                        { backgroundColor: 'rgba(255, 46, 85, 0.15)' },
                      ]}
                    >
                      <Ionicons name="share-social-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.featureTextContainer}>
                      <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
                        Export &amp; Share
                      </Text>
                      <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                        Easily export songs to iCloud, AirDrop, or local folders.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <TouchableOpacity
                  style={styles.allowBtnWrapper}
                  onPress={handleAllow}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary, '#FF007A', colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.allowBtn, { shadowColor: colors.primary }]}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.allowBtnText}>Allow Access &amp; Save Music</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                    Not Now
                  </Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: RADIUS.clay + 6,
    borderWidth: 1.6,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  cardBlur: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: SPACING.md,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md + 4,
    paddingHorizontal: SPACING.sm,
  },
  featuresList: {
    width: '100%',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  allowBtnWrapper: {
    width: '100%',
    borderRadius: RADIUS.full,
    marginBottom: SPACING.xs,
  },
  allowBtn: {
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
  allowBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  cancelBtn: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
