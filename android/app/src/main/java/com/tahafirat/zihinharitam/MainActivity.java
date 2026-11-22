package com.tahafirat.zihinharitam;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean lastStylusEraserActive = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);

        // Unlock native 90Hz / 120Hz / 144Hz high refresh rate on supported Android tablets & phones!
        enableHighRefreshRateDisplay();

        // Android 15/16 (API 35/36) Edge-to-Edge & Tablet Taskbar Safe-Area Protection
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

        // Enable GPU hardware compositing, native touch responsiveness & fast WebView caching
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView wv = this.bridge.getWebView();
            wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
            wv.setVerticalScrollBarEnabled(false);
            wv.setHorizontalScrollBarEnabled(false);
            wv.setLongClickable(false);
            wv.setHapticFeedbackEnabled(false);
            WebSettings settings = wv.getSettings();
            if (settings != null) {
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
            }
        }
    }

    /**
     * Native Samsung S-Pen & Android Stylus Hardware Eraser Button Detection:
     * Detects MotionEvent.TOOL_TYPE_ERASER (tail eraser) AND MotionEvent.BUTTON_STYLUS_PRIMARY
     * (S-Pen side barrel button) across both touch and hover events, notifying the WebView immediately!
     */
    private void inspectStylusHardwareButton(MotionEvent ev) {
        if (ev == null || ev.getPointerCount() == 0) return;
        int toolType = ev.getToolType(0);
        if (toolType != MotionEvent.TOOL_TYPE_STYLUS && toolType != MotionEvent.TOOL_TYPE_ERASER) {
            return;
        }
        int btnState = ev.getButtonState();
        boolean isBarrelDown =
            (btnState & MotionEvent.BUTTON_STYLUS_PRIMARY) != 0
                || (btnState & MotionEvent.BUTTON_STYLUS_SECONDARY) != 0
                || (btnState & MotionEvent.BUTTON_SECONDARY) != 0;
        boolean isEraserNow = (toolType == MotionEvent.TOOL_TYPE_ERASER) || isBarrelDown;

        if (isEraserNow != lastStylusEraserActive) {
            lastStylusEraserActive = isEraserNow;
            if (this.bridge != null && this.bridge.getWebView() != null) {
                final boolean activeFlag = isEraserNow;
                this.bridge.getWebView().post(() -> {
                    if (this.bridge != null && this.bridge.getWebView() != null) {
                        this.bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('zh:stylus-eraser-hold', { detail: { active: "
                                + activeFlag
                                + ", source: 'android_spen' } }));",
                            null
                        );
                    }
                });
            }
        }
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        inspectStylusHardwareButton(ev);
        return super.dispatchTouchEvent(ev);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent ev) {
        inspectStylusHardwareButton(ev);
        return super.dispatchGenericMotionEvent(ev);
    }

    private void enableHighRefreshRateDisplay() {
        try {
            Display display = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                display = getDisplay();
            } else {
                display = getWindowManager().getDefaultDisplay();
            }
            if (display == null) return;

            Display.Mode currentMode = display.getMode();
            Display.Mode[] modes = display.getSupportedModes();
            Display.Mode bestMode = currentMode;
            for (Display.Mode mode : modes) {
                if (mode.getPhysicalWidth() == currentMode.getPhysicalWidth()
                        && mode.getPhysicalHeight() == currentMode.getPhysicalHeight()
                        && mode.getRefreshRate() > bestMode.getRefreshRate()) {
                    bestMode = mode;
                }
            }
            if (bestMode.getModeId() != currentMode.getModeId()) {
                WindowManager.LayoutParams params = getWindow().getAttributes();
                params.preferredDisplayModeId = bestMode.getModeId();
                getWindow().setAttributes(params);
            }
        } catch (Throwable ignored) {
            // Safe fallback on OEMs restricting display mode queries
        }
    }
}
