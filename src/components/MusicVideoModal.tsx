import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { ExtractedInfo } from '../services/downloaderService';
import { SPACING, RADIUS } from '../constants/theme';

interface MusicVideoModalProps {
  visible: boolean;
  item: {
    id: string;
    title: string;
    artist: string;
    sourceUrl: string;
    thumbnailUrl?: string;
    duration?: string;
    durationSec?: number;
  } | null;
  onClose: () => void;
  onSaveOffline: (item: ExtractedInfo) => void;
}

export const MusicVideoModal: React.FC<MusicVideoModalProps> = ({
  visible,
  item,
  onClose,
  onSaveOffline,
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { colors, isDark } = useTheme();

  if (!item) return null;

  const extractVideoId = (url: string): string => {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : item.id;
  };

  const videoId = extractVideoId(item.sourceUrl);
  const videoHeight = Math.min((SCREEN_WIDTH - SPACING.md * 2) * (9 / 16), 260);

  // Direct Mobile YouTube URL bypasses Error 150/152 (music label iframe embed restrictions)
  const mobileVideoUrl = 'https://m.youtube.com/watch?v=' + videoId;

  // Clean injection script to hide YouTube UI clutter and fit video cleanly
  const injectedCleanCSS = [
    '(function() {',
    '  var style = document.createElement("style");',
    '  style.type = "text/css";',
    '  style.innerHTML = [',
    '    "ytm-header-bar, .mobile-topbar-header, header, ytm-pivot-bar-renderer, ytm-single-column-watch-next-results-renderer, ytm-item-section-renderer, #related, #comments, .ytm-pivot-bar, .ytm-bottom-sheet-renderer, .engagement-panel { display: none !important; }",',
    '    "body, html { background: #000000 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }",',
    '    "#player-container-id, .player-container, #player { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 99999 !important; background: #000000 !important; }",',
    '    "video, .html5-main-video { width: 100% !important; height: 100% !important; object-fit: contain !important; }"',
    '  ].join("\\n");',
    '  document.head.appendChild(style);',
    '',
    '  setTimeout(function() {',
    '    var btn = document.querySelector(".ytp-large-play-button, .player-control-play, button[aria-label=\"Play\"]");',
    '    if (btn) {',
    '      btn.click();',
    '    }',
    '  }, 700);',
    '})();',
    'true;'
  ].join('\n');

  const handleSave = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const info: ExtractedInfo = {
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl,
      sourceType: 'youtube',
      duration: item.durationSec,
      durationText: item.duration,
      format: 'm4a',
    };
    onSaveOffline(info);
  };

  const handleClose = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(0, 242, 254, 0.18)', 'rgba(255, 51, 92, 0.12)', 'transparent']
              : ['rgba(0, 180, 216, 0.15)', 'rgba(255, 46, 85, 0.1)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ambientGlow}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <View
                style={[
                  styles.streamingPill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 242, 254, 0.15)'
                      : 'rgba(255, 46, 85, 0.12)',
                  },
                ]}
              >
                <Ionicons name="play" size={11} color={colors.primary} />
                <Text style={[styles.streamingPillText, { color: colors.primary }]}>
                  STREAM PREVIEW
                </Text>
              </View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleClose}
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

          {/* Clean Mobile Video Stream Player */}
          <View style={styles.videoContainer}>
            <View
              style={[
                styles.videoCard,
                {
                  height: videoHeight,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.95)',
                  shadowColor: isDark ? '#00F2FE' : '#8CA0BA',
                },
              ]}
            >
              <WebView
                source={{ uri: mobileVideoUrl }}
                injectedJavaScript={injectedCleanCSS}
                style={styles.webView}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                      Connecting Stream...
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>

          {/* Details & Actions Card */}
          <View
            style={[
              styles.actionsGlassCard,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.85)',
                shadowColor: isDark ? '#000' : '#8CA0BA',
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.actionsBlur}
            >
              {/* Song Meta */}
              <View style={styles.metaRow}>
                <View style={styles.metaTextContainer}>
                  <Text style={[styles.songTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.songArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </View>

                {item.duration && (
                  <View
                    style={[
                      styles.durationBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={[styles.durationText, { color: colors.textMuted }]}>
                      {item.duration}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSave}
                  style={styles.saveButtonWrapper}
                >
                  <LinearGradient
                    colors={[colors.primary, '#FF007A', colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveGradientBtn}
                  >
                    <Ionicons name="arrow-down-circle" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>Download Offline</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleClose}
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
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
    paddingBottom: SPACING.sm,
  },
  headerInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  streamingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    gap: 4,
    marginBottom: 4,
  },
  streamingPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
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
  videoContainer: {
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
  },
  videoCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.4,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingBox: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsGlassCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  actionsBlur: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  metaTextContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  songTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 13,
    fontWeight: '600',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  saveButtonWrapper: {
    flex: 1,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  saveGradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: RADIUS.full,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
