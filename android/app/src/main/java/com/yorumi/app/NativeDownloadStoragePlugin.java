package com.yorumi.app;

import android.os.Environment;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletionService;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

@CapacitorPlugin(name = "NativeDownloadStorage")
public class NativeDownloadStoragePlugin extends Plugin {
    private static final int BUFFER_SIZE = 128 * 1024;
    private static final int HLS_CONCURRENCY = 6;
    private static final int SEGMENT_RETRIES = 3;
    private final Map<String, Boolean> pausedOperations = new ConcurrentHashMap<>();
    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build();

    @PluginMethod
    public void download(PluginCall call) {
        String operationId = call.getString("operationId", "");
        String url = call.getString("url", "");
        String relativePath = call.getString("relativePath", "");
        String referer = call.getString("referer", "");
        boolean hls = call.getBoolean("hls", false);
        int maxHeight = call.getInt("maxHeight", 720);
        if (operationId.isEmpty() || url.isEmpty() || relativePath.isEmpty()) {
            call.reject("Missing download parameters");
            return;
        }

        pausedOperations.put(operationId, false);
        new Thread(() -> {
            File temp = null;
            try {
                File target = resolveTarget(relativePath);
                temp = new File(target.getAbsolutePath() + ".tmp");
                File parent = target.getParentFile();
                if (parent == null || (!parent.exists() && !parent.mkdirs())) {
                    throw new IOException("Unable to create download directory");
                }
                if (temp.exists() && !temp.delete()) throw new IOException("Unable to reset partial download");

                DownloadStats stats = hls
                    ? downloadHls(operationId, url, referer, temp, maxHeight)
                    : downloadFile(operationId, url, referer, temp);
                if (stats.bytes <= 0 || !temp.exists()) throw new IOException("Downloaded file is empty");
                if (target.exists() && !target.delete()) throw new IOException("Unable to replace existing download");
                if (!temp.renameTo(target)) {
                    Files.move(temp.toPath(), target.toPath());
                }

                JSObject result = new JSObject();
                result.put("filePath", target.getAbsolutePath());
                result.put("fileUrl", LocalMediaProxyPlugin.getFileUrl(target));
                result.put("fileSize", target.length());
                result.put("duration", stats.duration);
                call.resolve(result);
            } catch (Exception error) {
                if (temp != null && temp.exists()) temp.delete();
                call.reject(error.getMessage() != null ? error.getMessage() : "Native download failed", error);
            } finally {
                pausedOperations.remove(operationId);
            }
        }, "yorumi-native-download").start();
    }

    @PluginMethod
    public void writeText(PluginCall call) {
        String relativePath = call.getString("relativePath", "");
        String content = call.getString("content", "");
        if (relativePath.isEmpty()) {
            call.reject("Missing file path");
            return;
        }
        new Thread(() -> {
            try {
                File target = resolveTarget(relativePath);
                File parent = target.getParentFile();
                if (parent == null || (!parent.exists() && !parent.mkdirs())) throw new IOException("Unable to create directory");
                Files.write(target.toPath(), content.getBytes(StandardCharsets.UTF_8));
                JSObject result = new JSObject();
                result.put("filePath", target.getAbsolutePath());
                result.put("fileUrl", LocalMediaProxyPlugin.getFileUrl(target));
                result.put("fileSize", target.length());
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
            }
        }, "yorumi-native-write").start();
    }

    @PluginMethod
    public void delete(PluginCall call) {
        String rawPath = call.getString("filePath", "");
        try {
            File target = new File(rawPath).getCanonicalFile();
            File root = getDownloadRoot().getCanonicalFile();
            if (!target.getPath().startsWith(root.getPath() + File.separator)) throw new IOException("Invalid download path");
            deleteRecursively(target);
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void setPaused(PluginCall call) {
        String operationId = call.getString("operationId", "");
        if (pausedOperations.containsKey(operationId)) {
            pausedOperations.put(operationId, call.getBoolean("paused", false));
        }
        call.resolve();
    }

    private DownloadStats downloadFile(String operationId, String url, String referer, File target) throws Exception {
        RequestTarget source = resolveRequestTarget(url, referer);
        Request request = request(source.url, source.referer).build();
        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) throw new IOException("Download failed (HTTP " + response.code() + ")");
            long total = response.body().contentLength();
            try (BufferedInputStream input = new BufferedInputStream(response.body().byteStream());
                 BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(target))) {
                return copy(operationId, input, output, total, 0, 100);
            }
        }
    }

    private DownloadStats downloadHls(String operationId, String playlistUrl, String referer, File target, int maxHeight) throws Exception {
        Playlist playlist = resolveMediaPlaylist(playlistUrl, referer, 0, maxHeight);
        long written = 0;
        HlsProgressTracker progressTracker = new HlsProgressTracker(operationId, playlist.segments.size());
        File segmentDirectory = new File(target.getAbsolutePath() + ".segments");
        deleteRecursively(segmentDirectory);
        if (!segmentDirectory.mkdirs()) throw new IOException("Unable to create HLS staging directory");
        ExecutorService executor = Executors.newFixedThreadPool(HLS_CONCURRENCY);
        try {
            CompletionService<Integer> downloads = new ExecutorCompletionService<>(executor);
            for (int segmentIndex = 0; segmentIndex < playlist.segments.size(); segmentIndex++) {
                final int index = segmentIndex;
                final File segmentFile = new File(segmentDirectory, String.format("%06d.part", index));
                downloads.submit(() -> {
                    downloadHlsSegment(
                        operationId,
                        playlist.segments.get(index),
                        playlist.referer,
                        index,
                        playlist.segments.size(),
                        progressTracker,
                        segmentFile
                    );
                    return index;
                });
            }
            for (int index = 0; index < playlist.segments.size(); index++) {
                Future<Integer> future = downloads.take();
                future.get();
            }

            try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(target))) {
                byte[] buffer = new byte[BUFFER_SIZE];
                for (int index = 0; index < playlist.segments.size(); index++) {
                    waitIfPaused(operationId);
                    File segmentFile = new File(segmentDirectory, String.format("%06d.part", index));
                    try (BufferedInputStream input = new BufferedInputStream(new FileInputStream(segmentFile))) {
                        int read;
                        while ((read = input.read(buffer)) != -1) {
                            output.write(buffer, 0, read);
                            written += read;
                        }
                    }
                }
            }
        } finally {
            executor.shutdownNow();
            deleteRecursively(segmentDirectory);
        }
        return new DownloadStats(written, playlist.duration);
    }

    private void downloadHlsSegment(
        String operationId,
        String segmentUrl,
        String referer,
        int segmentIndex,
        int segmentCount,
        HlsProgressTracker progressTracker,
        File segmentFile
    ) throws Exception {
        Exception lastError = null;
        for (int attempt = 1; attempt <= SEGMENT_RETRIES; attempt++) {
            waitIfPaused(operationId);
            RequestTarget source = resolveRequestTarget(segmentUrl, referer);
            try (Response response = client.newCall(request(source.url, source.referer).build()).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("HTTP " + response.code());
                }
                try (BufferedInputStream input = new BufferedInputStream(response.body().byteStream());
                     BufferedOutputStream segment = new BufferedOutputStream(new FileOutputStream(segmentFile))) {
                    byte[] buffer = new byte[BUFFER_SIZE];
                    long segmentBytes = 0;
                    long segmentTotal = response.body().contentLength();
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        waitIfPaused(operationId);
                        segment.write(buffer, 0, read);
                        segmentBytes += read;
                        progressTracker.update(segmentIndex, segmentBytes, segmentTotal, false);
                    }
                    progressTracker.update(segmentIndex, segmentBytes, segmentTotal, true);
                    return;
                }
            } catch (Exception error) {
                lastError = error;
                if (attempt < SEGMENT_RETRIES) Thread.sleep(250L * attempt);
            }
        }
        throw new IOException(
            "Failed HLS segment " + (segmentIndex + 1) + "/" + segmentCount,
            lastError
        );
    }

    private Playlist resolveMediaPlaylist(String url, String referer, int depth, int maxHeight) throws Exception {
        if (depth > 5) throw new IOException("Too many HLS playlist redirects");
        RequestTarget source = resolveRequestTarget(url, referer);
        String text;
        try (Response response = client.newCall(request(source.url, source.referer).build()).execute()) {
            if (!response.isSuccessful() || response.body() == null) throw new IOException("Failed HLS playlist (HTTP " + response.code() + ")");
            text = response.body().string();
        }
        String[] lines = text.split("\\r?\\n");
        String bestVariant = null;
        long bestBandwidth = -1;
        String smallestVariant = null;
        long smallestBandwidth = Long.MAX_VALUE;
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.startsWith("#EXT-X-STREAM-INF:")) {
                long bandwidth = parseBandwidth(line);
                int height = parseResolutionHeight(line);
                for (int j = i + 1; j < lines.length; j++) {
                    String candidate = lines[j].trim();
                    if (!candidate.isEmpty() && !candidate.startsWith("#")) {
                        String candidateUrl = absoluteUrl(source.url, candidate);
                        if (bandwidth < smallestBandwidth) {
                            smallestBandwidth = bandwidth;
                            smallestVariant = candidateUrl;
                        }
                        boolean eligible = maxHeight <= 0 || height <= 0 || height <= maxHeight;
                        if (eligible && bandwidth > bestBandwidth) {
                            bestBandwidth = bandwidth;
                            bestVariant = candidateUrl;
                        }
                        break;
                    }
                }
            }
        }
        if (bestVariant == null) bestVariant = smallestVariant;
        if (bestVariant != null) return resolveMediaPlaylist(bestVariant, source.referer, depth + 1, maxHeight);

        List<String> segments = new ArrayList<>();
        double duration = 0;
        for (String raw : lines) {
            String line = raw.trim();
            if (line.startsWith("#EXTINF:")) {
                try { duration += Double.parseDouble(line.substring(8).split(",")[0]); } catch (Exception ignored) {}
            } else if (!line.isEmpty() && !line.startsWith("#")) {
                segments.add(absoluteUrl(source.url, line));
            }
        }
        if (segments.isEmpty()) throw new IOException("No HLS video segments found");
        return new Playlist(segments, duration, source.referer);
    }

    private DownloadStats copy(String operationId, BufferedInputStream input, BufferedOutputStream output, long total, int start, int span) throws Exception {
        byte[] buffer = new byte[BUFFER_SIZE];
        long written = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            waitIfPaused(operationId);
            output.write(buffer, 0, read);
            written += read;
            int progress = total > 0 ? start + (int) Math.min(span - 1, (written * span) / total) : start;
            emitProgress(operationId, progress, written, total > 0 ? total : written);
        }
        return new DownloadStats(written, 0);
    }

    private void waitIfPaused(String operationId) throws InterruptedException {
        while (Boolean.TRUE.equals(pausedOperations.get(operationId))) Thread.sleep(150);
    }

    private void emitProgress(String operationId, int progress, long received, long total) {
        JSObject event = new JSObject();
        event.put("operationId", operationId);
        event.put("progress", progress);
        event.put("receivedBytes", received);
        event.put("totalBytes", total);
        notifyListeners("progress", event);
    }

    private Request.Builder request(String url, String referer) {
        Request.Builder builder = new Request.Builder().url(url)
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36")
            .header("Accept", "*/*");
        if (referer != null && !referer.isEmpty()) {
            builder.header("Referer", referer);
            try {
                URL refUrl = new URL(referer);
                builder.header("Origin", refUrl.getProtocol() + "://" + refUrl.getAuthority());
            } catch (Exception ignored) {}
        }
        return builder;
    }

    private RequestTarget resolveRequestTarget(String url, String fallbackReferer) {
        try {
            Uri parsed = Uri.parse(url);
            boolean localProxy = "127.0.0.1".equals(parsed.getHost()) && "/proxy".equals(parsed.getPath());
            if (localProxy) {
                String upstreamUrl = parsed.getQueryParameter("url");
                String embeddedReferer = parsed.getQueryParameter("referer");
                if (upstreamUrl != null && !upstreamUrl.isEmpty()) {
                    return new RequestTarget(
                        upstreamUrl,
                        embeddedReferer != null && !embeddedReferer.isEmpty() ? embeddedReferer : fallbackReferer
                    );
                }
            }
        } catch (Exception ignored) {}
        return new RequestTarget(url, fallbackReferer);
    }

    private File getDownloadRoot() {
        File external = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File base = external != null ? external : getContext().getFilesDir();
        return new File(base, "Yorumi");
    }

    private File resolveTarget(String relativePath) throws IOException {
        File root = getDownloadRoot().getCanonicalFile();
        File target = new File(root, sanitizeRelativePath(relativePath)).getCanonicalFile();
        if (!target.getPath().startsWith(root.getPath() + File.separator)) throw new IOException("Invalid download path");
        return target;
    }

    private static String sanitizeRelativePath(String path) {
        String[] pieces = path.replace('\\', '/').split("/");
        StringBuilder safe = new StringBuilder();
        for (String piece : pieces) {
            String cleaned = piece.replaceAll("[\\p{Cntrl}<>:\"|?*]", "_").replace("..", "_").trim();
            if (cleaned.isEmpty()) continue;
            if (safe.length() > 0) safe.append(File.separator);
            safe.append(cleaned.length() > 100 ? cleaned.substring(0, 100) : cleaned);
        }
        return safe.toString();
    }

    private static String absoluteUrl(String base, String value) throws Exception { return new URL(new URL(base), value).toString(); }
    private static long parseBandwidth(String line) {
        try {
            String value = line.replaceAll(".*BANDWIDTH=(\\d+).*", "$1");
            return Long.parseLong(value);
        } catch (Exception ignored) { return 0; }
    }
    private static int parseResolutionHeight(String line) {
        try {
            String value = line.replaceAll(".*RESOLUTION=\\d+x(\\d+).*", "$1");
            return Integer.parseInt(value);
        } catch (Exception ignored) { return 0; }
    }
    private static void deleteRecursively(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursively(child);
        }
        file.delete();
    }

    private static final class DownloadStats {
        final long bytes; final double duration;
        DownloadStats(long bytes, double duration) { this.bytes = bytes; this.duration = duration; }
    }
    private static final class Playlist {
        final List<String> segments; final double duration; final String referer;
        Playlist(List<String> segments, double duration, String referer) {
            this.segments = segments; this.duration = duration; this.referer = referer;
        }
    }
    private static final class RequestTarget {
        final String url; final String referer;
        RequestTarget(String url, String referer) { this.url = url; this.referer = referer; }
    }
    private final class HlsProgressTracker {
        private final String operationId;
        private final long[] received;
        private final long[] totals;
        private final boolean[] complete;
        private int lastProgress;

        HlsProgressTracker(String operationId, int segmentCount) {
            this.operationId = operationId;
            this.received = new long[segmentCount];
            this.totals = new long[segmentCount];
            this.complete = new boolean[segmentCount];
        }

        synchronized void update(int index, long bytes, long total, boolean finished) {
            received[index] = bytes;
            totals[index] = total;
            complete[index] = finished;

            double segmentUnits = 0;
            long receivedBytes = 0;
            for (int i = 0; i < received.length; i++) {
                receivedBytes += received[i];
                if (complete[i]) {
                    segmentUnits += 1;
                } else if (totals[i] > 0) {
                    segmentUnits += Math.min(1d, (double) received[i] / totals[i]);
                }
            }
            int progress = Math.min(99, (int) Math.floor((segmentUnits * 100d) / received.length));
            if (progress <= lastProgress) return;
            lastProgress = progress;
            long estimatedTotal = progress > 0 ? Math.max(receivedBytes, (receivedBytes * 100L) / progress) : receivedBytes;
            emitProgress(operationId, progress, receivedBytes, estimatedTotal);
        }
    }
}
