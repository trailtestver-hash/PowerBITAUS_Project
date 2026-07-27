package com.moneymanagement.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int BACKUP_IMPORT_REQUEST = 2002;
    private static final int DRIVE_CONNECT_REQUEST = 2003;

    private static final String RAW_BASE =
            "https://raw.githubusercontent.com/trailtestver-hash/PowerBITAUS_Project/" +
            "money-management-loans/money-management-android/app/src/main/assets/";
    private static final String APP_ORIGIN = "https://money-management.local/";
    private static final String CACHE_FILE = "money-management-live.html";
    private static final String LEGACY_URL =
            "https://jewels-money-management.truongnguyetanh22964.chatgpt.site/";

    private WebView webView;
    private TextView loadingView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingDriveText;

    private interface TextLoader {
        String load(String relativePath) throws Exception;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(15, 118, 110));
        window.setNavigationBarColor(Color.WHITE);

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        webView.setVisibility(View.INVISIBLE);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        loadingView = new TextView(this);
        loadingView.setText("Money Management\nসর্বশেষ সংস্করণ লোড হচ্ছে…");
        loadingView.setTextColor(Color.rgb(15, 118, 110));
        loadingView.setTextSize(18);
        loadingView.setGravity(Gravity.CENTER);
        loadingView.setBackgroundColor(Color.rgb(241, 251, 249));
        root.addView(loadingView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        configureWebView();
        BackupAlarmReceiver.scheduleFromPreferences(this);
        loadLatestVersion();
    }

    private SharedPreferences backupPreferences() {
        return getSharedPreferences(BackupAlarmReceiver.BACKUP_PREFS, MODE_PRIVATE);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUserAgentString(
                settings.getUserAgentString() + " MoneyManagementStable/1.8");

        webView.addJavascriptInterface(new BackupBridge(), "MoneyBackup");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                webView.setVisibility(View.VISIBLE);
                loadingView.setVisibility(View.GONE);
                pushDriveStatus();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = filePathCallback;
                try {
                    startActivityForResult(
                            fileChooserParams.createIntent(),
                            FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    fileCallback = null;
                    return false;
                }
            }
        });
    }

    private class BackupBridge {
        @JavascriptInterface
        public void saveBackup(String json) {
            saveNativeState(json);
        }

        @JavascriptInterface
        public String getBackup() {
            return backupPreferences().getString(
                    BackupAlarmReceiver.BACKUP_KEY,
                    "");
        }

        @JavascriptInterface
        public String getDriveStatus() {
            return buildDriveStatus().toString();
        }

        @JavascriptInterface
        public void connectDrive(String json) {
            saveNativeState(json);
            pendingDriveText = json;
            runOnUiThread(MainActivity.this::launchDriveFilePicker);
        }

        @JavascriptInterface
        public void backupNow(String json) {
            saveNativeState(json);
            pendingDriveText = json;
            runOnUiThread(() -> {
                String uri = backupPreferences().getString(
                        BackupAlarmReceiver.DRIVE_URI_KEY,
                        "");
                if (uri.isEmpty()) {
                    launchDriveFilePicker();
                    return;
                }
                new Thread(() -> {
                    boolean success = BackupAlarmReceiver.writeNow(
                            MainActivity.this);
                    runOnUiThread(() -> {
                        notifyBackupResult(
                                success,
                                success
                                        ? "Google Drive backup সম্পন্ন হয়েছে"
                                        : "Drive backup করা যায়নি");
                        pushDriveStatus();
                    });
                }).start();
            });
        }

        @JavascriptInterface
        public void setAutoBackupMinutes(int requestedMinutes) {
            int minutes = normaliseInterval(requestedMinutes);
            backupPreferences().edit()
                    .putInt(BackupAlarmReceiver.AUTO_MINUTES_KEY, minutes)
                    .apply();
            BackupAlarmReceiver.schedule(MainActivity.this, minutes);
            runOnUiThread(() -> {
                if (minutes > 0 && backupPreferences().getString(
                        BackupAlarmReceiver.DRIVE_URI_KEY,
                        "").isEmpty()) {
                    pendingDriveText = backupPreferences().getString(
                            BackupAlarmReceiver.BACKUP_KEY,
                            "");
                    launchDriveFilePicker();
                } else {
                    pushDriveStatus();
                }
            });
        }

        @JavascriptInterface
        public void disconnectDrive() {
            backupPreferences().edit()
                    .remove(BackupAlarmReceiver.DRIVE_URI_KEY)
                    .remove(BackupAlarmReceiver.LAST_BACKUP_KEY)
                    .putInt(BackupAlarmReceiver.AUTO_MINUTES_KEY, 0)
                    .apply();
            BackupAlarmReceiver.cancel(MainActivity.this);
            runOnUiThread(() -> {
                Toast.makeText(
                        MainActivity.this,
                        "Google Drive backup disconnect হয়েছে",
                        Toast.LENGTH_SHORT).show();
                pushDriveStatus();
            });
        }

        @JavascriptInterface
        public void importBackup() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(intent, BACKUP_IMPORT_REQUEST);
            });
        }

        @JavascriptInterface
        public void openLegacyWeb() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse(LEGACY_URL)));
                } catch (Exception error) {
                    Toast.makeText(
                            MainActivity.this,
                            "পুরোনো Web App খোলা যায়নি",
                            Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private int normaliseInterval(int value) {
        int[] allowed = {0, 15, 30, 60, 180, 360, 720, 1440};
        for (int item : allowed) {
            if (item == value) {
                return item;
            }
        }
        return 0;
    }

    private void saveNativeState(String json) {
        if (json == null || json.trim().isEmpty()) {
            return;
        }
        backupPreferences().edit()
                .putString(BackupAlarmReceiver.BACKUP_KEY, json)
                .apply();
    }

    private void launchDriveFilePicker() {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "Money_Management_Cloud_Backup.json");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(intent, DRIVE_CONNECT_REQUEST);
    }

    private JSONObject buildDriveStatus() {
        SharedPreferences preferences = backupPreferences();
        JSONObject status = new JSONObject();
        try {
            String uri = preferences.getString(
                    BackupAlarmReceiver.DRIVE_URI_KEY,
                    "");
            status.put("connected", !uri.isEmpty());
            status.put("intervalMinutes", preferences.getInt(
                    BackupAlarmReceiver.AUTO_MINUTES_KEY,
                    0));
            status.put("lastBackupAt", preferences.getLong(
                    BackupAlarmReceiver.LAST_BACKUP_KEY,
                    0L));
        } catch (Exception ignored) {
            // The object still contains safe default values when possible.
        }
        return status;
    }

    private void pushDriveStatus() {
        if (webView == null) {
            return;
        }
        String script = "window.receiveDriveStatus&&window.receiveDriveStatus(" +
                buildDriveStatus().toString() + ");";
        webView.evaluateJavascript(script, null);
    }

    private void notifyBackupResult(boolean success, String message) {
        if (webView == null) {
            return;
        }
        String script = "window.onDriveBackupResult&&window.onDriveBackupResult(" +
                success + "," + JSONObject.quote(message) + ");";
        webView.evaluateJavascript(script, null);
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void connectDriveResult(Intent data) {
        Uri uri = data == null ? null : data.getData();
        if (uri == null) {
            pendingDriveText = null;
            return;
        }

        int flags = data.getFlags() &
                (Intent.FLAG_GRANT_READ_URI_PERMISSION |
                        Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (Exception ignored) {
            // Some document providers persist permission automatically.
        }

        backupPreferences().edit()
                .putString(BackupAlarmReceiver.DRIVE_URI_KEY, uri.toString())
                .apply();
        if (pendingDriveText != null && !pendingDriveText.trim().isEmpty()) {
            saveNativeState(pendingDriveText);
        }
        pendingDriveText = null;

        new Thread(() -> {
            boolean success = BackupAlarmReceiver.writeNow(this);
            int minutes = backupPreferences().getInt(
                    BackupAlarmReceiver.AUTO_MINUTES_KEY,
                    0);
            BackupAlarmReceiver.schedule(this, minutes);
            runOnUiThread(() -> {
                notifyBackupResult(
                        success,
                        success
                                ? "Google Drive সংযুক্ত এবং backup হয়েছে"
                                : "Drive file সংযুক্ত হয়েছে, কিন্তু backup ব্যর্থ");
                pushDriveStatus();
            });
        }).start();
    }

    private void loadLatestVersion() {
        new Thread(() -> {
            String page;
            try {
                page = buildRemotePage();
                writeCache(page);
            } catch (Exception remoteError) {
                page = readCache();
                if (page == null) {
                    try {
                        page = buildBundledPage();
                    } catch (Exception localError) {
                        page = errorPage(localError.getMessage());
                    }
                }
            }

            final String finalPage = page;
            runOnUiThread(() -> webView.loadDataWithBaseURL(
                    APP_ORIGIN,
                    finalPage,
                    "text/html",
                    "UTF-8",
                    null));
        }).start();
    }

    private String buildRemotePage() throws Exception {
        final long refresh = System.currentTimeMillis();
        String html = fetchText(RAW_BASE + "index.html?refresh=" + refresh);
        return inlineAssets(html, relativePath ->
                fetchText(RAW_BASE + relativePath + "?refresh=" + refresh));
    }

    private String buildBundledPage() throws Exception {
        String html = readAsset("index.html");
        return inlineAssets(html, this::readAsset);
    }

    private String inlineAssets(String html, TextLoader loader) throws Exception {
        Pattern cssPattern = Pattern.compile(
                "<link\\s+[^>]*href=[\\\"']([^\\\"']+\\.css)[\\\"'][^>]*>",
                Pattern.CASE_INSENSITIVE);
        Matcher cssMatcher = cssPattern.matcher(html);
        StringBuffer cssOutput = new StringBuffer();
        while (cssMatcher.find()) {
            String path = cssMatcher.group(1);
            if (path.startsWith("http://") || path.startsWith("https://")) {
                cssMatcher.appendReplacement(
                        cssOutput,
                        Matcher.quoteReplacement(cssMatcher.group()));
                continue;
            }
            String css = loader.load(path).replace("</style>", "<\\/style>");
            cssMatcher.appendReplacement(
                    cssOutput,
                    Matcher.quoteReplacement("<style>\n" + css + "\n</style>"));
        }
        cssMatcher.appendTail(cssOutput);

        Pattern scriptPattern = Pattern.compile(
                "<script\\s+[^>]*src=[\\\"']([^\\\"']+\\.js)[\\\"'][^>]*>\\s*</script>",
                Pattern.CASE_INSENSITIVE);
        Matcher scriptMatcher = scriptPattern.matcher(cssOutput.toString());
        StringBuffer scriptOutput = new StringBuffer();
        while (scriptMatcher.find()) {
            String path = scriptMatcher.group(1);
            if (path.startsWith("http://") || path.startsWith("https://")) {
                scriptMatcher.appendReplacement(
                        scriptOutput,
                        Matcher.quoteReplacement(scriptMatcher.group()));
                continue;
            }
            String script = loader.load(path).replace("</script>", "<\\/script>");
            scriptMatcher.appendReplacement(
                    scriptOutput,
                    Matcher.quoteReplacement("<script>\n" + script + "\n</script>"));
        }
        scriptMatcher.appendTail(scriptOutput);
        return scriptOutput.toString();
    }

    private String fetchText(String urlText) throws IOException {
        HttpURLConnection connection =
                (HttpURLConnection) new URL(urlText).openConnection();
        connection.setConnectTimeout(7000);
        connection.setReadTimeout(7000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Cache-Control", "no-cache");
        connection.setRequestProperty(
                "User-Agent",
                "MoneyManagementAndroid/1.8");

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            connection.disconnect();
            throw new IOException("HTTP " + status);
        }

        try (InputStream input = connection.getInputStream()) {
            return readStream(input);
        } finally {
            connection.disconnect();
        }
    }

    private String readAsset(String name) throws IOException {
        try (InputStream input = getAssets().open(name)) {
            return readStream(input);
        }
    }

    private String readStream(InputStream input) throws IOException {
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }
        }
        return output.toString();
    }

    private void writeCache(String page) {
        File target = new File(getFilesDir(), CACHE_FILE);
        try (FileOutputStream output = new FileOutputStream(target)) {
            output.write(page.getBytes(StandardCharsets.UTF_8));
        } catch (IOException ignored) {
            // Cache failure must not prevent the app from opening.
        }
    }

    private String readCache() {
        File target = new File(getFilesDir(), CACHE_FILE);
        if (!target.exists()) {
            return null;
        }
        try (FileInputStream input = new FileInputStream(target)) {
            return readStream(input);
        } catch (IOException ignored) {
            return null;
        }
    }

    private String errorPage(String message) {
        String safe = message == null
                ? "Unknown error"
                : message.replace("<", "&lt;");
        return "<!doctype html><html><meta charset='utf-8'><meta name='viewport' " +
                "content='width=device-width,initial-scale=1'><body style='font-family:sans-serif;" +
                "padding:24px;background:#f1fbf9;color:#17313a'><h2>Money Management</h2>" +
                "<p>অ্যাপটি লোড করা যায়নি। Internet চালু করে আবার খুলুন।</p><small>" +
                safe + "</small></body></html>";
    }

    private void readImport(Uri uri, int flags) {
        if (uri == null) {
            return;
        }
        try {
            getContentResolver().takePersistableUriPermission(
                    uri,
                    flags & Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
            // Persisting permission is optional for a one-time restore.
        }
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) {
                throw new IOException("Input stream unavailable");
            }
            String text = readStream(input);
            String script = "window.receiveImportedBackup(" +
                    JSONObject.quote(text) +
                    ");";
            webView.evaluateJavascript(script, null);
        } catch (Exception error) {
            Toast.makeText(
                    this,
                    "Backup file পড়া যায়নি",
                    Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileCallback == null) {
                return;
            }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri selected = data.getData();
                if (selected != null) {
                    results = new Uri[]{selected};
                }
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
            return;
        }

        if (requestCode == DRIVE_CONNECT_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                connectDriveResult(data);
            } else {
                pendingDriveText = null;
                pushDriveStatus();
            }
            return;
        }

        if (requestCode == BACKUP_IMPORT_REQUEST &&
                resultCode == RESULT_OK &&
                data != null) {
            readImport(data.getData(), data.getFlags());
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
