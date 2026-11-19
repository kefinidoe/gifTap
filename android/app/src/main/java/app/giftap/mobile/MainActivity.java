package app.giftap.mobile;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final Pattern URL_PATTERN = Pattern.compile("https?://\\S+", Pattern.CASE_INSENSITIVE);

    private String pendingExtractUrl = "";
    private boolean pendingFromBubble = false;
    private boolean awaitFocusClipboard = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatingBubblePlugin.class);
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && awaitFocusClipboard) {
            awaitFocusClipboard = false;
            String clipUrl = extractFirstUrl(readClipboardText());
            if (!clipUrl.isEmpty()) {
                pendingExtractUrl = clipUrl;
            }
            if (pendingFromBubble || !pendingExtractUrl.isEmpty()) {
                FloatingBubblePlugin.notifyBubbleTap(pendingExtractUrl);
            }
        }
    }

    public String consumePendingExtractUrl() {
        String url = pendingExtractUrl;
        pendingExtractUrl = "";
        return url;
    }

    public boolean consumePendingFromBubble() {
        boolean val = pendingFromBubble;
        pendingFromBubble = false;
        return val;
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;

        boolean fromBubble = intent.getBooleanExtra(FloatingBubbleService.EXTRA_FROM_BUBBLE, false);
        String bubbleClip = intent.getStringExtra(FloatingBubbleService.EXTRA_CLIPBOARD_URL);
        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        String dataString = intent.getDataString();

        String candidateUrl = extractFirstUrl(bubbleClip);
        if (candidateUrl.isEmpty()) {
            candidateUrl = extractFirstUrl(sharedText);
        }
        if (candidateUrl.isEmpty()) {
            candidateUrl = extractFirstUrl(dataString);
        }

        if (!candidateUrl.isEmpty()) {
            pendingExtractUrl = candidateUrl;
        }
        if (fromBubble) {
            pendingFromBubble = true;
            // On Android 10+, reading clipboard succeeds reliably once the Activity receives window focus
            awaitFocusClipboard = pendingExtractUrl.isEmpty();
            if (!awaitFocusClipboard) {
                FloatingBubblePlugin.notifyBubbleTap(pendingExtractUrl);
            }
        } else if (!pendingExtractUrl.isEmpty()) {
            FloatingBubblePlugin.notifyBubbleTap(pendingExtractUrl);
        }
    }

    private String readClipboardText() {
        try {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null && clipboard.hasPrimaryClip()) {
                ClipData clip = clipboard.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence text = clip.getItemAt(0).coerceToText(this);
                    if (text != null) {
                        return text.toString().trim();
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private static String extractFirstUrl(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        Matcher matcher = URL_PATTERN.matcher(raw);
        return matcher.find() ? matcher.group() : "";
    }
}
