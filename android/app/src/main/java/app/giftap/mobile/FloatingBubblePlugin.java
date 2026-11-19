package app.giftap.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "FloatingBubble")
public class FloatingBubblePlugin extends Plugin {
    private static WeakReference<FloatingBubblePlugin> instanceRef = new WeakReference<>(null);

    @Override
    public void load() {
        instanceRef = new WeakReference<>(this);
    }

    public static void notifyBubbleTap(String url) {
        FloatingBubblePlugin plugin = instanceRef.get();
        if (plugin != null) {
            JSObject payload = new JSObject();
            payload.put("url", url != null ? url : "");
            payload.put("fromBubble", true);
            plugin.notifyListeners("bubbleTapped", payload, true);
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || Settings.canDrawOverlays(getContext());
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext())) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        startActivityForResult(call, intent, "onOverlayPermissionResult");
    }

    @ActivityCallback
    private void onOverlayPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || Settings.canDrawOverlays(getContext());
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void startOverlay(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("SYSTEM_ALERT_WINDOW permission not granted");
            return;
        }
        Intent serviceIntent = new Intent(getContext(), FloatingBubbleService.class);
        ContextCompat.startForegroundService(getContext(), serviceIntent);
        JSObject ret = new JSObject();
        ret.put("running", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopOverlay(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), FloatingBubbleService.class);
        getContext().stopService(serviceIntent);
        JSObject ret = new JSObject();
        ret.put("running", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", FloatingBubbleService.isRunning());
        call.resolve(ret);
    }

    @PluginMethod
    public void getPendingLink(PluginCall call) {
        MainActivity activity = getActivity() instanceof MainActivity ? (MainActivity) getActivity() : null;
        JSObject ret = new JSObject();
        if (activity != null) {
            String pendingUrl = activity.consumePendingExtractUrl();
            boolean fromBubble = activity.consumePendingFromBubble();
            ret.put("url", pendingUrl != null ? pendingUrl : "");
            ret.put("fromBubble", fromBubble);
        } else {
            ret.put("url", "");
            ret.put("fromBubble", false);
        }
        call.resolve(ret);
    }
}
