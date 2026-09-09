import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { logger, LogEntry, LogLevel } from '../services/loggerService';
import { SPACING, RADIUS } from '../constants/theme';

interface DiagnosticsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();

  const [hostInput, setHostInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | LogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      const currentHost = logger.getHost();
      if (currentHost) {
        setHostInput(currentHost);
        checkCurrentHost(currentHost);
      }
      setLogs(logger.getLogs());

      const unsubscribe = logger.subscribe((entry) => {
        setLogs((prev) => [...prev.slice(-299), entry]);
      });

      return () => unsubscribe();
    }
  }, [visible]);

  const checkCurrentHost = async (host: string) => {
    const res = await logger.testConnection(host);
    setIsConnected(res.success);
    setConnectionStatus(res.message);
  };

  const handleTestAndSaveHost = async () => {
    if (!hostInput.trim()) {
      await logger.setHost('');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
      return;
    }

    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setIsTesting(true);
    setConnectionStatus('Connecting...');

    const res = await logger.testConnection(hostInput);
    setIsTesting(false);
    setIsConnected(res.success);
    setConnectionStatus(res.message);

    if (res.success) {
      await logger.setHost(hostInput);
      logger.info('CONSOLE', 'Connected to Windows Remote Console!');
    } else {
      Alert.alert('Connection Failed', res.message + '\n\nTip: Ensure "npm run console" is running in PowerShell on your PC and both devices are on the same Wi-Fi.');
    }
  };

  const handleSendTestLog = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    logger.info('TEST', 'Test message sent from iPhone at ' + new Date().toLocaleTimeString(), {
      platform: Platform.OS,
      model: 'iPhone',
      batteryGood: true,
    });
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    setLogs([]);
  };

  const handleCopyLogs = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const formatted = logs
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] [${l.tag}] ${l.message}` + (l.data ? ' ' + JSON.stringify(l.data) : ''))
      .join('\n');

    try {
      await Share.share({
        title: 'Sonance iOS Logs',
        message: formatted || 'No logs captured',
      });
    } catch {
      Alert.alert('Logs', formatted.slice(0, 300) + '...');
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (activeFilter !== 'ALL' && l.level !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTag = l.tag.toLowerCase().includes(q);
      const matchMsg = l.message.toLowerCase().includes(q);
      const matchData = l.data ? JSON.stringify(l.data).toLowerCase().includes(q) : false;
      if (!matchTag && !matchMsg && !matchData) return false;
    }
    return true;
  });

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return '#EF4444';
      case 'WARN':
        return '#F59E0B';
      case 'AUDIO':
        return '#EC4899';
      case 'DOWNLOAD':
        return '#3B82F6';
      case 'SEARCH':
        return '#00F2FE';
      default:
        return '#10B981';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(0, 242, 254, 0.15)', 'rgba(255, 51, 92, 0.08)', 'transparent']
              : ['rgba(0, 180, 216, 0.12)', 'rgba(255, 46, 85, 0.06)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ambientGlow}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <View style={styles.headerPill}>
                <Ionicons name="terminal" size={11} color={colors.primary} />
                <Text style={[styles.headerPillText, { color: colors.primary }]}>LIVE TELEMETRY</Text>
              </View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Windows Console & Logs
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* PC Connection Card */}
          <View
            style={[
              styles.connectionCard,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(200, 212, 228, 0.6)',
              },
            ]}
          >
            <View style={styles.connectionHeader}>
              <View style={styles.connectionStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isConnected ? '#10B981' : isTesting ? '#F59E0B' : '#64748B' },
                  ]}
                />
                <Text style={[styles.connectionStatusText, { color: isConnected ? '#10B981' : colors.textMuted }]}>
                  {connectionStatus || (isConnected ? 'Connected' : 'Offline')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSendTestLog}
                style={[
                  styles.testLogBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
              >
                <Ionicons name="paper-plane-outline" size={12} color={colors.primary} />
                <Text style={[styles.testLogBtnText, { color: colors.primary }]}>Send Ping</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={hostInput}
                onChangeText={setHostInput}
                placeholder="Windows PC IP (e.g. 192.168.1.5)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.hostInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.9)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(200, 212, 228, 0.8)',
                  },
                ]}
              />

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleTestAndSaveHost}
                style={[styles.connectBtn, { backgroundColor: colors.primary }]}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.connectBtnText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              Run <Text style={{ fontWeight: '700', color: colors.primary }}>npm run console</Text> in Windows PowerShell to stream live logs.
            </Text>
          </View>

          {/* Filter Bar */}
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {(['ALL', 'ERROR', 'WARN', 'AUDIO', 'DOWNLOAD', 'SEARCH', 'INFO'] as const).map((lvl) => {
                const isActive = activeFilter === lvl;
                return (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => setActiveFilter(lvl)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive
                          ? colors.primary
                          : isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(255, 255, 255, 0.7)',
                        borderColor: isActive
                          ? colors.primary
                          : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(200, 212, 228, 0.6)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isActive ? '#FFF' : colors.textSecondary },
                      ]}
                    >
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Box */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={14} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search in logs..."
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.textPrimary }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Terminal Log Stream Window */}
          <View
            style={[
              styles.terminalCard,
              {
                backgroundColor: isDark ? '#06090E' : '#0F172A',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.2)',
              },
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.logScrollView}
              contentContainerStyle={styles.logScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {filteredLogs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No logs captured yet.</Text>
                </View>
              ) : (
                filteredLogs.map((item) => (
                  <View key={item.id} style={styles.logRow}>
                    <Text style={styles.logTime}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </Text>
                    <View
                      style={[
                        styles.logBadge,
                        {
                          backgroundColor: getLevelColor(item.level) + '22',
                          borderColor: getLevelColor(item.level) + '55',
                        },
                      ]}
                    >
                      <Text style={[styles.logBadgeText, { color: getLevelColor(item.level) }]}>
                        {item.level}
                      </Text>
                    </View>
                    <View style={styles.logBody}>
                      <Text style={styles.logTag}>[{item.tag}]</Text>
                      <Text style={styles.logMsg}>{item.message}</Text>
                      {item.data !== undefined && item.data !== null && (
                        <Text style={styles.logData}>
                          {typeof item.data === 'object'
                            ? JSON.stringify(item.data, null, 2)
                            : String(item.data)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Bottom Actions Row */}
            <View style={styles.terminalActionsRow}>
              <Text style={styles.logCountText}>{filteredLogs.length} entries</Text>
              <View style={styles.actionButtonsGroup}>
                <TouchableOpacity activeOpacity={0.75} onPress={handleClearLogs} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={13} color="#EF4444" />
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.75} onPress={handleCopyLogs} style={styles.actionBtn}>
                  <Ionicons name="copy-outline" size={13} color="#38BDF8" />
                  <Text style={[styles.actionBtnText, { color: '#38BDF8' }]}>Copy All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    height: 300,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerInfo: {
    flex: 1,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  headerPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs + 2,
  },
  connectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  testLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  testLogBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: 6,
  },
  hostInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: 13,
  },
  connectBtn: {
    paddingHorizontal: SPACING.md,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 11,
    lineHeight: 15,
  },
  filterSection: {
    marginVertical: SPACING.xs,
  },
  filterScroll: {
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(120, 120, 128, 0.1)',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  terminalCard: {
    flex: 1,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logScrollView: {
    flex: 1,
  },
  logScrollContent: {
    padding: SPACING.sm,
    gap: 8,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  logTime: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  logBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },
  logBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  logBody: {
    flex: 1,
  },
  logTag: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMsg: {
    color: '#E2E8F0',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logData: {
    color: '#94A3B8',
    fontSize: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 4,
    borderRadius: 4,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  terminalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  logCountText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
