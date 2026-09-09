# Complete iPhone Sideloading & Installation Guide (Windows to iOS)

This guide walks you through testing and installing **Apple Player** directly onto your iPhone from your Windows computer for free (no \$99/year Apple Developer account needed).

---

## Method 1: Instant Testing via Expo Go (Fastest - 2 Minutes)

If you want to test and use the app immediately without building an `.ipa`:

1. **Install Expo Go** from the iOS App Store on your iPhone.
2. On your Windows PC, open terminal in this folder and run:
   ```bash
   npx expo start --tunnel
   ```
3. Open the **Camera app** on your iPhone and scan the QR code printed in the terminal.
4. The app will open directly on your iPhone with full audio playback, downloader, and offline storage!

---

## Method 2: Sideloading Standalone `.ipa` via Sideloadly (Recommended for Permanent Sideload)

To install the app as a true standalone iOS app that stays on your home screen and runs completely offline without Expo Go:

### Step 1: Generate the `.ipa` (Free via Expo Cloud)
1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Log in (create a free Expo account if you don't have one):
   ```bash
   eas login
   ```
3. Configure the build:
   ```bash
   eas build:configure
   ```
4. Build the iOS app for sideloading/simulator:
   ```bash
   eas build -p ios --profile preview
   ```
5. When the cloud build finishes (around 5-10 minutes), EAS will give you a direct download link to your `.ipa` file. Download it to your PC.

---

### Step 2: Install onto iPhone using Sideloadly on Windows
1. Download and install **[Sideloadly](https://sideloadly.io/)** (or **[AltStore](https://altstore.io/)**) on your Windows PC.
2. Connect your iPhone to your PC using a USB cable.
3. Open Sideloadly on Windows:
   - Drag and drop the downloaded `.ipa` file into Sideloadly.
   - Enter your Apple ID email (used to sign the app with your personal free certificate).
   - Click **Start**.
4. Once completed, the **Apple Player** icon will appear on your iPhone home screen!

---

### Step 3: Trust Developer Certificate on iPhone (First Time Only)
1. On your iPhone, open **Settings** → **General** → **VPN & Device Management**.
2. Under "Developer App", tap your Apple ID.
3. Tap **Trust [Your Apple ID]**.
4. On iOS 16+, enable Developer Mode if prompted: **Settings** → **Privacy & Security** → **Developer Mode** → Toggle **ON** and restart device.

---

## How to Import Your Existing Music Files from iPhone "Files" App

1. Open **Apple Player**.
2. Go to the **Library** tab and tap **Import Files** in the top right (or in **Settings**).
3. The native iOS file picker will open.
4. Navigate to **Downloads**, **On My iPhone**, or **iCloud Drive**.
5. Select any `.mp3`, `.m4a`, `.wav`, or `.flac` files.
6. The app will instantly import them with full title and duration tagging into your offline library!

---

## How to Drag-and-Drop Music from PC via USB (iTunes / Finder File Sharing)

Because we enabled `UIFileSharingEnabled` in `app.json`:
1. Connect your iPhone to your Windows PC.
2. Open **Apple Devices** app or **iTunes** on Windows.
3. Click on your iPhone icon → go to **File Sharing**.
4. Select **Apple Player**.
5. Drag and drop audio files directly from your Windows File Explorer into the folder!
6. Open the app and tap **Import Files** → select the files to add them into your player.
