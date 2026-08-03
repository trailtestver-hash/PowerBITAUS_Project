package org.safeerulquran.mini;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.Locale;

public final class MainActivity extends Activity {
    private WebView webView;
    private TextToSpeech textToSpeech;
    private volatile boolean ttsReady;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(111, 23, 27));
        window.setNavigationBarColor(Color.rgb(111, 23, 27));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(255, 249, 241));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);

        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = textToSpeech.setLanguage(new Locale("ar"));
                textToSpeech.setSpeechRate(0.82f);
                textToSpeech.setPitch(1.0f);
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA
                        && result != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });

        webView.addJavascriptInterface(new NativeSpeechBridge(), "AndroidTTS");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternalIfNeeded(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternalIfNeeded(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                String bridgeScript = "(function(){"
                        + "window.speak=function(text,trigger){"
                        + "try{AndroidTTS.speak(String(text||''));}catch(e){}"
                        + "};"
                        + "})();";
                view.evaluateJavascript(bridgeScript, null);
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private boolean openExternalIfNeeded(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null || "file".equalsIgnoreCase(scheme)
                || "about".equalsIgnoreCase(scheme)
                || "javascript".equalsIgnoreCase(scheme)) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(this, "No app is available to open this link.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    public final class NativeSpeechBridge {
        @JavascriptInterface
        public void speak(final String text) {
            if (text == null || text.trim().isEmpty()) return;
            runOnUiThread(() -> {
                if (!ttsReady) {
                    Toast.makeText(MainActivity.this,
                            "Arabic text-to-speech is not available on this device.",
                            Toast.LENGTH_SHORT).show();
                    return;
                }
                textToSpeech.stop();
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "msq-word");
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                if (textToSpeech != null) textToSpeech.stop();
            });
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidTTS");
            webView.destroy();
            webView = null;
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        super.onDestroy();
    }
}
