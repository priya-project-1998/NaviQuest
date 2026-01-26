import { Platform, NativeModules } from 'react-native';

// Enhanced Voice Alert Utility with sound for Android and iOS
// Using native sound module for both platforms
class EnhancedVoiceAlertUtils {
  constructor() {
    // Initialize sound objects
    this.sounds = {};
    this.isAndroid = Platform.OS === 'android';
    this.isIOS = Platform.OS === 'ios';
    this.isMobile = this.isAndroid || this.isIOS;
    
    // Define the event types
    this.eventTypes = {
      EVENT_START: 'event_start',
      CHECKPOINT: 'checkpoint',
      EVENT_END: 'event_end',
      OVER_SPEED: 'over_speed',
      TIME_FRAME_LIMIT: 'time_frame_limit'
    };
    
    // Initialize sound module for both Android and iOS
    if (this.isMobile) {
      console.log(`EnhancedVoiceAlertUtils initialized on ${Platform.OS} - using native sound module`);
      
      // Check if SoundModule is available
      if (NativeModules.SoundModule) {
        console.log('SoundModule is available');
      } else {
        console.warn('SoundModule is NOT available - voice alerts will not work');
      }
    }
  }
  
  // Play alert with sound for Android and iOS
  playAlert(eventType) {
    // Only play on mobile platforms (Android and iOS)
    if (!this.isMobile) return;
    
    console.log('PlayAlert called with eventType:', eventType, 'on platform:', Platform.OS);
    
    // Check if SoundModule is available
    if (!NativeModules.SoundModule) {
      console.warn('SoundModule not available - cannot play sound');
      return;
    }
        
    // Safe wrapper function that never throws or rejects
    const safePlay = async (soundName) => {
      try {
        console.log('Attempting to play sound:', soundName);
        console.log('Calling NativeModules.SoundModule.playSound with:', soundName);
        
        try {
          const result = await NativeModules.SoundModule.playSound(soundName);
          console.log('Sound played successfully:', soundName, result);
        } catch (playError) {
          // Just log errors but don't propagate them
          console.error(`Error playing sound ${soundName}:`, playError);
        }
      } catch (error) {
        // This should never happen, but just in case
        console.error(`Safely handled error in playAlert sequence:`, error);
      }
    };
    
    // Sound names must match the file names in android/app/src/main/res/raw/ (without .mp3 extension)
    // Map event types to exact sound file names
    const soundNameMap = {
      'event_start': 'event_start',
      'checkpoint': 'checkpoint',
      'event_end': 'event_end',
      'over_speed': 'over_speed',
      'time_frame_limit': 'time_frame_limit'
    };
    
    const soundName = soundNameMap[eventType.toLowerCase()] || eventType.toLowerCase();
    console.log('Mapped eventType:', eventType, 'to soundName:', soundName);
    safePlay(soundName);
  }
  
  // Event start notification
  notifyEventStart() {
    if (this.isMobile) {
      this.playAlert(this.eventTypes.EVENT_START);
    }
  }
  
  // Checkpoint reached notification
  notifyCheckpoint() {
    if (this.isMobile) {
      this.playAlert(this.eventTypes.CHECKPOINT);
    }
  }
  
  // Event end notification
  notifyEventEnd() {
    if (this.isMobile) {
      this.playAlert(this.eventTypes.EVENT_END);
    }
  }
  
  // Over speed notification
  notifyOverSpeed() {
    if (this.isMobile) {
      this.playAlert(this.eventTypes.OVER_SPEED);
    }
  }
  
  // Time frame limit notification
  notifyTimeFrameLimit() {
    if (this.isMobile) {
      this.playAlert(this.eventTypes.TIME_FRAME_LIMIT);
    }
  }
  
  // Release resources when app is closing or component unmounts
  release() {
    // Return a promise for proper chaining
    return new Promise((resolve) => {
      if (!this.isMobile) {
        // Resolve immediately on non-mobile platforms
        resolve("Not on mobile platform");
        return;
      }
      
      // Stop any sound playback
      if (!NativeModules.SoundModule) {
        // No sound module available
        resolve("SoundModule not available");
        return;
      }
      
      // Safe wrapper for stopSound that never rejects
      const safeStopSound = () => {
        // Create a timeout to ensure we always resolve
        const timeoutId = setTimeout(() => {
          resolve("Timeout - resolved anyway");
        }, 1000); // 1 second timeout
        
        try {
          // Call stopSound and handle the Promise safely
          NativeModules.SoundModule.stopSound()
            .then(result => {
              clearTimeout(timeoutId);
              resolve(result);
            })
            .catch(() => {
              // This should never happen now with our improved native module
              clearTimeout(timeoutId);
              resolve("Handled stopSound rejection");
            });
        } catch (err) {
          // Handle any synchronous errors
          clearTimeout(timeoutId);
          resolve("Handled stopSound exception");
        }
      };
      
      // Call our safe wrapper
      safeStopSound();
    });
  }
  
  // Force stop any ongoing sound playback
  forceStop() {
    if (!this.isMobile) return Promise.resolve("Not on mobile platform");
    return this.release();
  }
  
  // Stop speaking (alias for release)
  stopSpeaking() {
    if (!this.isMobile) return Promise.resolve("Not on mobile platform");
    return this.release();
  }
  
  // Set volume level (0.0 - 1.0)
  setVolume(volume = 1.0) {
    return new Promise((resolve) => {
      if (!this.isMobile) {
        resolve("Not on mobile platform");
        return;
      }
      
      if (!NativeModules.SoundModule) {
        resolve("SoundModule not available");
        return;
      }
      
      // Safe wrapper for setVolume that never rejects
      const safeSetVolume = () => {
        // Create a timeout to ensure we always resolve
        const timeoutId = setTimeout(() => {
          resolve("Timeout - resolved anyway");
        }, 1000); // 1 second timeout
        
        try {
          // Ensure volume is between 0.0 and 1.0
          const safeVolume = Math.max(0.0, Math.min(1.0, volume));
          NativeModules.SoundModule.setVolume(safeVolume)
            .then((result) => {
              clearTimeout(timeoutId);
              resolve(result);
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              resolve("Handled setVolume rejection");
            });
        } catch (err) {
          clearTimeout(timeoutId);
          resolve("Handled setVolume exception");
        }
      };
      
      safeSetVolume();
    });
  }
  
  // Compatibility methods with existing voice utils
  announceEventStart() {
    this.notifyEventStart();
  }
  
  announceEventFinish() {
    this.notifyEventEnd();
  }
  
  announceEventAborted() {
    this.notifyEventEnd();
  }
  
  announceCheckpointComplete() {
    this.notifyCheckpoint();
  }
  
  announceOverspeed() {
    this.notifyOverSpeed();
  }
  
  announceTimeWarning() {
    this.notifyTimeFrameLimit();
  }
  
  testAllAlerts() {
    if (!this.isMobile) return;
    setTimeout(() => this.notifyEventStart(), 0);
    setTimeout(() => this.notifyCheckpoint(), 2000);
    setTimeout(() => this.notifyOverSpeed(), 4000);
    setTimeout(() => this.notifyTimeFrameLimit(), 6000);
    setTimeout(() => this.notifyEventEnd(), 8000);
  }
  
  // Alias for release method to match the function call in MapScreen.js
  cleanup() {
    return this.release()
      .then(result => {
        return result;
      })
      .catch(() => {
        return "Safely handled cleanup error";
      });
  }
}

export default new EnhancedVoiceAlertUtils();
