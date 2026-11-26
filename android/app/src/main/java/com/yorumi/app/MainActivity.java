package com.yorumi.app;

import android.content.Context;
import android.graphics.Color;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.app.PictureInPictureParams;
import android.util.Rational;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final Pattern NONCE_PATTERN = Pattern.compile("nonce=\"([^\"]+)\"");
    private static final String YT_HIDE_HUD_CSS =
        ".ytp-bezel,.ytp-bezel-text-wrapper,.ytp-bezel-icon,.ytp-doubletap-ui-legacy," +
        ".ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,.ytp-gradient-bottom," +
        ".ytp-pause-overlay,.ytp-pause-overlay-container,.ytp-cued-thumbnail-overlay," +
        ".ytp-large-play-button,.ytp-watermark,.ytp-title,.ytp-show-cards-title," +
        ".player-controls-content,.player-controls-middle,.player-controls-top,.player-controls-bottom," +
        ".player-controls-background,.player-controls-background-container," +
        "ytm-custom-control,.ytm-autonav-overlay,.c3-overlay,.icon-button.player-control-play-pause-icon" +
        "{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;}";

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
            WebSettings settings = getBridge().getWebView().getSettings();
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setMediaPlaybackRequiresUserGesture(false);
            installYouTubeHudFilter();
        }

        openDownloadEntry(getIntent());

        applyEdgeToEdge();
        getWindow().getDecorView().post(this::applyEdgeToEdge);
        registerNetworkMonitor();
    }

    private void installYouTubeHudFilter() {
        if (getBridge() == null) return;
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                try {
                    Uri uri = request != null ? request.getUrl() : null;
                    if (
                        uri != null &&
                        "GET".equalsIgnoreCase(request.getMethod()) &&
                        "www.youtube-nocookie.com".equalsIgnoreCase(uri.getHost()) &&
                        uri.getPath() != null &&
                        uri.getPath().startsWith("/embed/")
                    ) {
                        WebResourceResponse clean = fetchCleanYouTubeEmbed(uri.toString(), request.getRequestHeaders());
                        if (clean != null) return clean;
                    }
                } catch (Exception ignored) {
                    // Fall back to default WebView loading on any network/parsing issue
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    private WebResourceResponse fetchCleanYouTubeEmbed(String embedUrl, Map<String, String> reqHeaders) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(embedUrl).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setInstanceFollowRedirects(true);
            if (reqHeaders != null) {
                for (String key : new String[]{"User-Agent", "Accept", "Accept-Language", "Referer"}) {
                    String val = reqHeaders.get(key);
                    if (val != null && !val.isEmpty()) {
                        conn.setRequestProperty(key, val);
                    }
                }
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return null;

            String contentType = conn.getContentType();
            if (contentType == null || !contentType.toLowerCase().contains("text/html")) return null;

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (InputStream is = conn.getInputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = is.read(buf)) != -1) {
                    baos.write(buf, 0, n);
                }
            }
            String html = new String(baos.toByteArray(), StandardCharsets.UTF_8);
            Matcher matcher = NONCE_PATTERN.matcher(html);
            String styleTag = matcher.find()
                ? "<style nonce=\"" + matcher.group(1) + "\">" + YT_HIDE_HUD_CSS + "</style>"
                : "<style>" + YT_HIDE_HUD_CSS + "</style>";

            int headClose = html.indexOf("</head>");
            String patched = headClose >= 0
                ? html.substring(0, headClose) + styleTag + html.substring(headClose)
                : styleTag + html;

            Map<String, String> respHeaders = new HashMap<>();
            respHeaders.put("Content-Type", "text/html; charset=utf-8");
            respHeaders.put("Cache-Control", "no-store");
            byte[] out = patched.getBytes(StandardCharsets.UTF_8);
            return new WebResourceResponse(
                "text/html",
                "utf-8",
                200,
                "OK",
                respHeaders,
                new ByteArrayInputStream(out)
            );
        } catch (Exception ignored) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
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

    private void dispatchNativeRoute(String targetRoute) {
        if (targetRoute == null || targetRoute.trim().isEmpty() || getBridge() == null || getBridge().getWebView() == null) return;
        String quotedRoute = org.json.JSONObject.quote(targetRoute.trim());
        String js = "window.__YORUMI_PENDING_ROUTE__=" + quotedRoute + ";" +
            "window.dispatchEvent(new CustomEvent('yorumi-native-navigate',{detail:{path:" + quotedRoute + "}}));";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }

    private void openDownloadEntry(Intent intent) {
        if (intent == null || getBridge() == null || getBridge().getWebView() == null) return;
        String openRoute = intent.getStringExtra("openRoute");
        if (openRoute != null && !openRoute.trim().isEmpty()) {
            dispatchNativeRoute(openRoute.trim());
            intent.removeExtra("openRoute");
            intent.removeExtra("downloadMediaType");
            return;
        }

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
        try {
            dispatchNativeRoute(routePrefix + java.net.URLEncoder.encode(entryId.trim(), "UTF-8").replace("+", "%20"));
        } catch (Exception ignored) {
            dispatchNativeRoute(routePrefix + entryId.trim());
        }
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
