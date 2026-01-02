import { Platform, Vibration } from 'react-native';

// Alternative sound utility that uses only vibration patterns for cross-platform compatibility
class VibrationSoundUtils {
  constructor() {
    this.canVibrate = true;
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

  // Create different vibration patterns for different sounds
  playBeepPattern() {
    if (!this.canVibrate) return;
    
    try {
      // Beep pattern: short-pause-short (like "beep-beep")
      const beepPattern = [0, 150, 80, 150];
      Vibration.vibrate(beepPattern);
    } catch (error) {
      console.log('Error with beep pattern:', error);
    }
  }

  playAlertPattern() {
    if (!this.canVibrate) return;
    
    try {
      // Alert pattern: long-short-long (more urgent)
      const alertPattern = [0, 300, 100, 200, 100, 300];
      Vibration.vibrate(alertPattern);
    } catch (error) {
      console.log('Error with alert pattern:', error);
    }
  }

  playWarningPattern() {
    if (!this.canVibrate) return;
    
    try {
      // Warning pattern: continuous pulses
      const warningPattern = [0, 200, 100, 200, 100, 200];
      Vibration.vibrate(warningPattern);
    } catch (error) {
      console.log('Error with warning pattern:', error);
    }
  }

  playSpeedAlert() {
    // Use the alert pattern for speed violations
    this.playAlertPattern();
  }

  // Stop any ongoing vibration
  stopAll() {
    try {
      Vibration.cancel();
    } catch (error) {
      console.log('Error stopping vibration:', error);
    }
  }

  // No cleanup needed for vibration-only utils
  release() {
    this.stopAll();
  }
}

// Export a singleton instance
export default new VibrationSoundUtils();
