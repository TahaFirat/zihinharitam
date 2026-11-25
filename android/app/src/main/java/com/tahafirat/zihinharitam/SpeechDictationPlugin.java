package com.tahafirat.zihinharitam;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "SpeechDictation",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class SpeechDictationPlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean userWantsListening = false;
    private String activeLocale = "tr-TR";
    private String committedText = "";
    private String currentPartial = "";
    private int consecutiveSilentRestarts = 0;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        mainHandler.post(() -> {
            JSObject ret = new JSObject();
            ret.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        activeLocale = call.getString("locale", "tr-TR");
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermissionCallback");
            return;
        }
        startOnMain(call);
    }

    @PermissionCallback
    private void micPermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startOnMain(call);
        } else {
            call.reject("Mikrofon izni verilmedi.", "MIC_DENIED");
        }
    }

    private void startOnMain(PluginCall call) {
        mainHandler.post(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("Bu cihazda ses tanıma servisi bulunamadı.", "UNAVAILABLE");
                return;
            }
            userWantsListening = true;
            committedText = "";
            currentPartial = "";
            consecutiveSilentRestarts = 0;
            beginRecognizerSession();
            JSObject st = new JSObject();
            st.put("listening", true);
            notifyListeners("state", st);
            call.resolve(st);
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        mainHandler.post(() -> {
            userWantsListening = false;
            String out = buildCombinedText();
            destroyRecognizer();
            JSObject st = new JSObject();
            st.put("listening", false);
            notifyListeners("state", st);
            JSObject ret = new JSObject();
            ret.put("text", out);
            call.resolve(ret);
        });
    }

    private String buildCombinedText() {
        String a = committedText == null ? "" : committedText.trim();
        String b = currentPartial == null ? "" : currentPartial.trim();
        if (a.isEmpty()) return b;
        if (b.isEmpty()) return a;
        return a + " " + b;
    }

    private void beginRecognizerSession() {
        destroyRecognizer();
        recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {}

            @Override
            public void onBeginningOfSpeech() {}

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {}

            @Override
            public void onError(int error) {
                if (!userWantsListening) return;
                // Keep listening seamlessly across brief pauses instead of shutting down immediately!
                if ((error == SpeechRecognizer.ERROR_NO_MATCH
                        || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                        || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY)
                        && consecutiveSilentRestarts < 12) {
                    consecutiveSilentRestarts++;
                    mainHandler.postDelayed(() -> {
                        if (userWantsListening) {
                            beginRecognizerSession();
                        }
                    }, 180);
                    return;
                }
                userWantsListening = false;
                String out = buildCombinedText();
                destroyRecognizer();
                if (!out.isEmpty()) {
                    JSObject fin = new JSObject();
                    fin.put("text", out);
                    notifyListeners("final", fin);
                } else {
                    JSObject err = new JSObject();
                    err.put("message", "Ses algılanamadı, tekrar deneyin.");
                    notifyListeners("error", err);
                }
                JSObject st = new JSObject();
                st.put("listening", false);
                notifyListeners("state", st);
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results != null
                    ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    : null;
                if (matches != null && !matches.isEmpty()) {
                    String piece = matches.get(0).trim();
                    if (!piece.isEmpty()) {
                        consecutiveSilentRestarts = 0;
                        committedText = committedText.isEmpty() ? piece : (committedText + " " + piece);
                        currentPartial = "";
                        JSObject p = new JSObject();
                        p.put("text", committedText);
                        p.put("isFinal", true);
                        notifyListeners("partial", p);
                    }
                }
                if (userWantsListening) {
                    mainHandler.postDelayed(() -> {
                        if (userWantsListening) {
                            beginRecognizerSession();
                        }
                    }, 140);
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults != null
                    ? partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    : null;
                if (matches != null && !matches.isEmpty()) {
                    currentPartial = matches.get(0).trim();
                    String combined = buildCombinedText();
                    if (!combined.isEmpty()) {
                        JSObject p = new JSObject();
                        p.put("text", combined);
                        p.put("isFinal", false);
                        notifyListeners("partial", p);
                    }
                }
            }

            @Override
            public void onEvent(int eventType, Bundle params) {}
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, activeLocale);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, activeLocale);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3500L);
        recognizer.startListening(intent);
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            try {
                recognizer.stopListening();
                recognizer.cancel();
                recognizer.destroy();
            } catch (Throwable ignored) {
            }
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        userWantsListening = false;
        mainHandler.post(this::destroyRecognizer);
        super.handleOnDestroy();
    }
}
