package app.giftap.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.app.NotificationCompat;

public class FloatingBubbleService extends Service {
    public static final String CHANNEL_ID = "giftap_overlay_channel";
    public static final int NOTIFICATION_ID = 4107;
    public static final String ACTION_STOP_OVERLAY = "app.giftap.mobile.ACTION_STOP_OVERLAY";
    public static final String EXTRA_FROM_BUBBLE = "giftap_from_bubble";
    public static final String EXTRA_CLIPBOARD_URL = "giftap_clipboard_url";

    private static volatile boolean running = false;

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams layoutParams;

    public static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        startForegroundNotification();
        createBubbleOverlay();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_OVERLAY.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (bubbleView == null) {
            createBubbleOverlay();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (windowManager != null && bubbleView != null) {
            try {
                windowManager.removeView(bubbleView);
            } catch (IllegalArgumentException ignored) {
            }
            bubbleView = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "GifTap Floating Capture",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps the 60x60 GifTap capture bubble floating over TikTok, Instagram, and X.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, FloatingBubbleService.class);
        stopIntent.setAction(ACTION_STOP_OVERLAY);
        PendingIntent stopPending = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_giftap_bubble)
            .setContentTitle("GifTap Floating Button Active")
            .setContentText("Copy a TikTok, IG, or X link and tap the bubble to grab the GIF.")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openPending)
            .addAction(0, "Turn Off", stopPending)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createBubbleOverlay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            return;
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) {
            return;
        }

        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int sizePx = Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 60f, metrics));
        int iconPadPx = Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 14f, metrics));

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundResource(R.drawable.giftap_bubble_bg);
        container.setElevation(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 8f, metrics));
        container.setContentDescription("GifTap Floating Capture Button");

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_giftap_bubble);
        logo.setPadding(iconPadPx, iconPadPx, iconPadPx, iconPadPx);
        container.addView(
            logo,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );

        int windowType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        layoutParams = new WindowManager.LayoutParams(
            sizePx,
            sizePx,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        layoutParams.x = metrics.widthPixels - sizePx - Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 12f, metrics));
        layoutParams.y = Math.round(metrics.heightPixels * 0.35f);

        container.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        moved = false;
                        v.setScaleX(0.94f);
                        v.setScaleY(0.94f);
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        int dx = Math.round(event.getRawX() - initialTouchX);
                        int dy = Math.round(event.getRawY() - initialTouchY);
                        if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
                            moved = true;
                        }
                        layoutParams.x = Math.max(0, Math.min(metrics.widthPixels - sizePx, initialX + dx));
                        layoutParams.y = Math.max(0, Math.min(metrics.heightPixels - sizePx, initialY + dy));
                        windowManager.updateViewLayout(v, layoutParams);
                        return true;

                    case MotionEvent.ACTION_UP:
                        v.setScaleX(1f);
                        v.setScaleY(1f);
                        if (!moved) {
                            handleBubbleTap();
                        } else {
                            // Snap cleanly to nearest horizontal edge
                            int midpoint = (metrics.widthPixels - sizePx) / 2;
                            int margin = Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 10f, metrics));
                            layoutParams.x = layoutParams.x < midpoint
                                ? margin
                                : Math.max(margin, metrics.widthPixels - sizePx - margin);
                            windowManager.updateViewLayout(v, layoutParams);
                        }
                        return true;

                    case MotionEvent.ACTION_CANCEL:
                        v.setScaleX(1f);
                        v.setScaleY(1f);
                        return true;
                }
                return false;
            }
        });

        bubbleView = container;
        windowManager.addView(bubbleView, layoutParams);
    }

    private void handleBubbleTap() {
        String clipboardText = readClipboardSafe();
        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        launch.putExtra(EXTRA_FROM_BUBBLE, true);
        if (clipboardText != null && !clipboardText.isEmpty()) {
            launch.putExtra(EXTRA_CLIPBOARD_URL, clipboardText);
        }
        startActivity(launch);
    }

    private String readClipboardSafe() {
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
}
