package com.yorumi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

public class DownloadNotificationService extends Service {
    public static final String CHANNEL_PROGRESS_ID = "yorumi_downloads_progress";
    public static final String CHANNEL_COMPLETE_ID = "yorumi_downloads_complete";
    public static final String CHANNEL_UPDATES_ID = "yorumi_episode_updates";
    public static final String UPDATES_GROUP_KEY = "com.yorumi.app.EPISODE_UPDATES";
    public static final String CONTROL_BROADCAST = "com.yorumi.app.DOWNLOAD_CONTROL";
    public static final String ACTION_SHOW = "com.yorumi.app.download.SHOW";
    public static final String ACTION_UPDATE = "com.yorumi.app.download.UPDATE";
    public static final String ACTION_TOGGLE_PAUSE = "com.yorumi.app.download.TOGGLE_PAUSE";
    public static final String ACTION_STOP = "com.yorumi.app.download.STOP";

    public static final int PROGRESS_NOTIFICATION_ID = 4202;
    public static final int COMPLETE_NOTIFICATION_ID = 4203;
    public static final int ERROR_NOTIFICATION_ID = 4204;
    public static final int UPDATE_SUMMARY_NOTIFICATION_ID = 5200;
    public static final int UPDATE_NOTIFICATION_ID = 5201;

    private String mediaType = "anime";
    private String entryId = "";
    private int episodeNumber = 0;
    private String entryTitle = "Yorumi";
    private String itemTitle = "Episode";
    private int progress = 0;
    private boolean paused = false;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannels(this);
    }

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager == null) return;

            NotificationChannel progressChannel = new NotificationChannel(
                CHANNEL_PROGRESS_ID,
                "Download progress",
                NotificationManager.IMPORTANCE_LOW
            );
            progressChannel.setDescription("Ongoing anime, manga, and light novel downloads");
            progressChannel.setShowBadge(false);
            manager.createNotificationChannel(progressChannel);

            NotificationChannel completeChannel = new NotificationChannel(
                CHANNEL_COMPLETE_ID,
                "Download alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            completeChannel.setDescription("Completed and failed download notifications");
            manager.createNotificationChannel(completeChannel);

            NotificationChannel updatesChannel = new NotificationChannel(
                CHANNEL_UPDATES_ID,
                "Episode updates",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            updatesChannel.setDescription("New episode alerts for anime in your watchlist");
            manager.createNotificationChannel(updatesChannel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();

        if (ACTION_STOP.equals(action)) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        readDownload(intent);

        if (ACTION_TOGGLE_PAUSE.equals(action)) {
            paused = !paused;
            Intent control = new Intent(CONTROL_BROADCAST);
            control.setPackage(getPackageName());
            control.putExtra("animeId", entryId);
            control.putExtra("episodeNumber", episodeNumber);
            control.putExtra("paused", paused);
            sendBroadcast(control);
            promoteForeground(buildProgressNotification(this, mediaType, entryId, episodeNumber, entryTitle, itemTitle, progress, paused));
            return START_NOT_STICKY;
        }

        if (ACTION_SHOW.equals(action)) {
            paused = false;
        }

        promoteForeground(buildProgressNotification(this, mediaType, entryId, episodeNumber, entryTitle, itemTitle, progress, paused));
        return START_NOT_STICKY;
    }

    private void promoteForeground(Notification notification) {
        int fgType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            : 0;
        ServiceCompat.startForeground(this, PROGRESS_NOTIFICATION_ID, notification, fgType);
    }

    private void readDownload(Intent intent) {
        String nextMedia = intent.getStringExtra("mediaType");
        if (nextMedia != null && !nextMedia.isEmpty()) mediaType = nextMedia;
        String nextId = intent.getStringExtra("animeId");
        if (nextId != null) entryId = nextId;
        episodeNumber = intent.getIntExtra("episodeNumber", episodeNumber);
        String nextTitle = intent.getStringExtra("animeTitle");
        if (nextTitle != null && !nextTitle.isEmpty()) entryTitle = nextTitle;
        String nextItem = intent.getStringExtra("episodeTitle");
        if (nextItem != null && !nextItem.isEmpty()) itemTitle = nextItem;
        progress = Math.max(0, Math.min(100, intent.getIntExtra("progress", progress)));
    }

    private static PendingIntent createOpenEntryIntent(Context context, String mediaType, String entryId, int requestCode) {
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction("com.yorumi.app.OPEN_ENTRY_" + requestCode);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra("downloadMediaType", mediaType);
        openIntent.putExtra("downloadEntryId", entryId);
        openIntent.putExtra("downloadAnimeId", entryId);
        return PendingIntent.getActivity(
            context,
            requestCode,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static PendingIntent createOpenDownloadQueueIntent(Context context, String mediaType, int requestCode) {
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction("com.yorumi.app.OPEN_DOWNLOAD_QUEUE_" + requestCode);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        String safeTab = ("manga".equals(mediaType) || "ln".equals(mediaType)) ? mediaType : "anime";
        openIntent.putExtra("openRoute", "/menu/download-queue?tab=" + safeTab);
        openIntent.putExtra("downloadMediaType", safeTab);
        return PendingIntent.getActivity(
            context,
            requestCode,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    public static Notification buildProgressNotification(
        Context context,
        String mediaType,
        String entryId,
        int episodeNumber,
        String entryTitle,
        String itemTitle,
        int progress,
        boolean paused
    ) {
        ensureChannels(context);
        PendingIntent openPendingIntent = createOpenDownloadQueueIntent(context, mediaType, 51);
        String label = "manga".equals(mediaType) ? "Manga" : "ln".equals(mediaType) ? "Light Novel" : "Anime";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_PROGRESS_ID)
            .setSmallIcon(R.drawable.ic_stat_download)
            .setContentTitle(entryTitle)
            .setContentText(itemTitle)
            .setSubText(paused ? "Paused" : label + " • " + progress + "%")
            .setProgress(100, progress, progress <= 0)
            .setContentIntent(openPendingIntent)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS);

        if ("anime".equals(mediaType)) {
            Intent pauseIntent = new Intent(context, DownloadNotificationService.class);
            pauseIntent.setAction(ACTION_TOGGLE_PAUSE);
            pauseIntent.putExtra("mediaType", mediaType);
            pauseIntent.putExtra("animeId", entryId);
            pauseIntent.putExtra("episodeNumber", episodeNumber);
            PendingIntent pausePendingIntent = PendingIntent.getService(
                context,
                52,
                pauseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.addAction(0, paused ? "Resume" : "Pause", pausePendingIntent);
        }

        builder.addAction(0, "Show entry", openPendingIntent);
        return builder.build();
    }

    public static Notification buildCompleteNotification(
        Context context,
        String mediaType,
        String entryId,
        String entryTitle,
        String itemTitle
    ) {
        ensureChannels(context);
        PendingIntent openPendingIntent = createOpenDownloadQueueIntent(context, mediaType, 53);
        return new NotificationCompat.Builder(context, CHANNEL_COMPLETE_ID)
            .setSmallIcon(R.drawable.ic_stat_download_done)
            .setContentTitle(entryTitle)
            .setContentText(itemTitle + " downloaded")
            .setContentIntent(openPendingIntent)
            .setOngoing(false)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .addAction(0, "Show entry", openPendingIntent)
            .build();
    }

    public static Notification buildErrorNotification(
        Context context,
        String mediaType,
        String entryId,
        String entryTitle,
        String itemTitle,
        String errorMessage
    ) {
        ensureChannels(context);
        PendingIntent openPendingIntent = createOpenDownloadQueueIntent(context, mediaType, 54);
        String msg = (errorMessage != null && !errorMessage.isEmpty()) ? errorMessage : "Download failed";
        return new NotificationCompat.Builder(context, CHANNEL_COMPLETE_ID)
            .setSmallIcon(R.drawable.ic_stat_download)
            .setContentTitle(entryTitle + " — Download failed")
            .setContentText(itemTitle + ": " + msg)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(itemTitle + ": " + msg))
            .setContentIntent(openPendingIntent)
            .setOngoing(false)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_ERROR)
            .addAction(0, "Show entry", openPendingIntent)
            .build();
    }

    public static Notification buildUpdateNotification(
        Context context,
        String mediaType,
        String entryId,
        String entryTitle,
        int itemNumber,
        int watchedNumber,
        String customBody
    ) {
        ensureChannels(context);
        String safeType = ("manga".equals(mediaType) || "ln".equals(mediaType)) ? mediaType : "anime";
        int reqCode = 1000 + Math.abs((safeType + ":" + entryId + ":" + itemNumber).hashCode() % 1000);
        PendingIntent openPendingIntent = createOpenEntryIntent(context, safeType, entryId, reqCode);
        String body;
        if (customBody != null && !customBody.isEmpty()) {
            body = customBody;
        } else if ("manga".equals(safeType) || "ln".equals(safeType)) {
            body = watchedNumber > 0
                ? "Chapter " + itemNumber + " is out • Read Ch " + watchedNumber
                : "Chapter " + itemNumber + " is out";
        } else {
            body = watchedNumber > 0
                ? "Episode " + itemNumber + " is out • Watched Ep " + watchedNumber
                : "Episode " + itemNumber + " is out";
        }
        return new NotificationCompat.Builder(context, CHANNEL_UPDATES_ID)
            .setSmallIcon(R.drawable.ic_stat_download_done)
            .setContentTitle(entryTitle)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openPendingIntent)
            .setGroup(UPDATES_GROUP_KEY)
            .setOngoing(false)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .build();
    }

    public static Notification buildUpdateSummaryNotification(
        Context context,
        int count,
        String summaryText
    ) {
        ensureChannels(context);
        PendingIntent openPendingIntent = createOpenEntryIntent(context, "anime", "", 999);
        return new NotificationCompat.Builder(context, CHANNEL_UPDATES_ID)
            .setSmallIcon(R.drawable.ic_stat_download_done)
            .setContentTitle("Yorumi Updates")
            .setContentText(summaryText != null && !summaryText.isEmpty() ? summaryText : (count + " new updates available"))
            .setContentIntent(openPendingIntent)
            .setGroup(UPDATES_GROUP_KEY)
            .setGroupSummary(true)
            .setNumber(count)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
