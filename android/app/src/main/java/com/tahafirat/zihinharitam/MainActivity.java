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
    private boolean activeBarrelEraseGesture = false;

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
                settings.setAllowFileAccess(false);
                settings.setAllowContentAccess(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
                }
            }
        }
    }

    private boolean isStylusPointer(MotionEvent ev) {
        if (ev == null || ev.getPointerCount() == 0) return false;
        int toolType = ev.getToolType(0);
        return toolType == MotionEvent.TOOL_TYPE_STYLUS || toolType == MotionEvent.TOOL_TYPE_ERASER;
    }

    private boolean isStylusEraserButtonActive(MotionEvent ev) {
        if (!isStylusPointer(ev)) return false;
        int toolType = ev.getToolType(0);
        int btnState = ev.getButtonState();
        boolean isBarrelDown =
            (btnState & MotionEvent.BUTTON_STYLUS_PRIMARY) != 0
                || (btnState & MotionEvent.BUTTON_STYLUS_SECONDARY) != 0
                || (btnState & MotionEvent.BUTTON_SECONDARY) != 0;
        return (toolType == MotionEvent.TOOL_TYPE_ERASER) || isBarrelDown;
    }

    private void notifyWebViewStylusEraser(boolean isEraserNow) {
        if (isEraserNow == lastStylusEraserActive) return;
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

    /**
     * Critical Chromium WebView Fix (crbug/1371798 - StylusTextSelector):
     * When Samsung S-Pen side button (BUTTON_STYLUS_PRIMARY) is held while touching the screen,
     * Android Chromium's StylusTextSelector intercepts ACTION_DOWN/MOVE for text selection and
     * swallows all DOM PointerEvents (so the UI sees the button, but erasing never fires!).
     * Remapping the MotionEvent to TOOL_TYPE_ERASER with buttonState=0 bypasses StylusTextSelector
     * AND causes Blink PointerEventFactory to deliver native 120Hz pointerdown/move/up with
     * button=5 & buttons=32 directly to our CanvasStage eraser!
     */
    private MotionEvent obtainSanitizedEraserMotionEvent(MotionEvent ev) {
        int count = ev.getPointerCount();
        MotionEvent.PointerProperties[] props = new MotionEvent.PointerProperties[count];
        MotionEvent.PointerCoords[] coords = new MotionEvent.PointerCoords[count];
        for (int i = 0; i < count; i++) {
            props[i] = new MotionEvent.PointerProperties();
            coords[i] = new MotionEvent.PointerCoords();
            ev.getPointerProperties(i, props[i]);
            ev.getPointerCoords(i, coords[i]);
            if (props[i].toolType == MotionEvent.TOOL_TYPE_STYLUS
                    || props[i].toolType == MotionEvent.TOOL_TYPE_ERASER) {
                props[i].toolType = MotionEvent.TOOL_TYPE_ERASER;
            }
        }
        return MotionEvent.obtain(
            ev.getDownTime(),
            ev.getEventTime(),
            ev.getAction(),
            count,
            props,
            coords,
            ev.getMetaState(),
            0, // Clear BUTTON_STYLUS_PRIMARY so Chromium StylusTextSelector NEVER swallows the gesture
            ev.getXPrecision(),
            ev.getYPrecision(),
            ev.getDeviceId(),
            ev.getEdgeFlags(),
            ev.getSource(),
            ev.getFlags()
        );
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        if (ev != null && isStylusPointer(ev)) {
            int action = ev.getActionMasked();
            boolean eraserNow = isStylusEraserButtonActive(ev);

            if (action == MotionEvent.ACTION_DOWN) {
                activeBarrelEraseGesture = eraserNow;
                notifyWebViewStylusEraser(eraserNow);
            } else if (action == MotionEvent.ACTION_MOVE) {
                if (eraserNow) {
                    activeBarrelEraseGesture = true;
                }
                notifyWebViewStylusEraser(eraserNow);
            } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                boolean wasErasing = activeBarrelEraseGesture || eraserNow;
                activeBarrelEraseGesture = false;
                notifyWebViewStylusEraser(false);
                if (wasErasing) {
                    MotionEvent sanitized = obtainSanitizedEraserMotionEvent(ev);
                    try {
                        return super.dispatchTouchEvent(sanitized);
                    } finally {
                        sanitized.recycle();
                    }
                }
                return super.dispatchTouchEvent(ev);
            }

            if (eraserNow || activeBarrelEraseGesture) {
                MotionEvent sanitized = obtainSanitizedEraserMotionEvent(ev);
                try {
                    return super.dispatchTouchEvent(sanitized);
                } finally {
                    sanitized.recycle();
                }
            }
        } else if (ev != null && ev.getActionMasked() == MotionEvent.ACTION_DOWN) {
            activeBarrelEraseGesture = false;
            notifyWebViewStylusEraser(false);
        }
        return super.dispatchTouchEvent(ev);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent ev) {
        if (ev != null && isStylusPointer(ev)) {
            int action = ev.getActionMasked();
            if (action == MotionEvent.ACTION_HOVER_EXIT) {
                notifyWebViewStylusEraser(false);
            } else {
                notifyWebViewStylusEraser(isStylusEraserButtonActive(ev));
            }
        }
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
