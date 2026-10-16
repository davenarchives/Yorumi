package com.yorumi.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.Response.Status;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.ResponseBody;

@CapacitorPlugin(name = "LocalMediaProxy")
public class LocalMediaProxyPlugin extends Plugin {
    private static final int PORT = 18765;
    private LocalProxyServer server;

    @Override
    public void load() {
        super.load();
        try {
            File external = getContext().getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
            File base = external != null ? external : getContext().getFilesDir();
            server = new LocalProxyServer(new File(base, "Yorumi"));
            server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
        } catch (IOException error) {
            server = null;
        }
    }

    public static String getFileUrl(File file) {
        return "http://127.0.0.1:" + PORT + "/file?path=" + URLEncoder.encode(file.getAbsolutePath(), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void createUrl(PluginCall call) {
        String target = call.getString("url", "");
        String referer = call.getString("referer", "");
        if (target.isEmpty() || server == null) {
            call.reject("Local media proxy is unavailable");
            return;
        }
        JSObject result = new JSObject();
        result.put("url", server.proxyUrl(target, referer));
        call.resolve(result);
    }

    private static final class LocalProxyServer extends NanoHTTPD {
        private final File allowedFileRoot;
        private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build();

        LocalProxyServer(File allowedFileRoot) {
            super("127.0.0.1", PORT);
            this.allowedFileRoot = allowedFileRoot;
        }

        String proxyUrl(String target, String referer) {
            return "http://127.0.0.1:" + PORT + "/proxy?url=" + encode(target) + "&referer=" + encode(referer);
        }

        @Override
        public Response serve(IHTTPSession session) {
            try {
                if (Method.OPTIONS.equals(session.getMethod())) {
                    Response response = newFixedLengthResponse(Status.OK, "text/plain", null, 0);
                    addCors(response);
                    return response;
                }

                Map<String, String> params = session.getParms();
                if ("/file".equals(session.getUri())) {
                    return serveLocalFile(session, params.get("path"));
                }
                String target = params.get("url");
                if (target == null || target.isEmpty()) {
                    return newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "Missing url");
                }
                String referer = params.get("referer");
                if (referer == null) referer = "";

                Request.Builder request = new Request.Builder().url(target)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36")
                    .header("Accept", "*/*");
                if (!referer.isEmpty()) {
                    request.header("Referer", referer);
                    try {
                        URL refUrl = new URL(referer);
                        String origin = refUrl.getProtocol() + "://" + refUrl.getAuthority();
                        request.header("Origin", origin);
                    } catch (Exception ignored) {}
                }
                String range = session.getHeaders().get("range");
                if (range != null) request.header("Range", range);

                okhttp3.Response upstream = client.newCall(request.build()).execute();
                try {
                    ResponseBody body = upstream.body();
                    if (body == null) {
                        upstream.close();
                        Response response = newFixedLengthResponse(getStatus(502, "Bad Gateway"), "text/plain", "Empty upstream");
                        addCors(response);
                        return response;
                    }
                    String type = body.contentType() != null ? body.contentType().toString() : "application/octet-stream";
                    boolean playlist = upstream.isSuccessful() && (type.toLowerCase().contains("mpegurl") || target.toLowerCase().contains(".m3u8"));
                    Response.IStatus responseStatus = getStatus(upstream.code(), upstream.message());

                    if (playlist) {
                        String rewritten = rewritePlaylist(body.string(), target, referer);
                        upstream.close();
                        Response response = newFixedLengthResponse(responseStatus, "application/vnd.apple.mpegurl", rewritten);
                        addCors(response);
                        return response;
                    }

                    InputStream stream = new FilterInputStream(body.byteStream()) {
                        @Override
                        public void close() throws IOException {
                            try {
                                super.close();
                            } finally {
                                upstream.close();
                            }
                        }
                    };
                    long contentLength = body.contentLength();
                    Response response = contentLength >= 0
                        ? newFixedLengthResponse(responseStatus, type, stream, contentLength)
                        : newChunkedResponse(responseStatus, type, stream);
                    String contentRange = upstream.header("Content-Range");
                    if (contentRange != null) response.addHeader("Content-Range", contentRange);
                    response.addHeader("Accept-Ranges", "bytes");
                    addCors(response);
                    return response;
                } catch (Exception error) {
                    upstream.close();
                    throw error;
                }
            } catch (Exception error) {
                Response response = newFixedLengthResponse(getStatus(502, "Bad Gateway"), "text/plain", "Proxy error: " + error.getMessage());
                addCors(response);
                return response;
            }
        }

        private Response serveLocalFile(IHTTPSession session, String rawPath) {
            try {
                if (rawPath == null || rawPath.isEmpty()) return newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "Missing path");
                File root = allowedFileRoot.getCanonicalFile();
                File file = new File(rawPath).getCanonicalFile();
                if (!file.getPath().startsWith(root.getPath() + File.separator) || !file.isFile()) {
                    return newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "Download not found");
                }

                long fileLength = file.length();
                long start = 0;
                long end = fileLength - 1;
                String range = session.getHeaders().get("range");
                boolean partial = range != null && range.startsWith("bytes=");
                if (partial) {
                    String[] values = range.substring(6).split("-", 2);
                    if (!values[0].isEmpty()) start = Long.parseLong(values[0]);
                    if (values.length > 1 && !values[1].isEmpty()) end = Math.min(end, Long.parseLong(values[1]));
                    if (start < 0 || start >= fileLength || end < start) {
                        Response invalid = newFixedLengthResponse(Status.RANGE_NOT_SATISFIABLE, "text/plain", "Invalid range");
                        invalid.addHeader("Content-Range", "bytes */" + fileLength);
                        addCors(invalid);
                        return invalid;
                    }
                }

                FileInputStream input = new FileInputStream(file);
                long skipped = 0;
                while (skipped < start) {
                    long amount = input.skip(start - skipped);
                    if (amount <= 0) break;
                    skipped += amount;
                }
                long length = end - start + 1;
                String mime = file.getName().endsWith(".ts") ? "video/mp2t"
                    : file.getName().endsWith(".mp4") ? "video/mp4"
                    : file.getName().endsWith(".webp") ? "image/webp"
                    : file.getName().endsWith(".png") ? "image/png"
                    : file.getName().endsWith(".html") ? "text/html; charset=utf-8"
                    : "image/jpeg";
                Response response = newFixedLengthResponse(partial ? Status.PARTIAL_CONTENT : Status.OK, mime, input, length);
                response.addHeader("Accept-Ranges", "bytes");
                response.addHeader("Content-Length", String.valueOf(length));
                if (partial) response.addHeader("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
                addCors(response);
                return response;
            } catch (Exception error) {
                Response response = newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "File error: " + error.getMessage());
                addCors(response);
                return response;
            }
        }

        private static Response.IStatus getStatus(final int code, final String message) {
            Response.IStatus status = Status.lookup(code);
            if (status != null) return status;
            return new Response.IStatus() {
                @Override
                public String getDescription() {
                    return message == null ? "" : message;
                }

                @Override
                public int getRequestStatus() {
                    return code;
                }
            };
        }

        private static final Pattern URI_PATTERN = Pattern.compile("URI=([\"'])(.*?)\\1");

        private String rewritePlaylist(String playlist, String source, String referer) throws Exception {
            URL base = new URL(source);
            StringBuilder result = new StringBuilder();
            for (String line : playlist.split("\\r?\\n", -1)) {
                String trimmed = line.trim();
                if (trimmed.startsWith("#")) {
                    Matcher m = URI_PATTERN.matcher(line);
                    if (m.find()) {
                        String rawUri = m.group(2);
                        String absolute = new URL(base, rawUri).toString();
                        line = line.substring(0, m.start(2)) + proxyUrl(absolute, referer) + line.substring(m.end(2));
                    }
                } else if (!trimmed.isEmpty()) {
                    line = proxyUrl(new URL(base, trimmed).toString(), referer);
                }
                result.append(line).append('\n');
            }
            return result.toString();
        }

        private static void addCors(Response response) {
            response.addHeader("Access-Control-Allow-Origin", "*");
            response.addHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            response.addHeader("Access-Control-Allow-Headers", "*");
            response.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
        }

        private static String encode(String value) { return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8); }
        private static String decode(String value) { return value == null ? "" : URLDecoder.decode(value, StandardCharsets.UTF_8); }
    }
}
