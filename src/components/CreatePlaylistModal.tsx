import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../constants/theme';

interface CreatePlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}
      >
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
          <Text style={[styles.title, { color: colors.textPrimary }]}>New Playlist</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Give your playlist a name
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceInset,
                color: colors.textPrimary,
                borderColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(200, 212, 228, 0.5)',
              },
            ]}
            placeholder="Playlist name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={40}
          />

          <TextInput
            style={[
              styles.input,
              styles.descInput,
              {
                backgroundColor: colors.surfaceInset,
                color: colors.textPrimary,
                borderColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(200, 212, 228, 0.5)',
              },
            ]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            maxLength={80}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.cancelBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btn,
                styles.createBtn,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                },
                !name.trim() && styles.disabledBtn,
              ]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text
                style={[
                  styles.createText,
                  { color: isDark && colors.primary === '#FFFFFF' ? '#070A10' : '#FFFFFF' },
                ]}
              >
                Create
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  input: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    fontSize: 15,
    borderWidth: 1.2,
    marginBottom: SPACING.md,
  },
  descInput: {
    height: 48,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1.2,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  createBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  createText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
