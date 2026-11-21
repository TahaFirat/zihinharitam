# ==============================================================================
# ZihinHaritam — Maximum R8 Full-Mode Optimization, Shrinking & Obfuscation
# Safely preserves Capacitor 7 Bridge + Google Play Billing 8.0.0 reflection
# while maximizing DEX shrinking, obfuscation % and runtime speed.
# ==============================================================================

-optimizationpasses 5
-allowaccessmodification
-repackageclasses 'o'
-mergeinterfacesaggressively
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod

# Strip debug & verbose Android logging calls in release DEX
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# Keep App Entrypoint & Native Google Play Billing 8.0.0 Capacitor Plugin
-keep class com.tahafirat.zihinharitam.MainActivity { *; }
-keep class com.tahafirat.zihinharitam.PlayBillingPlugin { *; }

# Keep Capacitor Plugins discovered via capacitor.plugins.json / @CapacitorPlugin annotations
-keep @com.getcapacitor.annotation.CapacitorPlugin class * {
    public <init>();
    <methods>;
}
-keep @com.getcapacitor.annotation.NativePlugin class * {
    public <init>();
    <methods>;
}
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor Core Bridge JNI / WebView reflection callbacks
-keepclassmembers class com.getcapacitor.MessageHandler {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.BridgeActivity { *; }
-keep class com.getcapacitor.Plugin {
    public <init>();
}
-keep class * extends com.getcapacitor.Plugin {
    public <init>();
}

# Keep Cordova compatibility shim classes only when referenced
-keep class org.apache.cordova.CordovaPlugin { *; }
-keep class * extends org.apache.cordova.CordovaPlugin {
    public <init>();
}

# Play Billing 8.0.0 ships its own minimal consumer-proguard-rules.pro inside its AAR;
# do not wildcard-keep all billing internals so R8 can fully shrink & obfuscate them!
-dontwarn com.android.billingclient.**
-dontwarn com.google.android.gms.**
-dontwarn org.apache.cordova.**
