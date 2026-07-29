package com.moneymanagement.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.SystemClock;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class BackupAlarmReceiver extends BroadcastReceiver {
    public static final String BACKUP_PREFS = "money_management_backup";
    public static final String BACKUP_KEY = "state_json";
    public static final String DRIVE_URI_KEY = "drive_uri";
    public static final String AUTO_MINUTES_KEY = "auto_minutes";
    public static final String LAST_BACKUP_KEY = "last_backup_at";

    private static final String ACTION_AUTO_BACKUP =
            "com.moneymanagement.app.AUTO_DRIVE_BACKUP";
    private static final int REQUEST_CODE = 7401;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? "" : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            scheduleFromPreferences(context);
            return;
        }
        if (ACTION_AUTO_BACKUP.equals(action)) {
            new Thread(() -> writeNow(context.getApplicationContext())).start();
        }
    }

    public static void scheduleFromPreferences(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(
                BACKUP_PREFS,
                Context.MODE_PRIVATE);
        schedule(context, preferences.getInt(AUTO_MINUTES_KEY, 0));
    }

    public static void schedule(Context context, int minutes) {
        cancel(context);
        if (minutes <= 0) {
            return;
        }

        long interval = Math.max(15, minutes) * 60_000L;
        AlarmManager alarmManager =
                (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }

        alarmManager.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + interval,
                interval,
                pendingIntent(context));
    }

    public static void cancel(Context context) {
        AlarmManager alarmManager =
                (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent(context));
        }
    }

    private static PendingIntent pendingIntent(Context context) {
        Intent intent = new Intent(context, BackupAlarmReceiver.class);
        intent.setAction(ACTION_AUTO_BACKUP);
        return PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static boolean writeNow(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(
                BACKUP_PREFS,
                Context.MODE_PRIVATE);
        String uriText = preferences.getString(DRIVE_URI_KEY, "");
        String json = preferences.getString(BACKUP_KEY, "");
        if (uriText.isEmpty() || json.isEmpty()) {
            return false;
        }

        Uri uri = Uri.parse(uriText);
        try (OutputStream output =
                     context.getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) {
                throw new IOException("Output stream unavailable");
            }
            output.write(json.getBytes(StandardCharsets.UTF_8));
            output.flush();
            preferences.edit()
                    .putLong(LAST_BACKUP_KEY, System.currentTimeMillis())
                    .apply();
            return true;
        } catch (Exception error) {
            return false;
        }
    }
}
