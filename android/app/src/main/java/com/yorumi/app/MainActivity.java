package com.yorumi.app;

import android.content.Context;
import android.graphics.Color;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.app.PictureInPictureParams;
import android.util.Rational;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean playerPictureInPictureEnabled = false;
    private ConnectivityManager.NetworkCallback networkCallback;

    public void setPlayerPictureInPictureEnabled(boolean enabled) {
        playerPictureInPictureEnabled = enabled;
    }

    @Override
    public void onUserLeaveHint() {
        if (playerPictureInPictureEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isInPictureInPictureMode()) {
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9))
                .build();
            enterPictureInPictureMode(params);
        }
        super.onUserLeaveHint();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
        registerPlugin(ImmersiveModePlugin.class);
        registerPlugin(LocalMediaProxyPlugin.class);
        registerPlugin(DownloadNotificationPlugin.class);
        registerPlugin(NativeDownloadStoragePlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        openDownloadEntry(getIntent());

        applyEdgeToEdge();
        getWindow().getDecorView().post(this::applyEdgeToEdge);
        registerNetworkMonitor();
    }

    @Override
    public void onDestroy() {
        unregisterNetworkMonitor();
        super.onDestroy();
    }

    private boolean isNetworkConnected() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network active = cm.getActiveNetwork();
                if (active == null) return false;
                NetworkCapabilities caps = cm.getNetworkCapabilities(active);
                return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            }
            android.net.NetworkInfo info = cm.getActiveNetworkInfo();
            return info != null && info.isConnected();
        } catch (Exception ignored) {
            return true;
        }
    }

    private void dispatchNetworkStateToWebView(boolean online) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String js = "window.__YORUMI_ONLINE__=" + (online ? "true" : "false") + ";" +
            "window.dispatchEvent(new CustomEvent('yorumi-network-change',{detail:{online:" + (online ? "true" : "false") + "}}));";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }

    private void registerNetworkMonitor() {
        dispatchNetworkStateToWebView(isNetworkConnected());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    dispatchNetworkStateToWebView(isNetworkConnected());
                }

                @Override
                public void onLost(Network network) {
                    // Delay slightly so Android updates activeNetwork before we query it
                    getWindow().getDecorView().postDelayed(() -> dispatchNetworkStateToWebView(isNetworkConnected()), 150);
                }

                @Override
                public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                    dispatchNetworkStateToWebView(isNetworkConnected());
                }
            };
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception ignored) {}
    }

    private void unregisterNetworkMonitor() {
        if (networkCallback == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) cm.unregisterNetworkCallback(networkCallback);
        } catch (Exception ignored) {}
        networkCallback = null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openDownloadEntry(intent);
    }

    private void openDownloadEntry(Intent intent) {
        if (intent == null || getBridge() == null || getBridge().getWebView() == null) return;
        String entryId = intent.getStringExtra("downloadEntryId");
        if (entryId == null || entryId.trim().isEmpty()) {
            entryId = intent.getStringExtra("downloadAnimeId");
        }
        if (entryId == null || entryId.trim().isEmpty()) return;
        String mediaType = intent.getStringExtra("downloadMediaType");
        String routePrefix = "manga".equals(mediaType)
            ? "/manga/details/"
            : "ln".equals(mediaType)
            ? "/ln/details/"
            : "/anime/details/";
        String quotedId = org.json.JSONObject.quote(entryId.trim());
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
            "window.history.pushState({},'', '" + routePrefix + "'+encodeURIComponent(" + quotedId + "));" +
                "window.dispatchEvent(new PopStateEvent('popstate'));",
            null
        ));
        intent.removeExtra("downloadEntryId");
        intent.removeExtra("downloadAnimeId");
        intent.removeExtra("downloadMediaType");
    }

    @Override
    public void onResume() {
        super.onResume();
        applyEdgeToEdge();
        dispatchNetworkStateToWebView(isNetworkConnected());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyEdgeToEdge();
        }
    }

    private void applyEdgeToEdge() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = window.getAttributes();
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(params);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }

        View decorView = window.getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int flags = decorView.getSystemUiVisibility();
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            decorView.setSystemUiVisibility(flags);
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }
}
