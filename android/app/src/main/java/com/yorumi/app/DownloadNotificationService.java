package com.yorumi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class DownloadNotificationService extends Service {
    public static final String CHANNEL_ID = "yorumi_downloads";
    public static final String CONTROL_BROADCAST = "com.yorumi.app.DOWNLOAD_CONTROL";
    public static final String ACTION_SHOW = "com.yorumi.app.download.SHOW";
    public static final String ACTION_UPDATE = "com.yorumi.app.download.UPDATE";
    public static final String ACTION_TOGGLE_PAUSE = "com.yorumi.app.download.TOGGLE_PAUSE";
    public static final String ACTION_COMPLETE = "com.yorumi.app.download.COMPLETE";
    public static final String ACTION_FAIL = "com.yorumi.app.download.FAIL";
    private static final int NOTIFICATION_ID = 4202;

    private String animeId = "";
    private int episodeNumber = 0;
    private String animeTitle = "Yorumi";
    private String episodeTitle = "Episode";
    private int progress = 0;
    private boolean paused = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        readDownload(intent);
        String action = intent.getAction();

        if (ACTION_TOGGLE_PAUSE.equals(action)) {
            paused = !paused;
            Intent control = new Intent(CONTROL_BROADCAST);
            control.setPackage(getPackageName());
            control.putExtra("animeId", animeId);
            control.putExtra("episodeNumber", episodeNumber);
            control.putExtra("paused", paused);
            sendBroadcast(control);
            startForeground(NOTIFICATION_ID, buildNotification(false, null));
            return START_NOT_STICKY;
        }

        if (ACTION_COMPLETE.equals(action)) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification(true, null));
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_FAIL.equals(action)) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            getSystemService(NotificationManager.class).notify(
                NOTIFICATION_ID,
                buildNotification(false, intent.getStringExtra("message"))
            );
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification(false, null));
        return START_NOT_STICKY;
    }

    private void readDownload(Intent intent) {
        animeId = intent.getStringExtra("animeId") != null ? intent.getStringExtra("animeId") : animeId;
        episodeNumber = intent.getIntExtra("episodeNumber", episodeNumber);
        animeTitle = intent.getStringExtra("animeTitle") != null ? intent.getStringExtra("animeTitle") : animeTitle;
        episodeTitle = intent.getStringExtra("episodeTitle") != null ? intent.getStringExtra("episodeTitle") : episodeTitle;
        progress = Math.max(0, Math.min(100, intent.getIntExtra("progress", progress)));
    }

    private Notification buildNotification(boolean complete, @Nullable String error) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra("downloadAnimeId", animeId);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            this, 51, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(complete ? R.drawable.ic_stat_download_done : R.drawable.ic_stat_download)
            .setContentTitle(animeTitle)
            .setContentIntent(openPendingIntent)
            .setOnlyAlertOnce(true)
            .setOngoing(!complete && error == null)
            .setAutoCancel(complete || error != null)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS);

        if (complete) {
            builder.setContentText(episodeTitle + " downloaded").setProgress(0, 0, false);
        } else if (error != null) {
            builder.setContentText("Download failed: " + error).setProgress(0, 0, false);
        } else {
            builder.setContentText(episodeTitle)
                .setSubText(paused ? "Paused" : "Downloading • " + progress + "%")
                .setProgress(100, progress, progress == 0);

            Intent pauseIntent = new Intent(this, DownloadNotificationService.class);
            pauseIntent.setAction(ACTION_TOGGLE_PAUSE);
            pauseIntent.putExtra("animeId", animeId);
            pauseIntent.putExtra("episodeNumber", episodeNumber);
            PendingIntent pausePendingIntent = PendingIntent.getService(
                this, 52, pauseIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.addAction(0, paused ? "Resume" : "Pause", pausePendingIntent);
        }
        builder.addAction(0, "Show entry", openPendingIntent);
        return builder.build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Anime download progress");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
