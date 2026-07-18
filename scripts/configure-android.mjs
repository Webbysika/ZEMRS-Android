import { readFile, writeFile } from 'node:fs/promises';

const manifestPath='android/app/src/main/AndroidManifest.xml';
let manifest=await readFile(manifestPath,'utf8');
manifest=manifest
  .replace('android:launchMode="singleTask"','android:launchMode="singleTask"\n            android:immersive="true"')
  .replace('<uses-permission android:name="android.permission.INTERNET" />','<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />');
await writeFile(manifestPath,manifest);

const activityPath='android/app/src/main/java/zm/org/zemrs/monitor/MainActivity.java';
await writeFile(activityPath,`package zm.org.zemrs.monitor;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterFullScreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterFullScreen();
    }

    private void enterFullScreen() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }
}
`);

const stylesPath='android/app/src/main/res/values/styles.xml';
let styles=await readFile(stylesPath,'utf8');
styles=styles.replace('<item name="android:background">@null</item>','<item name="android:background">@null</item>\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:navigationBarColor">#0b5d3b</item>');
await writeFile(stylesPath,styles);
