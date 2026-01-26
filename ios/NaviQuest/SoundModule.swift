import Foundation
import AVFoundation
import React

@objc(SoundModule)
class SoundModule: NSObject {
  
  private var audioPlayer: AVAudioPlayer?
  private var currentPromiseResolve: RCTPromiseResolveBlock?
  private var currentPromiseReject: RCTPromiseRejectBlock?
  
  override init() {
    super.init()
    // Configure audio session for playback
    #if os(iOS)
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers, .duckOthers])
      try AVAudioSession.sharedInstance().setActive(true)
      print("SoundModule: Audio session configured successfully")
    } catch {
      print("SoundModule: Failed to configure audio session: \(error.localizedDescription)")
    }
    #endif
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func playSound(_ soundName: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("SoundModule: === playSound called ===")
    print("SoundModule: soundName: \(soundName)")
    
    // Stop any currently playing sound
    if audioPlayer != nil {
      audioPlayer?.stop()
      audioPlayer = nil
      print("SoundModule: Previous audio player stopped")
    }
    
    // Store promise callbacks
    currentPromiseResolve = resolve
    currentPromiseReject = reject
    
    // Try to find the sound file in the bundle
    // First try main bundle
    var soundURL: URL?
    
    // Try to find the mp3 file in the main bundle
    if let url = Bundle.main.url(forResource: soundName, withExtension: "mp3") {
      soundURL = url
      print("SoundModule: ✅ Found sound in main bundle: \(url.path)")
    } else if let url = Bundle.main.url(forResource: soundName, withExtension: "wav") {
      soundURL = url
      print("SoundModule: ✅ Found sound in main bundle (wav): \(url.path)")
    } else if let url = Bundle.main.url(forResource: soundName, withExtension: "m4a") {
      soundURL = url
      print("SoundModule: ✅ Found sound in main bundle (m4a): \(url.path)")
    }
    
    // If not found, try searching in Sounds folder
    if soundURL == nil {
      if let url = Bundle.main.url(forResource: soundName, withExtension: "mp3", subdirectory: "Sounds") {
        soundURL = url
        print("SoundModule: ✅ Found sound in Sounds folder: \(url.path)")
      }
    }
    
    guard let url = soundURL else {
      print("SoundModule: ❌ Sound resource NOT found for: \(soundName)")
      print("SoundModule: Available sounds should include: event_start, checkpoint, event_end, over_speed, time_frame_limit")
      let error = NSError(domain: "SoundModule", code: 404, userInfo: [NSLocalizedDescriptionKey: "Sound resource not found: \(soundName)"])
      reject("SOUND_NOT_FOUND", "Sound resource not found: \(soundName)", error)
      return
    }
    
    do {
      // Ensure audio session is active on iOS
      #if os(iOS)
      try AVAudioSession.sharedInstance().setActive(true)
      #endif
      
      audioPlayer = try AVAudioPlayer(contentsOf: url)
      audioPlayer?.delegate = self
      audioPlayer?.volume = 1.0
      audioPlayer?.prepareToPlay()
      
      if audioPlayer?.play() == true {
        print("SoundModule: ✅ Started playing sound: \(soundName)")
      } else {
        print("SoundModule: ❌ Failed to start playback for: \(soundName)")
        let error = NSError(domain: "SoundModule", code: 500, userInfo: [NSLocalizedDescriptionKey: "Failed to start playback"])
        reject("PLAYBACK_ERROR", "Failed to start playback for: \(soundName)", error)
      }
    } catch {
      print("SoundModule: ❌ Exception creating audio player: \(error.localizedDescription)")
      reject("SOUND_ERROR", "Error playing sound: \(error.localizedDescription)", error)
    }
  }
  
  @objc
  func stopSound(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("SoundModule: stopSound called")
    
    if audioPlayer == nil {
      print("SoundModule: No active audio player to stop")
      resolve("No active sound to stop")
      return
    }
    
    audioPlayer?.stop()
    audioPlayer = nil
    currentPromiseResolve = nil
    currentPromiseReject = nil
    print("SoundModule: Audio player stopped successfully")
    resolve("Sound stopped successfully")
  }
  
  @objc
  func setVolume(_ volume: Float, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("SoundModule: setVolume called with volume: \(volume)")
    
    let safeVolume = max(0.0, min(1.0, volume))
    audioPlayer?.volume = safeVolume
    resolve("Volume set to \(safeVolume)")
  }
}

// MARK: - AVAudioPlayerDelegate
extension SoundModule: AVAudioPlayerDelegate {
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    print("SoundModule: ✅ Sound playback completed, success: \(flag)")
    
    if let resolve = currentPromiseResolve {
      resolve("Sound played successfully")
    }
    
    currentPromiseResolve = nil
    currentPromiseReject = nil
    audioPlayer = nil
  }
  
  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    print("SoundModule: ❌ Audio player decode error: \(error?.localizedDescription ?? "Unknown error")")
    
    if let reject = currentPromiseReject {
      let nsError = error as NSError? ?? NSError(domain: "SoundModule", code: 500, userInfo: [NSLocalizedDescriptionKey: "Audio decode error"])
      reject("DECODE_ERROR", "Audio decode error: \(error?.localizedDescription ?? "Unknown")", nsError)
    }
    
    currentPromiseResolve = nil
    currentPromiseReject = nil
    audioPlayer = nil
  }
}
