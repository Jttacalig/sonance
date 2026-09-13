import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { CloudProviderType } from '../types/music';
import { googleDriveService } from '../services/googleDriveService';
import { dropboxService } from '../services/dropboxService';
import { oneDriveService } from '../services/oneDriveService';
import { webDavService } from '../services/webDavService';
import { GOOGLE_CONFIG } from '../constants/googleConfig';
import { SPACING, RADIUS } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CloudConnectModalProps {
  visible: boolean;
  provider: CloudProviderType | null;
  onClose: () => void;
  onConnected: () => void;
}

export const CloudConnectModal: React.FC<CloudConnectModalProps> = ({
  visible,
  provider,
  onClose,
  onConnected,
}) => {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);

  // Modes: 'options' | 'browser' | 'webdav'
  const [connectMode, setConnectMode] = useState<'options' | 'browser' | 'webdav'>('options');
  const [browserUrl, setBrowserUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);

  // Custom Google Client ID
  const [customClientId, setCustomClientId] = useState('');
  const [showAdvancedGoogle, setShowAdvancedGoogle] = useState(false);

  // WebDAV fields
  const [serverUrl, setServerUrl] = useState('');
  const [serverName, setServerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Manual token input
  const [manualToken, setManualToken] = useState('');

  // Reset state on open & load custom client ID
  useEffect(() => {
    if (visible) {
      if (provider === 'webdav') {
        setConnectMode('webdav');
      } else {
        setConnectMode('options');
      }
      setBrowserUrl('');
      setIsLoading(false);
      setManualToken('');

      if (provider === 'gdrive') {
        googleDriveService.getCustomClientId().then((cid) => {
          setCustomClientId(cid);
        });
      }
    }
  }, [visible, provider]);

  if (!provider) return null;

  const getProviderInfo = () => {
    switch (provider) {
      case 'gdrive':
        return {
          name: 'Google Drive',
          icon: 'logo-google',
          color: '#4285F4',
          domain: 'accounts.google.com',
          desc: 'Stream music directly from your Google Drive folders with 0 MB storage used.',
          getClientId: () => customClientId || GOOGLE_CONFIG.WEB_CLIENT_ID,
        };
      case 'dropbox':
        return {
          name: 'Dropbox',
          icon: 'logo-dropbox',
          color: '#0061FF',
          domain: 'dropbox.com',
          desc: 'Access your Dropbox music library and stream with high-speed direct CDN links.',
          getClientId: () => 'w97qfqc0n6v9b2v',
        };
      case 'onedrive':
        return {
          name: 'Microsoft OneDrive',
          icon: 'cloudy',
          color: '#0078D4',
          domain: 'login.microsoftonline.com',
          desc: 'Connect your personal or Microsoft 365 OneDrive and stream audio in full fidelity.',
          getClientId: () => 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
        };
      case 'webdav':
        return {
          name: 'WebDAV / Nextcloud / NAS',
          icon: 'server',
          color: '#00A86B',
          domain: 'remote-server',
          desc: 'Connect to your home NAS, Nextcloud, ownCloud, Synology, or TrueNAS server.',
          getClientId: () => '',
        };
      default:
        return {
          name: 'Cloud Storage',
          icon: 'cloud',
          color: '#007AFF',
          domain: 'cloud',
          desc: 'Connect your cloud storage.',
          getClientId: () => '',
        };
    }
  };

  const providerInfo = getProviderInfo();

  /**
   * Generates the OAuth authorization URL with the app's redirect scheme (sonance://oauth-callback)
   */
  const buildAuthUrl = (redirectUrl: string): string => {
    if (provider === 'gdrive') {
      const clientId = providerInfo.getClientId();
      if (!clientId) return '';
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email')}&prompt=consent`;
    }
    if (provider === 'dropbox') {
      const clientId = providerInfo.getClientId();
      return `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUrl)}`;
    }
    if (provider === 'onedrive') {
      const clientId = providerInfo.getClientId();
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent('Files.Read User.Read')}`;
    }
    return '';
  };

  /**
   * 1. SYSTEM DEFAULT BROWSER AUTH (ASWebAuthenticationSession / Custom Tabs)
   * Prompts the phone system dialog and opens default Safari/Chrome, then auto-redirects back to app
   */
  const handleSystemBrowserAuth = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    if (provider === 'webdav') {
      setConnectMode('webdav');
      return;
    }

    // Determine redirect URL (matches the registered URI in Google Console)
    const redirectUrl = provider === 'gdrive'
      ? 'https://auth.expo.io/@jhet/apple-player'
      : Linking.createURL('oauth-callback');
    const authUrl = buildAuthUrl(redirectUrl);

    if (!authUrl) {
      // If direct browser URL is unavailable, open in-app sheet
      setBrowserUrl(buildAuthUrl('https://localhost/oauth-callback'));
      setConnectMode('browser');
      return;
    }

    try {
      setIsLoading(true);

      // Opens system modal ("Sonance Wants to Use [domain] to Sign In") -> opens Safari/Chrome -> auto-redirects
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl, {
        showInRecents: true,
        preferEphemeralSession: false,
      });

      if (result.type === 'success' && result.url) {
        await processCallbackUrl(result.url);
      }
    } catch (err: any) {
      console.warn('System browser auth failed, opening in-app sheet:', err);
      // Fallback to in-app sheet if system browser is unavailable
      setBrowserUrl(authUrl);
      setConnectMode('browser');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRedirectUri = async () => {
    if (Haptics.notificationAsync) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await Clipboard.setStringAsync('sonance://oauth-callback');
    Alert.alert('Copied!', 'Copied "sonance://oauth-callback" to clipboard.');
  };

  const handleSaveCustomClientId = async () => {
    if (!customClientId.trim()) {
      Alert.alert('Error', 'Please enter a valid Google Client ID.');
      return;
    }
    await googleDriveService.saveCustomClientId(customClientId.trim());
    if (Haptics.notificationAsync) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    Alert.alert('Saved', 'Custom Google Client ID saved. You can now tap "Log In with Default Browser".');
  };

  /**
   * 2. IN-APP SHEET AUTH
   * Opens the in-app WebView without leaving the app
   */
  const handleStartInAppBrowserAuth = () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (provider === 'webdav') {
      setConnectMode('webdav');
      return;
    }

    const redirectUrl = 'https://localhost/oauth-callback';
    const authUrl = buildAuthUrl(redirectUrl);

    if (authUrl) {
      setBrowserUrl(authUrl);
      setConnectMode('browser');
    } else {
      Alert.alert('Auth Configuration', 'Please enter your access token or server configuration.');
    }
  };

  /**
   * Extracts access_token / code from redirect URLs and saves auth credentials
   */
  const processCallbackUrl = async (url: string): Promise<boolean> => {
    if (!url) return false;

    try {
      setIsLoading(true);
      let token: string | null = null;
      let accountId: string | undefined;

      // 1. Search hash parameters (#access_token=...&...)
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const hashStr = url.substring(hashIndex + 1);
        const hashParams = new URLSearchParams(hashStr);
        token = hashParams.get('access_token') || hashParams.get('code');
        accountId = hashParams.get('account_id') || undefined;
      }

      // 2. Search query parameters (?access_token=... or ?code=...)
      if (!token) {
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          const queryStr = url.substring(queryIndex + 1);
          const queryParams = new URLSearchParams(queryStr);
          token = queryParams.get('access_token') || queryParams.get('code');
          if (!accountId) {
            accountId = queryParams.get('account_id') || undefined;
          }
        }
      }

      // 3. Fallback regex match
      if (!token) {
        const tokenMatch = url.match(/[#?&]access_token=([^&]+)/);
        if (tokenMatch) {
          token = decodeURIComponent(tokenMatch[1]);
        }
        const codeMatch = url.match(/[#?&]code=([^&]+)/);
        if (!token && codeMatch) {
          token = decodeURIComponent(codeMatch[1]);
        }
      }

      if (token) {
        if (provider === 'dropbox') {
          await dropboxService.saveTokens({
            accessToken: token,
            accountId,
          });
        } else if (provider === 'gdrive') {
          await googleDriveService.saveAuthTokens({
            accessToken: token,
            expiresAt: Date.now() + 3600 * 1000,
          });
        } else if (provider === 'onedrive') {
          await oneDriveService.saveTokens({
            accessToken: token,
            expiresAt: Date.now() + 3600 * 1000,
          });
        }

        if (Haptics.notificationAsync) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }

        Alert.alert('✨ Connected!', `Successfully connected to ${providerInfo.name}.`);
        onConnected();
        onClose();
        return true;
      }
    } catch (err: any) {
      Alert.alert('Auth Error', err?.message || 'Failed to complete cloud authentication.');
    } finally {
      setIsLoading(false);
    }
    return false;
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setManualToken(text.trim());
      } else {
        Alert.alert('Clipboard Empty', 'No text found in your clipboard to paste.');
      }
    } catch {
      Alert.alert('Clipboard Error', 'Unable to access clipboard.');
    }
  };

  const handleSaveManualToken = async () => {
    const token = manualToken.trim();
    if (!token) {
      Alert.alert('Error', 'Please enter or paste a valid Access Token.');
      return;
    }

    try {
      setIsLoading(true);
      if (provider === 'gdrive') {
        await googleDriveService.saveAuthTokens({
          accessToken: token,
          expiresAt: Date.now() + 3600 * 1000,
        });
      } else if (provider === 'dropbox') {
        await dropboxService.saveTokens({
          accessToken: token,
        });
      } else if (provider === 'onedrive') {
        await oneDriveService.saveTokens({
          accessToken: token,
          expiresAt: Date.now() + 3600 * 1000,
        });
      }

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert('Success', `Connected to ${providerInfo.name}!`);
      onConnected();
      onClose();
    } catch (e: any) {
      Alert.alert('Connection Failed', e?.message || 'Invalid token or unable to authenticate.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAndSaveWebDav = async () => {
    if (!serverUrl.trim() || !username.trim()) {
      Alert.alert('Missing Fields', 'Please enter both Server URL and Username.');
      return;
    }

    try {
      setIsLoading(true);
      const config = {
        serverUrl: serverUrl.trim(),
        serverName: serverName.trim() || 'My WebDAV Server',
        username: username.trim(),
        password: password.trim(),
      };

      const testRes = await webDavService.testConnection(config);
      if (!testRes.success) {
        Alert.alert('Connection Test Failed', testRes.message);
        return;
      }

      await webDavService.saveConfig(config);

      if (Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      Alert.alert('✨ WebDAV Connected', 'Successfully connected to your server!');
      onConnected();
      onClose();
    } catch (e: any) {
      Alert.alert('WebDAV Error', e?.message || 'Failed to connect to WebDAV server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 90 : 95}
            tint={Platform.OS === 'ios' ? 'systemUltraThinMaterial' : (isDark ? 'dark' : 'light')}
            style={StyleSheet.absoluteFill}
          />
          {/* Glass Tint Backdrop */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(10, 14, 24, 0.82)' : 'rgba(255, 255, 255, 0.92)' },
            ]}
          />

          {/* Top Specular Rim */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.08)', 'transparent']
                : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.20)', 'transparent']
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0 }}
            style={styles.modalTopRim}
          />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              {connectMode === 'browser' ? (
                <TouchableOpacity
                  onPress={() => {
                    setConnectMode('options');
                    setBrowserUrl('');
                  }}
                  style={styles.backBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.providerIconOrb,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                >
                  <Ionicons name={providerInfo.icon as any} size={22} color={providerInfo.color} />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {connectMode === 'browser'
                    ? `Sign In to ${providerInfo.name}`
                    : `Connect ${providerInfo.name}`}
                </Text>
                {connectMode === 'browser' ? (
                  <View style={styles.sslRow}>
                    <Ionicons name="lock-closed" size={11} color="#00C853" style={{ marginRight: 3 }} />
                    <Text style={[styles.sslText, { color: colors.textMuted }]}>
                      {providerInfo.domain}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                    VLC-Style Cloud Streaming
                  </Text>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {connectMode === 'browser' && (
                <TouchableOpacity
                  onPress={() => setWebViewKey((k) => k + 1)}
                  style={styles.actionIconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="reload" size={19} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content View Modes */}
          {connectMode === 'browser' && browserUrl ? (
            /* ==================================================== */
            /* 1. IN-APP OAUTH WEBVIEW BROWSER (FALLBACK/SHEET)    */
            /* ==================================================== */
            <View style={styles.browserContainer}>
              <WebView
                key={webViewKey}
                ref={webViewRef}
                source={{ uri: browserUrl }}
                onShouldStartLoadWithRequest={(request) => {
                  const shouldBlock = (
                    request.url.includes('access_token=') ||
                    request.url.includes('code=') ||
                    request.url.includes('oauth-callback')
                  );
                  if (shouldBlock) {
                    processCallbackUrl(request.url);
                    return false;
                  }
                  return true;
                }}
                onNavigationStateChange={(navState: WebViewNavigation) => {
                  if (
                    navState.url.includes('access_token=') ||
                    navState.url.includes('code=') ||
                    navState.url.includes('oauth-callback')
                  ) {
                    processCallbackUrl(navState.url);
                  }
                }}
                userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
                startInLoadingState={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                sharedCookiesEnabled={true}
                style={styles.webview}
                renderLoading={() => (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={providerInfo.color} />
                    <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
                      Opening {providerInfo.name} secure login...
                    </Text>
                    <Text style={[styles.loadingSubtext, { color: colors.textMuted }]}>
                      Sign in with your account to authorize Sonance
                    </Text>
                  </View>
                )}
                renderError={(errorDomain, errorCode, errorDesc) => (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={40} color="#FF3B30" />
                    <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
                      Unable to Load Login Page
                    </Text>
                    <Text style={[styles.errorDesc, { color: colors.textMuted }]}>
                      {errorDesc || 'Please check your internet connection and try again.'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.retryBtn, { backgroundColor: providerInfo.color }]}
                      onPress={() => setWebViewKey((k) => k + 1)}
                    >
                      <Text style={styles.retryBtnText}>Retry Connection</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          ) : connectMode === 'webdav' || provider === 'webdav' ? (
            /* ==================================================== */
            /* 2. WEBDAV / NAS SERVER CONFIGURATION FORM           */
            /* ==================================================== */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.formDesc, { color: colors.textMuted }]}>
                Connect to any WebDAV-compatible server (Nextcloud, ownCloud, Synology NAS, TrueNAS, QNAP) to stream music with 0 MB device storage.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Server URL *</Text>
                <TextInput
                  style={[
                    styles.glassInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                  placeholder="https://cloud.example.com/remote.php/webdav"
                  placeholderTextColor={colors.textMuted}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Server Name (Optional)</Text>
                <TextInput
                  style={[
                    styles.glassInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                  placeholder="Home NAS / Nextcloud"
                  placeholderTextColor={colors.textMuted}
                  value={serverName}
                  onChangeText={setServerName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Username *</Text>
                <TextInput
                  style={[
                    styles.glassInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                  placeholder="username or email"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Password / App Password</Text>
                <TextInput
                  style={[
                    styles.glassInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                    },
                  ]}
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={styles.connectGlassBtn}
                onPress={handleTestAndSaveWebDav}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#00A86B', '#008554']}
                  style={styles.connectBtnGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.connectBtnText}>Test & Connect WebDAV</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* ==================================================== */
            /* 3. CLOUD PROVIDER OPTIONS VIEW                      */
            /* ==================================================== */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.optionsContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.promoBox}>
                <Text style={[styles.promoDescText, { color: colors.textPrimary }]}>
                  {providerInfo.desc}
                </Text>
              </View>

              {/* Action 1: Consumer-Grade 1-Tap Browser Sign In */}
              <TouchableOpacity
                style={styles.actionCardBtn}
                onPress={handleSystemBrowserAuth}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[providerInfo.color, '#12448F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionCardGradient}
                >
                  <View style={styles.actionIconRoundel}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name={providerInfo.icon as any} size={22} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionCardTitle}>Sign In with {providerInfo.name}</Text>
                    <Text style={styles.actionCardSubtitle}>
                      1-Tap Default Browser Sign In • 0 MB Storage
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Action 2: Secondary In-App Web View Option */}
              <TouchableOpacity
                style={[
                  styles.secondaryCardBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
                onPress={handleStartInAppBrowserAuth}
                activeOpacity={0.8}
              >
                <Ionicons name="phone-portrait-outline" size={18} color={colors.textPrimary} style={{ marginRight: 10 }} />
                <Text style={[styles.secondaryCardText, { color: colors.textPrimary }]}>
                  Open In-App Web View instead
                </Text>
              </TouchableOpacity>

              {/* Action 3: Direct Token / Shared Link Input */}
              <View
                style={[
                  styles.manualBox,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <View style={styles.manualHeaderRow}>
                  <Text style={[styles.manualLabel, { color: colors.textPrimary }]}>
                    {provider === 'gdrive' ? 'Paste Token or Shared Folder Link:' : 'Paste Access Token:'}
                  </Text>
                  <TouchableOpacity
                    onPress={handlePasteFromClipboard}
                    style={styles.clipboardChip}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="clipboard-outline" size={14} color={providerInfo.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.clipboardChipText, { color: providerInfo.color }]}>
                      Paste from Clipboard
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.glassInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
                      marginBottom: SPACING.md,
                    },
                  ]}
                  placeholder={
                    provider === 'gdrive'
                      ? 'Paste access token or Google Drive folder link...'
                      : 'Paste access token...'
                  }
                  placeholderTextColor={colors.textMuted}
                  value={manualToken}
                  onChangeText={setManualToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[styles.smallConnectBtn, { backgroundColor: providerInfo.color }]}
                  onPress={handleSaveManualToken}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.smallConnectBtnText}>Save & Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.88,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderBottomWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 24,
  },
  modalTopRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    zIndex: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 5,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  backBtn: {
    padding: 6,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  providerIconOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  sslRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  sslText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionIconBtn: {
    padding: 6,
  },
  closeBtn: {
    padding: 4,
  },
  browserContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  loadingBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    gap: 10,
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: SPACING.xl,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS.full,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  optionsContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  promoBox: {
    paddingVertical: SPACING.xs,
  },
  promoDescText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  fastTokenCard: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  fastTokenGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md + 2,
    borderRadius: RADIUS.xl,
  },
  fastTokenIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastTokenTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  fastTokenSubtitle: {
    color: 'rgba(255, 255, 255, 0.90)',
    fontSize: 11,
    marginTop: 2,
  },
  actionCardBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  actionCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md + 4,
    borderRadius: RADIUS.xl,
  },
  actionIconRoundel: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  actionCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  secondaryCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  secondaryCardText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manualBox: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
  },
  manualHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  manualLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  clipboardChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  glassInput: {
    height: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
  },
  smallConnectBtn: {
    height: 46,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallConnectBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  formDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  connectGlassBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginTop: SPACING.sm,
    shadowColor: '#00A86B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  connectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

