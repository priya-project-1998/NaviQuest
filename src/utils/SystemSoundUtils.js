import { Platform, Vibration, Alert, NativeModules } from 'react-native';

// Enhanced Sound Utility with system sounds support
class SystemSoundUtils {
  constructor() {
    this.canVibrate = true;
    this.alertCount = 0;
    this.lastAlertTime = 0;
    this.testFeatures();
  }

  testFeatures() {
    try {
      // Test vibration support
      Vibration.vibrate(1);
      this.canVibrate = true;
    } catch (error) {
      console.log('Vibration not supported');
      this.canVibrate = false;
    }
  }

  // Play system sound (iOS specific)
  playSystemSound() {
    if (Platform.OS === 'ios') {
      try {
        // Try to use system sound for iOS
        // These are built-in iOS system sounds
        const SystemSoundID = {
          Peek: 1519,
          Pop: 1520,
          Cancelled: 1521,
          TryAgain: 1102,
          Failed: 1107,
          Tock: 1306
        };
        
        // You would need to add native iOS code to use AudioServicesPlaySystemSound
        // For now, we'll use vibration as fallback
        this.playVibratedBeep();
      } catch (error) {
        console.log('System sound not available:', error);
        this.playVibratedBeep();
      }
    } else {
      // Android - use vibration patterns
      this.playVibratedBeep();
    }
  }

  playVibratedBeep() {
    if (!this.canVibrate) return;

    try {
      const now = Date.now();
      
      // Reset count if enough time has passed
      if (now - this.lastAlertTime > 10000) {
        this.alertCount = 0;
      }
      
      this.alertCount++;
      this.lastAlertTime = now;

      // Create different vibration patterns based on urgency
      let pattern;
      
      if (this.alertCount === 1) {
        // First warning: Gentle double beep
        pattern = [0, 100, 100, 100];
      } else if (this.alertCount <= 3) {
        // Moderate warning: Triple beep
        pattern = [0, 120, 80, 120, 80, 120];
      } else if (this.alertCount <= 6) {
        // Urgent warning: Continuous pattern
        pattern = [0, 150, 50, 150, 50, 150, 50, 150];
      } else {
        // Very urgent: Long strong vibrations
        pattern = [0, 250, 100, 250, 100, 250];
      }
      
      Vibration.vibrate(pattern);
    } catch (error) {
      console.log('Error with vibrated beep:', error);
    }
  }

  playSpeedAlert() {
    // Try system sound first, fallback to vibration
    this.playSystemSound();
    
    // Add a strong alert vibration after delay
    setTimeout(() => {
      if (this.canVibrate) {
        try {
          // Urgent speed alert vibration
          let intensity;
          if (this.alertCount <= 2) {
            intensity = 400;
          } else if (this.alertCount <= 5) {
            intensity = 600;
          } else {
            intensity = 800; // Very urgent for persistent speeding
          }
          
          Vibration.vibrate(intensity);
        } catch (error) {
          console.log('Error with speed alert vibration:', error);
        }
      }
    }, 200);

    // For very urgent cases, add a third layer
    if (this.alertCount > 5) {
      setTimeout(() => {
        if (this.canVibrate) {
          Vibration.vibrate([0, 100, 100, 100, 100, 100]);
        }
      }, 1000);
    }
  }

  // Reset when speed comes back to normal
  resetAlertCount() {
    this.alertCount = 0;
    this.lastAlertTime = 0;
    this.stopAll();
  }

  // Stop all vibrations
  stopAll() {
    try {
      Vibration.cancel();
    } catch (error) {
      console.log('Error stopping vibrations:', error);
    }
  }

  // Test function for different alert levels
  testAlertLevels() {
    console.log('Testing alert levels...');
    
    // Test level 1
    this.alertCount = 0;
    this.playSpeedAlert();
    
    setTimeout(() => {
      // Test level 3
      this.alertCount = 2;
      this.playSpeedAlert();
    }, 2000);
    
    setTimeout(() => {
      // Test level 6 (very urgent)
      this.alertCount = 5;
      this.playSpeedAlert();
    }, 4000);
    
    setTimeout(() => {
      this.resetAlertCount();
    }, 8000);
  }

  // No cleanup needed for system sounds
  release() {
    this.stopAll();
    this.resetAlertCount();
  }
}

// Export singleton
export default new SystemSoundUtils();
