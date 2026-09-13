/**
 * Google Drive API & OAuth 2.0 Configuration
 *
 * To connect your Google Account in production:
 * 1. Create a project in Google Cloud Console (https://console.cloud.google.com).
 * 2. Enable the "Google Drive API" in Enabled APIs & Services.
 * 3. Configure OAuth Consent Screen (Add scopes: drive.readonly, userinfo.profile, userinfo.email).
 * 4. Create an iOS OAuth Client ID with bundle identifier "com.jhet.sonance".
 * 5. Paste the Client ID into GOOGLE_IOS_CLIENT_ID below.
 */

export const GOOGLE_CONFIG = {
  // Client IDs
  IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '146606044771-nr9953rcpjbv860l4oogjqjrf0glj18i.apps.googleusercontent.com',
  ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '146606044771-nr9953rcpjbv860l4oogjqjrf0glj18i.apps.googleusercontent.com',
  WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '146606044771-nr9953rcpjbv860l4oogjqjrf0glj18i.apps.googleusercontent.com',

  // OAuth Endpoints
  AUTH_ENDPOINT: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
  REVOKE_ENDPOINT: 'https://oauth2.googleapis.com/revoke',
  USERINFO_ENDPOINT: 'https://www.googleapis.com/oauth2/v2/userinfo',

  // Google Drive REST API v3 Endpoints
  DRIVE_FILES_ENDPOINT: 'https://www.googleapis.com/drive/v3/files',

  // Required Scopes
  SCOPES: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ],

  // Storage Keys for AsyncStorage
  STORAGE_KEYS: {
    AUTH_TOKENS: '@sonance_google_drive_tokens_v1',
    USER_PROFILE: '@sonance_google_user_profile_v1',
  },

  // Supported Audio File MIME Types and Extensions
  SUPPORTED_AUDIO_MIME_TYPES: [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/flac',
    'audio/x-flac',
    'audio/wav',
    'audio/x-wav',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/aiff',
  ],
  SUPPORTED_AUDIO_EXTENSIONS: ['mp3', 'm4a', 'flac', 'wav', 'aac', 'ogg', 'opus', 'aiff', 'wma'],
};