import { Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';

// Enhanced sound utility using expo-av for better cross-platform sound support
class EnhancedSoundUtils {
  constructor() {
    this.sound = null;
    this.isInitialized = false;
    this.canVibrate = true;
    this.initializeAudio();
  }

  async initializeAudio() {
    try {
      // Set audio mode for iOS
      if (Platform.OS === 'ios') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          playThroughEarpieceAndroid: false
        });
      }

      // Create a simple beep sound using a data URI (base64 encoded short beep)
      // This is a very short beep sound in base64 format
      const beepDataUri = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDeF1fLNeSsPJHDC7OKYSgs2kdj33pt/L';
      
      this.isInitialized = true;
      console.log('Enhanced audio initialized successfully');
    } catch (error) {
      console.log('Error initializing enhanced audio:', error);
      this.isInitialized = false;
    }
  }

  async playBeepSound() {
    try {
      if (this.isInitialized) {
        // Play a simple system sound as fallback
        // For now, we'll use vibration patterns to simulate beep
        this.playBeepVibration();
      } else {
        this.playBeepVibration();
      }
    } catch (error) {
      console.log('Error playing beep sound:', error);
      this.playBeepVibration();
    }
  }

  playBeepVibration() {
    try {
      // Create a beep-like vibration pattern
      // Two quick pulses like "beep-beep"
      const beepPattern = [0, 100, 50, 100];
      Vibration.vibrate(beepPattern);
    } catch (error) {
      console.log('Error with beep vibration:', error);
    }
  }

  vibrate() {
    try {
      // Strong alert vibration
      Vibration.vibrate(400);
    } catch (error) {
      console.log('Error vibrating device:', error);
    }
  }

  async playSpeedAlert() {
    // Play beep sound
    await this.playBeepSound();
    
    // Add a strong vibration after a short delay
    setTimeout(() => {
      this.vibrate();
    }, 150);
  }

  // Cleanup method
  async release() {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
      // Cancel any ongoing vibrations
      Vibration.cancel();
    } catch (error) {
      console.log('Error releasing enhanced sound resources:', error);
    }
  }
}

// Export a singleton instance
export default new EnhancedSoundUtils();
