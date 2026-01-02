import { Platform, Vibration, Alert } from 'react-native';

class SoundUtils {
  constructor() {
    this.canVibrate = true;
    this.alertCount = 0;
    this.lastAlertTime = 0;
    this.testVibration();
  }

  testVibration() {
    try {
      // Test if vibration is supported
      Vibration.vibrate(1);
      this.canVibrate = true;
    } catch (error) {
      console.log('Vibration not supported on this device');
      this.canVibrate = false;
    }
  }

  playBeepSound() {
    // Since react-native-sound was causing build issues, 
    // we'll use vibration patterns to simulate beep sounds
    this.playSystemBeep();
  }

  playSystemBeep() {
    if (!this.canVibrate) return;
    
    try {
      // Create multiple beep-like patterns
      const now = Date.now();
      
      // Different patterns based on how many times we've alerted recently
      if (now - this.lastAlertTime > 5000) {
        this.alertCount = 0; // Reset count after 5 seconds
      }
      
      this.alertCount++;
      this.lastAlertTime = now;
      
      let pattern;
      if (this.alertCount === 1) {
        // First alert: gentle double beep
        pattern = [0, 120, 80, 120];
      } else if (this.alertCount <= 3) {
        // Subsequent alerts: more urgent
        pattern = [0, 150, 100, 150, 100, 150];
      } else {
        // Continuous speeding: very urgent pattern
        pattern = [0, 200, 50, 200, 50, 200, 50, 200];
      }
      
      Vibration.vibrate(pattern);
    } catch (error) {
      console.log('Error with system beep:', error);
    }
  }

  vibrate() {
    if (!this.canVibrate) return;
    
    try {
      // Strong vibration that varies based on alert frequency
      const now = Date.now();
      let duration;
      
      if (this.alertCount <= 2) {
        duration = 400; // Moderate vibration
      } else {
        duration = 600; // Stronger vibration for persistent speeding
      }
      
      Vibration.vibrate(duration);
    } catch (error) {
      console.log('Error vibrating device:', error);
    }
  }

  playSpeedAlert() {
    // Play beep sound (now using vibration patterns)
    this.playBeepSound();
    
    // Add vibration after a slight delay for layered effect
    setTimeout(() => {
      this.vibrate();
    }, 100);
    
    // Additional urgent vibration for repeated violations
    if (this.alertCount > 3) {
      setTimeout(() => {
        if (this.canVibrate) {
          Vibration.vibrate([0, 100, 100, 100]);
        }
      }, 800);
    }
  }

  // Method to reset alert count (call when speed comes back under limit)
  resetAlertCount() {
    this.alertCount = 0;
    this.lastAlertTime = 0;
  }

  // Stop all ongoing vibrations
  stopAll() {
    try {
      Vibration.cancel();
    } catch (error) {
      console.log('Error stopping vibration:', error);
    }
  }

  // Cleanup method
  release() {
    this.stopAll();
    this.resetAlertCount();
  }
}

// Export a singleton instance
export default new SoundUtils();
