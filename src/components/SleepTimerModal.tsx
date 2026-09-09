import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

interface SleepTimerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ visible, onClose }) => {
  const { sleepTimerMinutes, setSleepTimer } = usePlayer();
  const { colors, isDark } = useTheme();

  const options = [
    { label: '15 Minutes', minutes: 15 },
    { label: '30 Minutes', minutes: 30 },
    { label: '45 Minutes', minutes: 45 },
    { label: '1 Hour', minutes: 60 },
  ];

  const handleSelect = (mins: number | null) => {
    setSleepTimer(mins);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF',
              shadowColor: isDark ? '#000' : '#8CA0BA',
            },
          ]}
        >
          <View style={styles.header}>
            <Ionicons name="moon" size={24} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Sleep Timer</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {sleepTimerMinutes !== null
              ? `Active: Audio will stop in ${sleepTimerMinutes} min`
              : 'Automatically pause music after a set time'}
          </Text>

          <View style={styles.optionsList}>
            {options.map((opt) => {
              const isSelected = sleepTimerMinutes === opt.minutes;
              return (
                <TouchableOpacity
                  key={opt.minutes}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.06)')
                        : colors.surface,
                      borderColor: isSelected
                        ? colors.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : '#FFFFFF',
                    },
                  ]}
                  onPress={() => handleSelect(opt.minutes)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: isSelected ? colors.primary : colors.textPrimary },
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

            {sleepTimerMinutes !== null && (
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  styles.turnOffOption,
                  { borderColor: colors.error, backgroundColor: 'rgba(239, 68, 68, 0.08)' },
                ]}
                onPress={() => handleSelect(null)}
              >
                <Text style={[styles.turnOffText, { color: colors.error }]}>Turn Off Timer</Text>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.clay + 4,
    padding: SPACING.xl,
    borderWidth: 1.8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  optionsList: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.4,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  turnOffOption: {
    marginTop: SPACING.xs,
  },
  turnOffText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
