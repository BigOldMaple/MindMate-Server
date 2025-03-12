# MindMate Development Guide

## Prerequisites
- Node.js installed
- Java Development Kit (JDK) 17
- Android Studio (for Android SDK)
- USB cable for physical device testing (data cable, not just charging)
- Android device with USB debugging enabled

## Initial Setup

1. Install Dependencies:
```bash
npm install
```

2. Install Expo CLI globally:
```bash
npm install -g expo-cli
```

## Development Environment Setup

### Android Device Setup
1. Enable Developer Options:
   - Go to Settings
   - About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings
   - Developer Options will now be available

2. Enable USB Debugging:
   - Go to Developer Options
   - Enable "USB Debugging"
   - Enable "Stay awake"
   - Enable "USB debugging (Security settings)"
   - Connect device via USB
   - Accept USB debugging prompt on device

3. USB Connection Settings:
   - Set USB preference to "File Transfer" or "MTP" mode
   - Avoid "Charging only" mode
   - Use a high-quality data cable
   - Try different USB ports if connection is unstable

4. Battery Optimization:
   - Go to Settings > Battery
   - Find Developer Options/USB Debugging
   - Set to "Don't optimize" or "Unrestricted"

### Project Build Steps

1. Clean the project (after making changes):
```bash
cd android
gradlew clean
cd..
```

2. Build and run on device:
```bash
npx expo run:android
```

## Quick Development Tasks

### APK Installation Without Rebuilding
If permissions dialog is missed during installation:
```bash
# Direct APK installation
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or simply
npx expo run:android
```
Note: No need to clean and rebuild if only installation was interrupted

### Maintaining Device Connection
1. Check device status:
```bash
adb devices
```

2. If device shows as offline:
```bash
adb kill-server
adb start-server
```

3. Keep device connected:
```bash
adb shell settings put global stay_on_while_plugged_in 3
adb shell svc power stayon true usb
```

## Project Structure

```
MindMate/
├── app/                  # Main application code
│   ├── (auth)/          # Authentication screens
│   ├── (tabs)/          # Main tab screens
│   └── profile/         # Profile related screens
├── components/          # Reusable components
├── services/           # API and service integrations
├── utils/              # Utility functions
└── android/           # Native Android files
```

## Key Features
- Authentication (Login/Signup)
- Health Connect Integration
- Step Tracking
- Community Features
- Messaging System
- Profile Management

## Troubleshooting

### Build Issues
1. Clean the project
2. Check Android SDK version
3. Verify JDK version
4. Check device compatibility

### Permission Issues
1. Verify manifest permissions
2. Check runtime permissions
3. Ensure Health Connect is properly configured

### Device Connection Issues
- Use reliable USB data cable (not charging-only cable)
- Set USB mode to File Transfer/MTP
- Enable "Stay awake" in Developer Options
- Disable battery optimization for development tools
- Try different USB ports
- Clean device's USB port

### Health Connect Issues
- Ensure app is installed on device
- Check initialization before requesting permissions
- Verify device compatibility (Android 8.0+)
- Monitor logcat for detailed error messages

## Useful Commands

```bash
# Start development server
npm start

# Run on Android
npm run android

# Clean Android build
cd android && gradlew clean && cd..

# Check connected devices
adb devices

# Reset adb server
adb kill-server
adb start-server

# Keep device awake
adb shell settings put global stay_on_while_plugged_in 3

# Direct APK installation
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Important Notes
- Clean build only needed after code changes
- Keep device and computer on same WiFi for faster development
- Watch Metro bundler console for errors
- Keep Health Connect app updated on test device
- Regular testing on physical device recommended
- Use proper data cable and correct USB settings
- Monitor device connection status during development