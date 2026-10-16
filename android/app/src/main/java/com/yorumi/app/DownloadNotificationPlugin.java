package com.yorumi.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DownloadNotification")
public class DownloadNotificationPlugin extends Plugin {
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            JSObject data = new JSObject();
            data.put("animeId", intent.getStringExtra("animeId"));
            data.put("episodeNumber", intent.getIntExtra("episodeNumber", 0));
            data.put("paused", intent.getBooleanExtra("paused", false));
            notifyListeners("downloadControl", data, true);
        }
    };

    @Override
    public void load() {
        ContextCompat.registerReceiver(
            getContext(),
            receiver,
            new IntentFilter(DownloadNotificationService.CONTROL_BROADCAST),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(receiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver was already removed with the activity.
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4202);
        }
        startService(call, DownloadNotificationService.ACTION_SHOW);
    }

    @PluginMethod
    public void update(PluginCall call) {
        startService(call, DownloadNotificationService.ACTION_UPDATE);
    }

    @PluginMethod
    public void complete(PluginCall call) {
        startService(call, DownloadNotificationService.ACTION_COMPLETE);
    }

    @PluginMethod
    public void fail(PluginCall call) {
        startService(call, DownloadNotificationService.ACTION_FAIL);
    }

    private void startService(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), DownloadNotificationService.class);
        intent.setAction(action);
        intent.putExtra("animeId", call.getString("animeId", ""));
        intent.putExtra("episodeNumber", call.getInt("episodeNumber", 0));
        intent.putExtra("animeTitle", call.getString("animeTitle", "Yorumi"));
        intent.putExtra("episodeTitle", call.getString("episodeTitle", "Episode"));
        intent.putExtra("progress", call.getInt("progress", 0));
        intent.putExtra("message", call.getString("message", "Download failed"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && (DownloadNotificationService.ACTION_SHOW.equals(action) || DownloadNotificationService.ACTION_UPDATE.equals(action))) {
            ContextCompat.startForegroundService(getContext(), intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }
}
