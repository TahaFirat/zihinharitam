package com.tahafirat.zihinharitam;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);

        // Android 15/16 (API 35/36) Edge-to-Edge & Tablet Taskbar Safe-Area Protection:
        // Pads the root content container by exact systemBars + displayCutout insets so
        // tablet app docks/taskbars, 3-button nav bars, gesture bars, and status bars NEVER
        // overlap bottom controls (Boyut S/M/L/XL, Renkler, Modals, HUDs).
        final View rootView = findViewById(android.R.id.content);
        if (rootView != null) {
            rootView.setBackgroundColor(Color.parseColor("#FAF9F5"));
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                        | WindowInsetsCompat.Type.displayCutout()
                        | WindowInsetsCompat.Type.tappableElement()
                );
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(rootView);
        }

        // Enable GPU hardware compositing & fast WebView caching for 60/120 FPS canvas smoothness
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView wv = this.bridge.getWebView();
            wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            WebSettings settings = wv.getSettings();
            if (settings != null) {
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
            }
        }
    }
}
