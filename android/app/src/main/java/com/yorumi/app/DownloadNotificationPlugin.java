package com.yorumi.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
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
        DownloadNotificationService.ensureChannels(getContext());
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

    private boolean canPostNotifications() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !canPostNotifications() && getActivity() != null) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4202);
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        requestNotificationPermissionIfNeeded();
        postProgress(call, DownloadNotificationService.ACTION_SHOW);
    }

    @PluginMethod
    public void update(PluginCall call) {
        postProgress(call, DownloadNotificationService.ACTION_UPDATE);
    }

    @PluginMethod
    public void complete(PluginCall call) {
        boolean keepProgress = Boolean.TRUE.equals(call.getBoolean("keepProgress", false));
        if (!keepProgress) {
            stopForegroundProgressService();
        }
        requestNotificationPermissionIfNeeded();
        if (canPostNotifications()) {
            DownloadNotificationService.ensureChannels(getContext());
            String mediaType = call.getString("mediaType", "anime");
            String entryId = call.getString("animeId", "");
            String entryTitle = call.getString("animeTitle", "Yorumi");
            String itemTitle = call.getString("episodeTitle", "Download");
            int notifId = DownloadNotificationService.COMPLETE_NOTIFICATION_ID
                + Math.abs((mediaType + ":" + entryId + ":" + itemTitle).hashCode() % 500);
            try {
                NotificationManagerCompat.from(getContext()).notify(
                    notifId,
                    DownloadNotificationService.buildCompleteNotification(getContext(), mediaType, entryId, entryTitle, itemTitle)
                );
            } catch (SecurityException ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void fail(PluginCall call) {
        stopForegroundProgressService();
        if (canPostNotifications()) {
            DownloadNotificationService.ensureChannels(getContext());
            String mediaType = call.getString("mediaType", "anime");
            String entryId = call.getString("animeId", "");
            String entryTitle = call.getString("animeTitle", "Yorumi");
            String itemTitle = call.getString("episodeTitle", "Download");
            String message = call.getString("message", "Download failed");
            int notifId = DownloadNotificationService.ERROR_NOTIFICATION_ID
                + Math.abs((mediaType + ":" + entryId + ":" + itemTitle).hashCode() % 500);
            try {
                NotificationManagerCompat.from(getContext()).notify(
                    notifId,
                    DownloadNotificationService.buildErrorNotification(getContext(), mediaType, entryId, entryTitle, itemTitle, message)
                );
            } catch (SecurityException ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void notifyUpdate(PluginCall call) {
        requestNotificationPermissionIfNeeded();
        if (canPostNotifications()) {
            DownloadNotificationService.ensureChannels(getContext());
            String mediaType = call.getString("mediaType", "anime");
            String entryId = call.getString("entryId", "");
            String title = call.getString("title", "Yorumi");
            int episodeNumber = call.getInt("episodeNumber", 1);
            int watchedEpisode = call.getInt("watchedEpisode", 0);
            int unreadCount = call.getInt("unreadCount", 1);
            String summaryText = call.getString("summaryText", "");
            String body = call.getString("body", "");
            int notifId = DownloadNotificationService.UPDATE_NOTIFICATION_ID
                + Math.abs((mediaType + ":" + entryId + ":" + episodeNumber).hashCode() % 500);
            try {
                NotificationManagerCompat nm = NotificationManagerCompat.from(getContext());
                nm.notify(
                    notifId,
                    DownloadNotificationService.buildUpdateNotification(
                        getContext(), mediaType, entryId, title, episodeNumber, watchedEpisode, body
                    )
                );
                if (unreadCount > 1) {
                    nm.notify(
                        DownloadNotificationService.UPDATE_SUMMARY_NOTIFICATION_ID,
                        DownloadNotificationService.buildUpdateSummaryNotification(
                            getContext(), unreadCount, summaryText
                        )
                    );
                }
            } catch (SecurityException ignored) {}
        }
        call.resolve();
    }

    private void stopForegroundProgressService() {
        try {
            getContext().stopService(new Intent(getContext(), DownloadNotificationService.class));
        } catch (Exception ignored) {}
        try {
            NotificationManagerCompat.from(getContext()).cancel(DownloadNotificationService.PROGRESS_NOTIFICATION_ID);
        } catch (Exception ignored) {}
    }

    private void postProgress(PluginCall call, String action) {
        String mediaType = call.getString("mediaType", "anime");
        String entryId = call.getString("animeId", "");
        int episodeNumber = call.getInt("episodeNumber", 0);
        String entryTitle = call.getString("animeTitle", "Yorumi");
        String itemTitle = call.getString("episodeTitle", "Episode");
        int progress = call.getInt("progress", 0);

        if (!canPostNotifications()) {
            call.resolve();
            return;
        }

        DownloadNotificationService.ensureChannels(getContext());

        // Always post immediately via NotificationManagerCompat so fast manga/LN downloads show instantly
        try {
            NotificationManagerCompat.from(getContext()).notify(
                DownloadNotificationService.PROGRESS_NOTIFICATION_ID,
                DownloadNotificationService.buildProgressNotification(
                    getContext(), mediaType, entryId, episodeNumber, entryTitle, itemTitle, progress, false
                )
            );
        } catch (SecurityException ignored) {}

        Intent intent = new Intent(getContext(), DownloadNotificationService.class);
        intent.setAction(action);
        intent.putExtra("mediaType", mediaType);
        intent.putExtra("animeId", entryId);
        intent.putExtra("episodeNumber", episodeNumber);
        intent.putExtra("animeTitle", entryTitle);
        intent.putExtra("episodeTitle", itemTitle);
        intent.putExtra("progress", progress);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(getContext(), intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Exception ignored) {
            // Notification already posted via NotificationManagerCompat above.
        }
        call.resolve();
    }
}
