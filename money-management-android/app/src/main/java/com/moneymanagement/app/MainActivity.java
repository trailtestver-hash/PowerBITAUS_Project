package com.moneymanagement.app;

import android.app.Activity;
import android.content.Intent;
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
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int BACKUP_EXPORT_REQUEST = 2001;
    private static final int BACKUP_IMPORT_REQUEST = 2002;

    private static final String RAW_BASE =
            "https://raw.githubusercontent.com/trailtestver-hash/PowerBITAUS_Project/" +
            "money-management-loans/money-management-android/app/src/main/assets/";
    private static final String APP_ORIGIN = "https://money-management.local/";
    private static final String CACHE_FILE = "money-management-live.html";
    private static final String BACKUP_PREFS = "money_management_backup";
    private static final String BACKUP_KEY = "state_json";
    private static final String LEGACY_URL =
            "https://jewels-money-management.truongnguyetanh22964.chatgpt.site/";

    private WebView webView;
    private TextView loadingView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingExportText;

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
        loadLatestVersion();
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
                settings.getUserAgentString() + " MoneyManagementStable/1.7");

        webView.addJavascriptInterface(new BackupBridge(), "MoneyBackup");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                webView.setVisibility(View.VISIBLE);
                loadingView.setVisibility(View.GONE);
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
            if (json == null || json.trim().isEmpty()) {
                return;
            }
            getSharedPreferences(BACKUP_PREFS, MODE_PRIVATE)
                    .edit()
                    .putString(BACKUP_KEY, json)
                    .apply();
        }

        @JavascriptInterface
        public String getBackup() {
            return getSharedPreferences(BACKUP_PREFS, MODE_PRIVATE)
                    .getString(BACKUP_KEY, "");
        }

        @JavascriptInterface
        public void exportBackup(String json) {
            pendingExportText = json;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(
                        Intent.EXTRA_TITLE,
                        "Money_Management_Backup.json");
                startActivityForResult(intent, BACKUP_EXPORT_REQUEST);
            });
        }

        @JavascriptInterface
        public void importBackup() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
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
                "MoneyManagementAndroid/1.7");

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

    private void writeExport(Uri uri) {
        if (uri == null || pendingExportText == null) {
            return;
        }
        try (OutputStream output =
                     getContentResolver().openOutputStream(uri)) {
            if (output == null) {
                throw new IOException("Output stream unavailable");
            }
            output.write(
                    pendingExportText.getBytes(StandardCharsets.UTF_8));
            output.flush();
            Toast.makeText(
                    this,
                    "Google Drive/ফাইলে Backup save হয়েছে",
                    Toast.LENGTH_LONG).show();
        } catch (IOException error) {
            Toast.makeText(
                    this,
                    "Backup save করা যায়নি",
                    Toast.LENGTH_LONG).show();
        } finally {
            pendingExportText = null;
        }
    }

    private void readImport(Uri uri) {
        if (uri == null) {
            return;
        }
        try (InputStream input =
                     getContentResolver().openInputStream(uri)) {
            if (input == null) {
                throw new IOException("Input stream unavailable");
            }
            String text = readStream(input);
            String script =
                    "window.receiveImportedBackup(" +
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

        if (requestCode == BACKUP_EXPORT_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                writeExport(data.getData());
            } else {
                pendingExportText = null;
            }
            return;
        }

        if (requestCode == BACKUP_IMPORT_REQUEST &&
                resultCode == RESULT_OK &&
                data != null) {
            readImport(data.getData());
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
