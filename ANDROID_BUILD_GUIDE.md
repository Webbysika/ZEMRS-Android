# ZEMRS Android application

The Android package identifier is `zm.org.zemrs.monitor` and the application name is **ZEMRS**.

## Build with GitHub Actions

1. Upload this lightweight project to a GitHub repository. It contains fewer than 100 files.
2. Open **Actions** and select **Build ZEMRS Android APK**.
3. Select **Run workflow**.
4. When the workflow succeeds, download the **ZEMRS-Android-APK** artifact.
5. Extract the artifact and install `app-debug.apk` on the Android device.

## Build with Android Studio

1. Install Android Studio.
2. Open the `android` directory.
3. Allow Gradle synchronization to finish.
4. Select **Build > Build APK(s)**.
5. Install the generated APK from `android/app/build/outputs/apk/debug/app-debug.apk`.

The application bundles polling stations and administrative boundaries for offline use. Internet access is required only for authentication, synchronization, real-time dashboard updates, and uncached OpenStreetMap tiles.
