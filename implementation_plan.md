# Direct Stream Extraction Engine — VidMate-Style Architecture

Upgrade Sonance's downloader from proxy-dependent (cobalt/loader.to) to direct YouTube stream extraction using Piped/Invidious APIs, plus clipboard auto-detection and multi-platform support.

## Why This Matters

Currently, downloads fail because:
- `loader.to` rate-limits or goes down → converter errors
- Cobalt instances get blocked → corrupt files  
- We have zero control over audio quality/bitrate

After this change:
- **Direct Google CDN downloads** — no middleman
- **Exact bitrate control** — pick 128kbps AAC, 160kbps Opus, etc.
- **Automatic failover** — 6+ Piped instances + 4+ Invidious instances + existing cobalt/loader.to as last resort
- **Clipboard detection** — paste a link from any app, Sonance detects it
- **Multi-platform badges** — show users they can download from YouTube, SoundCloud, Instagram, TikTok, Twitter

---

## Proposed Changes

### Stream Extraction Engine

#### [NEW] [streamExtractorService.ts](file:///c:/Projects/apple-player/src/services/streamExtractorService.ts)

New service that replaces cobalt/loader.to as the **primary** stream resolver for YouTube:

```
Resolution Pipeline (in order):
1. Piped API     → GET /streams/{videoId} → audioStreams[]
2. Invidious API → GET /api/v1/videos/{videoId} → adaptiveFormats[]
3. loader.to     → existing primary resolver (fallback)
4. Cobalt API    → existing secondary resolver (last resort)
```

Key features:
- **6+ Piped instances** as failover pool: `pipedapi.kavin.rocks`, `api.piped.yt`, `pipedapi.r4fo.com`, etc.
- **4+ Invidious instances** as secondary pool: `inv.tux.pizza`, `invidious.fdn.fr`, etc.
- Picks best audio stream by format preference:
  - M4A preferred → `itag 140` (128kbps AAC) or `itag 141` (256kbps AAC)
  - MP3 preferred → falls back to cobalt/loader.to (Piped/Invidious serve raw streams, not transcoded MP3)
  - FLAC/WAV preferred → falls back to cobalt/loader.to
- Returns `{ streamUrl, bitrate, codec, contentLength, finalExtension }`

---

#### [MODIFY] [downloaderService.ts](file:///c:/Projects/apple-player/src/services/downloaderService.ts)

Update `resolveAudioStreamUrl()` to use the new pipeline:

- **For YouTube URLs (M4A/Opus)**: Try `streamExtractorService` first (Piped → Invidious), which returns direct Google CDN URLs. Only fall back to loader.to/cobalt if all instances fail.
- **For YouTube URLs (MP3/FLAC/WAV)**: These require server-side transcoding, so use loader.to/cobalt as before.
- **For non-YouTube URLs** (SoundCloud, Instagram, TikTok, Twitter): Use cobalt directly (it already handles these platforms).
- The mutex serialization stays — it protects all API calls regardless of backend.

---

#### [MODIFY] [endpoints.ts](file:///c:/Projects/apple-player/src/constants/endpoints.ts)

Add Piped and Invidious instance arrays:

```typescript
export const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.yt',
  'https://pipedapi.r4fo.com',
  'https://piped-api.lunar.icu',
  'https://pipedapi.darkness.services',
  'https://piped-api.ducks.party',
];

export const INVIDIOUS_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.fdn.fr',
  'https://invidious.privacyredirect.com',
  'https://vid.puffyan.us',
];
```

---

### Clipboard Auto-Detection

#### [MODIFY] [DownloaderScreen.tsx](file:///c:/Projects/apple-player/src/screens/DownloaderScreen.tsx)

- On screen focus, check clipboard for media URLs (YouTube, SoundCloud, Instagram, TikTok, Twitter, Facebook)
- Show a frosted glass banner at top: "🔗 Link detected — Download from YouTube?" with a "Download" button
- Tapping "Download" auto-fills the URL and triggers the format selection modal
- Banner dismisses on "✕" tap or after download starts
- Uses `expo-clipboard` to read clipboard content

---

### Multi-Platform URL Support

#### [MODIFY] [DownloaderScreen.tsx](file:///c:/Projects/apple-player/src/screens/DownloaderScreen.tsx)

- When user pastes a URL (detected by pattern matching in the search input), show platform-specific behavior:
  - YouTube URL → use new direct stream extraction (Piped/Invidious)
  - SoundCloud/Instagram/TikTok/Twitter/Facebook URL → use cobalt API
  - Direct audio URL (.mp3, .m4a, etc.) → download directly
- Show platform icon badge next to the URL input when a platform is detected
- Update placeholder text: `"Search songs or paste any link..."`

#### [MODIFY] [downloaderService.ts](file:///c:/Projects/apple-player/src/services/downloaderService.ts)

- Expand `detectSourceType()` to recognize Instagram, TikTok, Twitter/X, Facebook URLs
- Route each platform to the appropriate extraction backend

---

## Open Questions

> [!IMPORTANT]
> **MP3/FLAC/WAV downloads**: Piped and Invidious only serve raw YouTube streams (M4A AAC or WebM Opus). They cannot transcode to MP3/FLAC/WAV. For these formats, we must still use loader.to or cobalt. Is this acceptable? The majority of downloads will be M4A which benefits the most from direct extraction.

> [!NOTE]
> **Piped/Invidious instance health**: Public instances go up and down. We'll try all instances in sequence with 5s timeout each. If all fail, we fall back to loader.to/cobalt. Should we also add a Settings option to configure custom Piped/Invidious instance URLs?

---

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` — zero TypeScript errors
- `npx expo-doctor` — all checks pass

### Manual Verification
- Download a YouTube song with M4A format → should use Piped/Invidious (direct CDN)
- Download a YouTube song with MP3 format → should fall back to loader.to/cobalt
- Download from SoundCloud URL → should use cobalt
- Paste a YouTube link from clipboard → should show detection banner
- Download 3 songs simultaneously → should serialize stream resolution, parallel file downloads
- All downloads should pass audio header validation
