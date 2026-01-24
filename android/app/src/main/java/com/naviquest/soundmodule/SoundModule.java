package com.naviquest.soundmodule;

import android.content.Context;
import android.media.MediaPlayer;
import android.media.AudioManager;
import android.net.Uri;
import android.util.Log;
import android.os.Build;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SoundModule extends ReactContextBaseJavaModule {
    private MediaPlayer mediaPlayer;
    private final ReactApplicationContext reactContext;
    
    public SoundModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "SoundModule";
    }

    @ReactMethod
    public void playSound(String soundName, Promise promise) {
        try {
            // Get the resource identifier for the sound file
            Context context = reactContext.getApplicationContext();
            
            Log.d("SoundModule", "=== playSound called ===");
            Log.d("SoundModule", "soundName: " + soundName);
            Log.d("SoundModule", "Package name: " + context.getPackageName());
            
            int resId = context.getResources().getIdentifier(
                    soundName, "raw", context.getPackageName());

            Log.d("SoundModule", "Resource ID lookup result: " + resId);
            
            if (resId == 0) {
                Log.e("SoundModule", "❌ Sound resource NOT found for: " + soundName);
                Log.e("SoundModule", "Available raw resources should include: event_start, checkpoint, event_end, over_speed, time_frame_limit");
                promise.reject("SOUND_NOT_FOUND", "Sound resource not found: " + soundName);
                return;
            }
            
            Log.d("SoundModule", "✅ Found resource ID: " + resId + " for sound: " + soundName);

            // Release any existing media player
            if (mediaPlayer != null) {
                try {
                    mediaPlayer.release();
                    Log.d("SoundModule", "Previous MediaPlayer released");
                } catch (Exception e) {
                    Log.w("SoundModule", "Error releasing previous MediaPlayer: " + e.getMessage());
                }
                mediaPlayer = null;
            }

            // Create and play the new sound with enhanced audio settings
            mediaPlayer = MediaPlayer.create(context, resId);
            if (mediaPlayer == null) {
                Log.e("SoundModule", "❌ Failed to create MediaPlayer for: " + soundName);
                promise.reject("MEDIA_PLAYER_ERROR", "Failed to create MediaPlayer for: " + soundName);
                return;
            }
            
            Log.d("SoundModule", "✅ MediaPlayer created successfully for: " + soundName);
            
            // Set audio attributes for notification sound (better audio focus handling)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(
                        new android.media.AudioAttributes.Builder()
                                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build());
                Log.d("SoundModule", "Audio attributes set");
            }
            
            // Set max volume
            mediaPlayer.setVolume(1.0f, 1.0f);
            Log.d("SoundModule", "Volume set to 1.0");
            
            mediaPlayer.setOnCompletionListener(mp -> {
                Log.d("SoundModule", "✅ Sound playback completed for: " + soundName);
                try {
                    mp.release();
                } catch (Exception e) {
                    Log.w("SoundModule", "Error releasing MediaPlayer on completion: " + e.getMessage());
                }
                mediaPlayer = null;
                promise.resolve("Sound played successfully");
            });
            
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e("SoundModule", "❌ MediaPlayer error - what: " + what + ", extra: " + extra);
                try {
                    mp.release();
                } catch (Exception e) {
                    Log.w("SoundModule", "Error releasing MediaPlayer on error: " + e.getMessage());
                }
                mediaPlayer = null;
                promise.reject("PLAYBACK_ERROR", "Failed to play sound: " + what);
                return true;
            });

            mediaPlayer.start();
            Log.d("SoundModule", "✅ Started playing sound: " + soundName);
            
        } catch (Exception e) {
            Log.e("SoundModule", "❌ Exception in playSound: " + e.getMessage(), e);
            e.printStackTrace();
            promise.reject("SOUND_ERROR", "Error playing sound: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void stopSound(Promise promise) {
        // If there's no active mediaPlayer, just resolve immediately
        if (mediaPlayer == null) {
            Log.d("SoundModule", "No active MediaPlayer to stop");
            promise.resolve("No active sound to stop");
            return;
        }
        
        try {
            boolean wasPlaying = false;
            try {
                // Check if it was playing (might throw in some states)
                wasPlaying = mediaPlayer.isPlaying();
                if (wasPlaying) {
                    mediaPlayer.stop();
                    Log.d("SoundModule", "MediaPlayer stopped successfully");
                }
            } catch (IllegalStateException e) {
                // MediaPlayer might be in an invalid state, just log and continue
                Log.w("SoundModule", "MediaPlayer was in an invalid state when checking isPlaying: " + e.getMessage());
                // Don't rethrow, continue with cleanup
            }
            
            try {
                mediaPlayer.release();
                Log.d("SoundModule", "MediaPlayer released successfully");
            } catch (Exception e) {
                // If release fails, just log and continue
                Log.w("SoundModule", "Error releasing MediaPlayer: " + e.getMessage());
                // Don't rethrow, continue with cleanup
            }
            
            // Always nullify the reference
            mediaPlayer = null;
            Log.d("SoundModule", "Sound resources released successfully");
            
            // Always resolve the promise even if there were non-fatal errors
            promise.resolve(wasPlaying ? "Sound stopped and resources released" : "Sound resources released");
            
        } catch (Exception e) {
            // This is a safety catch for any unexpected errors
            // Log error but STILL RESOLVE the promise to avoid unhandled rejections in JS
            Log.e("SoundModule", "Unexpected error in stopSound: " + e.getMessage(), e);
            promise.resolve("Handled unexpected error in stopSound: " + e.getMessage());
        }
    }
    
    @ReactMethod
    public void setVolume(float volume, Promise promise) {
        try {
            if (mediaPlayer != null) {
                // Ensure volume is between 0.0 and 1.0
                float safeVolume = Math.max(0.0f, Math.min(1.0f, volume));
                mediaPlayer.setVolume(safeVolume, safeVolume);
                Log.d("SoundModule", "Volume set to: " + safeVolume);
                promise.resolve("Volume set successfully");
            } else {
                Log.w("SoundModule", "No active media player to set volume");
                promise.resolve("No active media player to set volume");
            }
        } catch (Exception e) {
            Log.e("SoundModule", "Error setting volume: " + e.getMessage(), e);
            promise.resolve("Error setting volume - resolved safely: " + e.getMessage());
        }
    }
}
