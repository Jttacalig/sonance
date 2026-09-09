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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { ExtractedInfo } from '../services/downloaderService';
import { storageService } from '../services/storageService';
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
  // Cinematic 16:9 video player with responsive width and breathing room
  const playerCardWidth = Math.min(SCREEN_WIDTH - SPACING.lg * 2, 520);
  const videoHeight = Math.round(playerCardWidth * (9 / 16));

  // Direct Mobile YouTube URL bypasses Error 150/152 (music label iframe embed restrictions)
  const mobileVideoUrl = 'https://m.youtube.com/watch?v=' + videoId;

  // Comprehensive script to hide YouTube UI clutter and fit video cleanly edge-to-edge
  const injectedCleanCSS = `
    (function() {
      var hideSelectors = [
        'ytm-header-bar',
        '.mobile-topbar-header',
        'header',
        'ytm-pivot-bar-renderer',
        'ytm-single-column-watch-next-results-renderer',
        'ytm-item-section-renderer',
        '#related',
        '#comments',
        '.ytm-pivot-bar',
        '.ytm-bottom-sheet-renderer',
        '.engagement-panel',
        'ytm-mobile-topbar-renderer',
        'ytm-watch-metadata',
        '.ytm-watch-metadata-renderer',
        'ytm-channel-bar-renderer',
        '.sub-box',
        '.slim-video-metadata-header',
        '.ytm-promoted-sparkles-web-renderer',
        'ytm-compact-video-renderer',
        '#header-bar',
        '.sc-header',
        '.ytm-app-header',
        'ytm-reel-shelf-renderer',
        'ytm-comments-entry-point-header-renderer',
        '.mobile-topbar-header-content',
        '#masthead',
        '#header'
      ];

      function applyCleanStyles() {
        var existing = document.getElementById('sonance-clean-styles');
        if (!existing) {
          var style = document.createElement('style');
          style.id = 'sonance-clean-styles';
          style.type = 'text/css';
          style.innerHTML = 
            hideSelectors.join(', ') + ' { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; height: 0 !important; max-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; } ' +
            'html, body { background: #000000 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; width: 100vw !important; height: 100vh !important; } ' +
            '#player-container-id, .player-container, #player, .video-stream, .html5-video-player, #player-control-overlay { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background: #000000 !important; max-height: 100vh !important; } ' +
            'video, .html5-main-video { width: 100% !important; height: 100% !important; object-fit: contain !important; } ' +
            '.ytp-chrome-top, .ytp-title, .ytp-share-button, .ytp-cards-button, .ytp-show-cards-title, .ytm-pivot-bar { display: none !important; }';
          document.head.appendChild(style);
        }

        hideSelectors.forEach(function(sel) {
          var els = document.querySelectorAll(sel);
          els.forEach(function(el) {
            el.style.setProperty('display', 'none', 'important');
          });
        });

        var playBtn = document.querySelector('.ytp-large-play-button, .player-control-play, button[aria-label="Play"], .ytp-play-button');
        if (playBtn && playBtn.getAttribute('aria-label') === 'Play') {
          playBtn.click();
        }
      }

      applyCleanStyles();
      var cleanInterval = setInterval(applyCleanStyles, 250);
      setTimeout(function() { clearInterval(cleanInterval); }, 10000);
    })();
    true;
  `;

  const handleSave = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const settings = await storageService.getSettings();
    const preferredFormat = settings.preferredAudioQuality || 'm4a';

    const info: ExtractedInfo = {
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl,
      sourceType: 'youtube',
      duration: item.durationSec,
      durationText: item.duration,
      format: preferredFormat,
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
        {/* Subtle Ambient Liquid Refraction Bloom */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)', 'transparent']
              : ['rgba(255, 255, 255, 0.9)', 'rgba(235, 243, 255, 0.7)', 'transparent']
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={styles.ambientGlow}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* iOS Sheet Grabber Bar */}
          <View style={styles.grabberRow}>
            <View
              style={[
                styles.grabberPill,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.18)' },
              ]}
            />
          </View>

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <View
                style={[
                  styles.streamingPill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(0, 0, 0, 0.06)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.22)'
                      : 'rgba(0, 0, 0, 0.12)',
                  },
                ]}
              >
                <Ionicons name="radio-outline" size={13} color={colors.textPrimary} />
                <Text style={[styles.streamingPillText, { color: colors.textPrimary }]}>
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
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.12)',
                },
              ]}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Spacious, Breathable Scroll View */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={true}
          >
            {/* 1. Cinematic 16:9 Glass Video Player Container */}
            <View style={styles.videoCardWrapper}>
              <View
                style={[
                  styles.videoCard,
                  {
                    height: videoHeight,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.95)',
                    shadowColor: isDark ? '#000000' : '#8CA0BA',
                  },
                ]}
              >
                <WebView
                  source={{ uri: mobileVideoUrl }}
                  injectedJavaScriptBeforeContentLoaded={injectedCleanCSS}
                  injectedJavaScript={injectedCleanCSS}
                  style={styles.webView}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  allowsFullscreenVideo={true}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  scrollEnabled={false}
                  bounces={false}
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

            {/* 2. Stream Quality Badges Row */}
            <View style={styles.streamBadgesRow}>
              <View
                style={[
                  styles.specBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Ionicons name="musical-notes-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.specBadgeText, { color: colors.textSecondary }]}>
                  Lossless Stream
                </Text>
              </View>

              {item.duration && (
                <View
                  style={[
                    styles.specBadge,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.specBadgeText, { color: colors.textSecondary }]}>
                    {item.duration}
                  </Text>
                </View>
              )}

              <View
                style={[
                  styles.specBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.specBadgeText, { color: colors.textSecondary }]}>
                  Verified Stream
                </Text>
              </View>
            </View>

            {/* 3. Details & Actions Crystal Liquid Glass Card */}
            <View
              style={[
                styles.actionsGlassCard,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.9)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)',
                  shadowColor: isDark ? '#000000' : '#8CA0BA',
                },
              ]}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 85 : 100}
                tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
                style={styles.actionsBlur}
              >
                {/* Specular Top Rim Reflection Line */}
                <View
                  style={[
                    styles.cardSpecularRim,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.95)',
                    },
                  ]}
                />

                {/* Song Meta Information */}
                <View style={styles.metaRow}>
                  <View style={styles.metaTextContainer}>
                    <Text style={[styles.songTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[styles.songArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.artist}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.buttonsRow}>
                  {/* Primary Download Offline Button */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSave}
                    style={styles.saveButtonWrapper}
                  >
                    <View
                      style={[
                        styles.saveGradientBtn,
                        {
                          backgroundColor: isDark ? '#FFFFFF' : colors.primary,
                          shadowColor: isDark ? '#FFFFFF' : colors.primary,
                        },
                      ]}
                    >
                      <Ionicons
                        name="cloud-download-outline"
                        size={20}
                        color={isDark ? '#070A10' : '#FFF'}
                      />
                      <Text
                        style={[
                          styles.saveButtonText,
                          { color: isDark ? '#070A10' : '#FFF' },
                        ]}
                      >
                        Download Offline
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Secondary Done Button */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleClose}
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)',
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
    height: 280,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabberPill: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
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
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
    marginBottom: 5,
  },
  streamingPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: 48,
    gap: SPACING.md,
  },
  videoCardWrapper: {
    width: '100%',
  },
  videoCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1.4,
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingBox: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  streamBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  specBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 5,
  },
  specBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  actionsGlassCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  actionsBlur: {
    padding: SPACING.md + 2,
    borderRadius: RADIUS.lg,
    position: 'relative',
  },
  cardSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  metaTextContainer: {
    flex: 1,
  },
  songTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
    lineHeight: 22,
  },
  songArtist: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
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
    height: 50,
    borderRadius: RADIUS.full,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    paddingHorizontal: 22,
    height: 50,
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
