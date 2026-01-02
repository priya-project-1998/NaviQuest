import React, { useRef, useState, useEffect,useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  PermissionsAndroid,
  Platform,
  Alert,
  Modal,
  ScrollView,
  BackHandler,
  ActivityIndicator,
  ToastAndroid,
  TextInput,
  Linking,
  Vibration,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import KeepAwake from 'react-native-keep-awake';
import {
  createTables,
  saveCheckpoint,
  getPendingCheckpoints,
  markSynced,
  getCheckpointById,
  getCompletedCheckpointsForEvent, // <-- import the new function
} from "../services/dbService";
import SoundUtils from '../utils/SoundUtils';
import VibrationSoundUtils from '../utils/VibrationSoundUtils';
import SystemSoundUtils from '../utils/SystemSoundUtils';
import EnhancedVoiceAlertUtils from '../utils/EnhancedVoiceAlertUtils';

const { width, height } = Dimensions.get("window");
const MapScreen = ({ route, navigation }) => {
  const mapRef = useRef(null);
  const [lastUserLocation, setLastUserLocation] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [mapType, setMapType] = useState("standard"); // For Center Map dropdown
  const [layerDropdownVisible, setLayerDropdownVisible] = useState(false);
  const [actionDropdownVisible, setActionDropdownVisible] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // Will be calculated from event dates
  const [totalEventDuration, setTotalEventDuration] = useState(0); // Total duration in seconds
  const [remainingSeconds, setRemainingSeconds] = useState(0); // Countdown timer for event duration
  const [fifteenMinuteWarningGiven, setFifteenMinuteWarningGiven] = useState(false); // Track 15-min warning
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [userRoute, setUserRoute] = useState([]); // Track user route - real user movement path
  const [checkpointStatus, setCheckpointStatus] = useState({}); // { checkpoint_id: { time, completed } }
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(null); // For testing button
  const [eventCompletedModal, setEventCompletedModal] = useState(false);
  const [loadingCheckpointId, setLoadingCheckpointId] = useState(null); // For loader on marker
  const [userHeading, setUserHeading] = useState(0); // Track user direction for car rotation - starts north
  const [markerColors, setMarkerColors] = useState({}); // checkpoint_id: color
  const [timeStampDropdownVisible, setTimeStampDropdownVisible] = useState(false); // Dropdown for Time Stamp
  const [showCurrentLocationMarker, setShowCurrentLocationMarker] = useState(false);
  const [currentLocationMarkerCoords, setCurrentLocationMarkerCoords] = useState(null);
  const currentLocationTimeoutRef = useRef(null);
  const [shouldCenterOnUser, setShouldCenterOnUser] = useState(false); // Flag to center map on user
  const [abortPasswordModal, setAbortPasswordModal] = useState(false);
  const [abortPassword, setAbortPassword] = useState("");
  const [isFollowingUser, setIsFollowingUser] = useState(false); // Track if following user location
  const isFollowingUserRef = useRef(false); // ✅ Ref to track following state immediately in callbacks
  const [watchId, setWatchId] = useState(null); // Store watch position ID
  const [userCurrentRegion, setUserCurrentRegion] = useState(null); // Track current map region
  const [hasInitialZoom, setHasInitialZoom] = useState(false); // Track if initial zoom done
  const isProgrammaticMove = useRef(false); // ✅ Flag to distinguish app animations from user gestures
  const [speedLimit, setSpeedLimit] = useState(60); // Default speed limit
  const [isOverspeedAlertShown, setIsOverspeedAlertShown] = useState(false);
  const [overspeedCount, setOverspeedCount] = useState(0);
  const overspeedCountRef = useRef(0); // ✅ Ref to track latest overspeedCount value
  const [lastOverspeedAlert, setLastOverspeedAlert] = useState(0);
  const [abortLoading, setAbortLoading] = useState(false);
  const [randomAbortCode, setRandomAbortCode] = useState("");
  const [enteredAbortCode, setEnteredAbortCode] = useState("");
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [eventStartAnnounced, setEventStartAnnounced] = useState(false);
  const [lastOverspeedVoiceAlert, setLastOverspeedVoiceAlert] = useState(0);
  const [timeWarningGiven, setTimeWarningGiven] = useState(false);
  const [eventEndTime, setEventEndTime] = useState(null);
  const [useSimpleVoiceAlerts, setUseSimpleVoiceAlerts] = useState(true); // Default to simple alerts
  const [okayTimeout, setOkayTimeout] = useState(30); // 30 second countdown for "Okay" button
  const [startTimeAdded, setStartTimeAdded] = useState(false); // ✅ new state

  const { checkpoints: paramCheckpoints, category_id, event_id, kml_path, color, event_organizer_no, speed_limit, event_start_date, event_end_date,duration } = route.params || {};
  const checkpoints = Array.isArray(paramCheckpoints) ? paramCheckpoints : [];
  
  const eventStartTimeRef = useRef(null);
  const syncingCheckpointsRef = useRef(new Set());
  const eventEndTimestamp = useRef(null); // ✅ Store end timestamp for timer calculation

  // ✅ Helper function to get the appropriate voice alert utility
  const getVoiceAlertUtils = () => {
    return EnhancedVoiceAlertUtils; // Use enhanced TTS voice alerts
  };
 
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success"); // success, error, info, warning

  // ✅ Get toast icon and color based on type
  const getToastIcon = (type) => {
    switch(type) {
      case "success": return "✓";
      case "error": return "✗";
      case "warning": return "⚠";
      case "info": return "ℹ";
      default: return "✓";
    }
  };

  const getToastColor = (type) => {
    switch(type) {
      case "success": return "#4CAF50";
      case "error": return "#F44336";
      case "warning": return "#FF9800";
      case "info": return "#2196F3";
      default: return "#4CAF50";
    }
  };

  // ✅ Show Center Toast Function with Duration
  const showCenterToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // Set duration based on type
    const duration = type === "success" ? 10000 : 5000; // success: 10sec, others: 5sec
    
    setTimeout(() => {
      setShowToast(false);
    }, duration);
  };

  useEffect(() => {
    if (!eventStartTimeRef.current) {
      eventStartTimeRef.current = new Date();
    }
  }, []);

  const addStartCheckpointTime = () => {
  try {
    if (!eventStartTimeRef.current) return;

    const now = new Date();
    const timeTakenSec = Math.floor((now - eventStartTimeRef.current) / 1000);

    if (timeTakenSec > 0) {
      // ✅ Extend end timestamp instead of modifying state
      if (eventEndTimestamp.current) {
        eventEndTimestamp.current = eventEndTimestamp.current + (timeTakenSec * 1000);
      }
      console.log(`✅ START checkpoint time added: ${timeTakenSec} seconds`);
      console.log(`⏳ End timestamp extended by: ${timeTakenSec} seconds`);
      setStartTimeAdded(true); // ✅ flag ON once start time added

    }

  } catch (e) {
    console.log("Error adding START time:", e);
  }
};


  // ✅ Initialize countdown timer from duration parameter
  useEffect(() => {
    if (duration) {
      // Parse duration string (e.g., "3:00:00" or "2:30:45") to seconds
      const parseDurationToSeconds = (durationStr) => {
        if (!durationStr) return 0;
        const parts = durationStr.split(':');
        if (parts.length === 3) {
          const hours = parseInt(parts[0]) || 0;
          const minutes = parseInt(parts[1]) || 0;
          const seconds = parseInt(parts[2]) || 0;
          return (hours * 3600) + (minutes * 60) + seconds;
        }
        return 0;
      };
      
      const totalSeconds = parseDurationToSeconds(duration);
      setTotalEventDuration(totalSeconds);
      
      // ✅ Set end timestamp = current time + duration
      const now = Date.now();
      eventEndTimestamp.current = now + (totalSeconds * 1000);
      
      // ✅ Set initial remaining seconds
      setRemainingSeconds(totalSeconds);
    }
  }, [duration]);

  // ✅ Table create
  // ✅ Keep screen always awake while on MapScreen
  useEffect(() => {
    KeepAwake.activate();
    return () => {
      KeepAwake.deactivate();
    };
  }, []);

  useEffect(() => {
    createTables();
  }, []);

  // ✅ Load previously completed checkpoints from database
  useEffect(() => {
    if (event_id) {
      getCompletedCheckpointsForEvent(event_id, (completedCheckpoints) => {
        const previousCheckpointStatus = {};
        completedCheckpoints.forEach((checkpoint) => {
          previousCheckpointStatus[checkpoint.checkpoint_id] = {
            time: checkpoint.time_stamp,
            completed: true
          };
        });
        
        if (Object.keys(previousCheckpointStatus).length > 0) {
          setCheckpointStatus(previousCheckpointStatus);
        }
      });
    }
  }, [event_id]);

  // ✅ Voice Alert: Event Start Announcement
  useEffect(() => {
    if (!eventStartAnnounced && voiceAlertsEnabled) {
      // Delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        getVoiceAlertUtils().announceEventStart(route.params?.event_name || 'Navigation Event');
        setEventStartAnnounced(true);
      }, 2000); // 2 second delay for smooth start

      return () => clearTimeout(timer);
    }
  }, [eventStartAnnounced, voiceAlertsEnabled]);

  // ✅ Set event end time for time warning alerts
  useEffect(() => {
    if (event_end_date && !eventEndTime) {
      try {
        const endTime = new Date(event_end_date);
        setEventEndTime(endTime);
      } catch (error) {
        console.log('Error parsing event end date:', error);
      }
    }
  }, [event_end_date, eventEndTime]);

  // ✅ Time Warning Alert - 15 minutes before event end
  useEffect(() => {
    if (eventEndTime && voiceAlertsEnabled && !timeWarningGiven) {
      const checkTimeWarning = () => {
        const now = new Date();
        const timeDiff = eventEndTime.getTime() - now.getTime();
        const minutesRemaining = Math.floor(timeDiff / (1000 * 60));
        
        // Alert when 15 minutes remaining (with 1 minute tolerance)
        if (minutesRemaining <= 15 && minutesRemaining > 0 && !timeWarningGiven) {
          getVoiceAlertUtils().announceTimeWarning(minutesRemaining);
          setTimeWarningGiven(true);
        }
      };

      // Check every minute
      const timeInterval = setInterval(checkTimeWarning, 60000);
      
      // Initial check
      checkTimeWarning();

      return () => clearInterval(timeInterval);
    }
  }, [eventEndTime, voiceAlertsEnabled, timeWarningGiven]);

  useEffect(() => {
  if (speed_limit && speed_limit !== speedLimit) {
    setSpeedLimit(speed_limit);
    //showCenterToast(`Speed limit set to ${speed_limit} km/h for this event.`);
  }
}, [speed_limit]);

 
// ✅ Internet change listener → sync pending checkpoints
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      console.log('🔄 Internet connected - checking for pending checkpoints...');
      await syncPendingCheckpoints();
    }
  });

  return () => unsubscribe();
}, []); // ✅ Remove overspeedCount dependency since we're using ref

// ✅ Function to sync all pending checkpoints
const syncPendingCheckpoints = async () => {
  try {
    let pending = await getPendingCheckpoints();
    // Ensure pending is always an array
    if (!Array.isArray(pending)) pending = [];

    if (pending.length === 0) {
      console.log('✅ No pending checkpoints to sync');
      return;
    }

    console.log(`🔄 Found ${pending.length} pending checkpoint(s) to sync`);

    // Get token from AsyncStorage
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.log('❌ No auth token found - cannot sync');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let item of pending) {
      try {
        console.log(`🔄 Syncing checkpoint: ${item.checkpoint_id} for event: ${item.event_id}`);
        
        const requestBody = {
          event_id: item.event_id,
          checkpoint_id: item.checkpoint_id,
          over_speed: item.over_speed || 0 // Use stored overspeed or 0
        };

        const res = await fetch(
          "https://rajasthanmotorsports.com/api/events/checkpoints/update",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`, // ✅ Pass token here
            },
            body: JSON.stringify(requestBody),
          }
        );

        let data = {};
        try {
          data = await res.json();
        } catch (jsonErr) {
          console.log("❌ JSON parse error:", jsonErr);
        }
        
        if (data && data.status === "success") {
          // ✅ Mark as synced using checkpoint_id and event_id for reliability
          markSynced(item.id, item.event_id, item.checkpoint_id);
          console.log(`✅ Successfully synced checkpoint: ${item.checkpoint_id}`);
          
          // ✅ Update marker color if it's the current event
          if (item.event_id === event_id) {
            setMarkerColors((prev) => ({ ...prev, [item.checkpoint_id]: '#185a9d' })); // blue for synced
          }
          
          successCount++;
        } else {
          console.log(`❌ Server rejected sync for checkpoint: ${item.checkpoint_id}`, data.message || 'Unknown error');
          failCount++;
        }
      } catch (err) {
        console.log("❌ Sync failed for checkpoint:", item.checkpoint_id, err);
        failCount++;
      }
    }

    // ✅ Show summary toast if any syncs occurred
    if (successCount > 0) {
      showCenterToast(`✅ Synced ${successCount} pending checkpoint(s)`, 'success');
    }
    if (failCount > 0) {
      showCenterToast(`⚠️ Failed to sync ${failCount} checkpoint(s)`, 'warning');
    }
  } catch (err) {
    console.error('❌ Error in syncPendingCheckpoints:', err);
  }
};



  // ✅ Simple Speed Limit Checking Function
  const checkSpeedLimit = useCallback((currentSpeedKmh) => {
    const now = Date.now();
    
    // ✅ Immediate alert response - no delay
    if (currentSpeedKmh > speedLimit) {
      setOverspeedCount(prev => {
        const newCount = prev + 1;
        overspeedCountRef.current = newCount; // ✅ Update ref
        return newCount;
      });
      
      // ✅ Show alert immediately when overspeeding (removed delay condition)
      if (!isOverspeedAlertShown) {
        setIsOverspeedAlertShown(true);
        setLastOverspeedAlert(now);
        
        // ✅ Voice Alert for Overspeed (immediate response)
        if (voiceAlertsEnabled && (lastOverspeedVoiceAlert === 0 || now - lastOverspeedVoiceAlert > 5000)) {
          getVoiceAlertUtils().announceOverspeed(currentSpeedKmh, speedLimit);
          setLastOverspeedVoiceAlert(now);
        }
      }
        
      // ✅ Play sound and vibration whenever speed limit is exceeded
      try {
        // Layer 1: Advanced sound (if available)
        SoundUtils.playSpeedAlert();
        
        // Layer 2: Vibration patterns (backup/enhancement) 
        setTimeout(() => {
          VibrationSoundUtils.playSpeedAlert();
        }, 150);
        
        // Layer 3: System sounds with escalating urgency
        setTimeout(() => {
          SystemSoundUtils.playSpeedAlert();
        }, 300);
        
      } catch (error) {
        try {
          Vibration.vibrate([0, 400, 150, 400, 150, 400]); // Strong urgent pattern
        } catch (vibError) {
          console.log('Error with vibration:', vibError);
        }
      }
    } else {
      // ✅ Immediately reset overspeed alert when speed is back under limit
      if (isOverspeedAlertShown) {
        setIsOverspeedAlertShown(false);
        setLastOverspeedAlert(0);
        
        // ✅ Reset voice alert timer immediately when speed normalizes - fresh start for next overspeed
        setLastOverspeedVoiceAlert(0);
        
        // ✅ Stop any ongoing voice alerts immediately when speed comes under limit
        try {
          // Stop voice alerts if any TTS is speaking
          const voiceUtils = getVoiceAlertUtils();
          if (voiceUtils && typeof voiceUtils.forceStop === 'function') {
            voiceUtils.forceStop(); // ✅ Force stop immediately
          }
          if (voiceUtils && typeof voiceUtils.stopSpeaking === 'function') {
            voiceUtils.stopSpeaking(); // Stop current voice alert
          }
          // Also try to stop with common TTS method names
          if (voiceUtils && typeof voiceUtils.stop === 'function') {
            voiceUtils.stop();
          }
        } catch (error) {
          console.log('Error stopping voice alerts:', error);
        }
        
        // ✅ Reset sound alert count and stop any ongoing sounds/vibrations when speed normalizes
        try {
          SoundUtils.resetAlertCount();
          VibrationSoundUtils.release(); // Stop any ongoing vibrations
          SystemSoundUtils.resetAlertCount(); // Reset system sound alerts
        } catch (error) {
          console.log('Error resetting alert systems:', error);
        }
      }
    }
  }, [speedLimit, lastOverspeedAlert, isOverspeedAlertShown, voiceAlertsEnabled, lastOverspeedVoiceAlert]); // ✅ Remove overspeedCount dependency since we're using ref

  // ✅ Permission aur location fetch
  const getCurrentLocation = () => {
    const requestLocationPermission = async () => {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message:
              "This app needs access to your location to show it on the map.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    };

    requestLocationPermission().then((hasPermission) => {
      if (!hasPermission) {
        Alert.alert("Permission denied", "Location permission was denied");
        return;
      }

      Geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ latitude, longitude });
          setLastUserLocation({ latitude, longitude });
          
          // ✅ Initialize route with starting position
          setUserRoute([{ latitude, longitude }]);

          if (mapRef && mapRef.current) {
            try {
              mapRef.current.animateToRegion(
                {
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                1000
              );
            } catch (error) {
              // Error animating to region
            }
          }

          // ✅ Check if near any checkpoint
          checkProximityToCheckpoints(latitude, longitude);
        },
        (error) => {
          // Alert.alert(
          //   "Location error",
          //   error && error.message ? error.message : "Unable to get location"
          // );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  };

  const syncCheckpointToServer = async (checkpointId) => {
    // ✅ Double-check if checkpoint is already synced (shouldn't happen with new logic, but safety check)
    if (checkpointStatus[checkpointId]?.completed && !syncingCheckpointsRef.current.has(checkpointId)) {
      return true; // Already synced, no need to show message again
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      showCenterToast('No internet connection - checkpoint saved locally', 'warning');
      // ✅ Remove from syncing set on failure
      syncingCheckpointsRef.current.delete(checkpointId);
      return false;
    }
    setLoadingCheckpointId(checkpointId);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        showCenterToast('No auth token found', 'error');
        setLoadingCheckpointId(null);
        // ✅ Remove from syncing set on failure
        syncingCheckpointsRef.current.delete(checkpointId);
        return false;
      }
      const requestBody = {
        event_id: event_id,
       // category_id: category_id,
        checkpoint_id: checkpointId,
        over_speed: overspeedCountRef.current // ✅ Use ref for latest value
      };
      
      // ✅ Debug log to check overspeedCount value being sent
      
      const res = await fetch(
        "https://rajasthanmotorsports.com/api/events/checkpoints/update",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );
      let data = {};
      try { data = await res.json(); } catch {}
      if ((res.status === 200 && data.status === "success") || data.status === "success") {
        // ✅ Mark as synced using checkpoint_id and event_id for better reliability
        markSynced(null, event_id, checkpointId);
        
        setOverspeedCount(0);
        overspeedCountRef.current = 0; // ✅ Reset ref too
        setMarkerColors((prev) => ({ ...prev, [checkpointId]: '#185a9d' })); // blue
        const cpObj = checkpoints.find(c => c.checkpoint_id === checkpointId);
        const cpName = cpObj?.checkpoint_name || checkpointId;
        // ✅ Enhanced toast message with time and center positioning
        const syncTime = new Date().toLocaleTimeString();
        const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
                
        // ✅ Voice Alert for Checkpoint Completion (only once)
        if (voiceAlertsEnabled) {
          const completedCount = Object.values(checkpointStatus).filter(s => s.completed).length + 1; // +1 for current
          getVoiceAlertUtils().announceCheckpointComplete(cpName, completedCount, checkpoints.length);
        }
        
        showCenterToast(successMessage, 'success');
        setLoadingCheckpointId(null);
        // --- NEW LOGIC: Immediate event exit if "FINISH" - "START" checkpoint reached ---
        if (cpName === "FINISH") {
            setOkayTimeout(30);
            setEventCompletedModal(true);
        }
        if (cpName === "START") {
            addStartCheckpointTime();
        }
        // ✅ Keep in syncing set - checkpoint is now fully synced and should never trigger again
        return true;
      } else {
        showCenterToast('Server error: ' + (data.message || 'Failed'), 'error');
        // ✅ Remove from syncing set on failure so it can be retried
        syncingCheckpointsRef.current.delete(checkpointId);
        
        // ✅ Trigger manual sync of pending checkpoints after a delay
        setTimeout(() => {
          syncPendingCheckpoints();
        }, 3000);
       
      }
    } catch (err) {
    
      showCenterToast('Network/API error - checkpoint saved locally', 'warning');
      // ✅ Remove from syncing set on error so it can be retried
      syncingCheckpointsRef.current.delete(checkpointId);
      
      // ✅ Trigger manual sync of pending checkpoints after a delay
      setTimeout(() => {
        syncPendingCheckpoints();
      }, 3000);
    }
    setLoadingCheckpointId(null);
    return false;
  };

  // ✅ Checkpoint reach detection (using dynamic accuracy radius)
  const checkProximityToCheckpoints = (lat, lng) => {
    checkpoints.forEach((cp) => {
      const distance = getDistanceFromLatLonInMeters(
        lat,
        lng,
        parseFloat(cp.latitude),
        parseFloat(cp.longitude)
      );
      // ✅ Use dynamic radius based on checkpoint accuracy, fallback to 10 meters
      const checkpointRadius = (cp.accuracy && !isNaN(parseFloat(cp.accuracy)) && parseFloat(cp.accuracy) > 0) 
        ? parseFloat(cp.accuracy) 
        : 10;
      
      if (distance < checkpointRadius) {
        // ✅ Check if checkpoint is already completed OR currently syncing
        if (!checkpointStatus[cp.checkpoint_id]?.completed && !syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
                   
          // ✅ Immediately mark as syncing to prevent duplicate attempts
          syncingCheckpointsRef.current.add(cp.checkpoint_id);
          
          const reachedTime = new Date().toLocaleTimeString();
          setCheckpointStatus((prev) => ({
            ...prev,
            [cp.checkpoint_id]: { time: reachedTime, completed: true },
          }));
          
          // ✅ Only save checkpoint to database once per event
          saveCheckpoint({
            event_id: event_id, // Use event_id from route params for consistency
            category_id: category_id, // Use category_id from route params for consistency
            checkpoint_id: cp.checkpoint_id,
            checkpoint_name: cp.checkpoint_name,
            checkpoint_point: cp.checkpoint_point,
            latitude: cp.latitude,
            longitude: cp.longitude,
            sequence_number: cp.sequence_number,
            description: cp.description,
            time_stamp: reachedTime,
            status: 'completed',
            over_speed: overspeedCountRef.current // ✅ Store overspeed count for accurate retry syncing
          });
          
          syncCheckpointToServer(cp.checkpoint_id);
          
        } else if (checkpointStatus[cp.checkpoint_id]?.completed || syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
        }
      }
    });
  };

  // ✅ Utility: Distance calculator
  const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    function deg2rad(deg) {
      return deg * (Math.PI / 180);
    }
    const R = 6371000; // Radius of Earth in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  };

  // ✅ Utility: Calculate bearing/heading between two points
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    function deg2rad(deg) {
      return deg * (Math.PI / 180);
    }
    function rad2deg(rad) {
      return rad * (180 / Math.PI);
    }
    
    const dLon = deg2rad(lon2 - lon1);
    const lat1Rad = deg2rad(lat1);
    const lat2Rad = deg2rad(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = rad2deg(Math.atan2(y, x));
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
  };

  // Utility to get bounding region for all checkpoints
  const getBoundingRegion = (points) => {
    if (!points.length)
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    let minLat = parseFloat(points[0].latitude);
    let maxLat = parseFloat(points[0].latitude);
    let minLng = parseFloat(points[0].longitude);
    let maxLng = parseFloat(points[0].longitude);
    points.forEach((cp) => {
      const lat = parseFloat(cp.latitude);
      const lng = parseFloat(cp.longitude);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
    };
  };

  const layerOptions = [
    { key: "standard", label: "Normal View" },
    { key: "satellite", label: "Satellite View" },
    { key: "hybrid", label: "Hybrid View" },
    { key: "terrain", label: "Terrain View", androidOnly: true },
  ];

  // Handler for Layers type change
  const handleMapTypeChange = (type) => {
    if (type === "terrain" && Platform.OS !== "android") {
      Alert.alert("Not Supported", "Terrain view is only available on Android.");
      setLayerDropdownVisible(false);
      return;
    }
    setMapType(type);
    setLayerDropdownVisible(false);
  };

  // ✅ Generate Random Abort Code
  const generateRandomAbortCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRandomAbortCode(code);
    return code;
  };
  
  // ✅ Handle completed event navigation
  const handleEventCompletion = async () => {
    try {
      // ✅ Save event completion status to AsyncStorage
      await AsyncStorage.setItem(`event_${event_id}_status`, 'completed');
      await AsyncStorage.setItem(`event_${event_id}_completion_time`, new Date().toISOString());
      
      // ✅ Optionally save completion statistics
      const completionData = {
        event_id: event_id,
        total_checkpoints: checkpoints.length,
        completed_checkpoints: Object.values(checkpointStatus).filter(s => s.completed).length,
        completion_time: new Date().toISOString(),
        overspeed_count: overspeedCount,
        duration: duration,
      };
      
      await AsyncStorage.setItem(
        `event_${event_id}_completion_data`, 
        JSON.stringify(completionData)
      );
      
    } catch (error) {
      console.error('❌ Error saving event completion data:', error);
    }
    
    setEventCompletedModal(false);
    // Reset navigation stack to prevent going back to map screen
    navigation.reset({
      index: 0,
      routes: [{ name: 'Drawer', params: { screen: 'Dashboard' } }],
    });
  };

  // ✅ SOS Emergency Call Function
  const handleSOSCall = async () => {
    try {
      if (!event_organizer_no) {
        showCenterToast('Organizer contact not available', 'error');
        return;
      }
      Alert.alert(
        "🆘 Emergency Call",
        `Do you want to call the event organizer?\n\nNumber: ${event_organizer_no}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Call Now",
            style: "default",
            onPress: () => {
              Linking.openURL(`tel:${event_organizer_no}`);
            }
          }
        ]
      );
    } catch (error) {
      console.log('SOS call error:', error);
      showCenterToast('Error making SOS call', 'error');
    }
  };

  // ✅ Improved Abort Event Handler
  const handleAbortEventPassword = async () => {
    if (enteredAbortCode.trim() === "") {
      showCenterToast('Please enter the abort code', 'warning');
      return;
    }

    if (enteredAbortCode.trim() !== randomAbortCode) {
      showCenterToast('Invalid abort code. Please try again.', 'error');
      return;
    }

    setAbortLoading(true);

    try {
      // Save abort event locally
      await AsyncStorage.setItem(`event_${event_id}_aborted`, 'true');
      await AsyncStorage.setItem(`event_${event_id}_abort_time`, new Date().toISOString());
      // ✅ Mark event as completed to prevent restart
      await AsyncStorage.setItem(`event_${event_id}_status`, 'completed');
      console.log(`✅ Event ${event_id} marked as aborted and completed in AsyncStorage`);
      
      // Clear location watching
      if (watchId) {
        Geolocation.clearWatch(watchId);
        setWatchId(null);
      }

      // ✅ Voice Alert for Event Abort
      if (voiceAlertsEnabled) {
        getVoiceAlertUtils().announceEventAborted();
      }

      showCenterToast('Event aborted successfully', 'success');

      // Navigate directly to Home screen (no details alert)
      navigation.navigate('Drawer', { screen: 'Dashboard' });
    } catch (error) {
      console.log('Abort error:', error);
      showCenterToast('Error aborting event', 'error');
    }

    setAbortLoading(false);
    setAbortPasswordModal(false);
    setEnteredAbortCode("");
  };


  // ✅ Countdown timer effect - timestamp-based calculation for background reliability
  useEffect(() => {
    if (!eventEndTimestamp.current) return;
    
    const timer = setInterval(() => {
      const now = Date.now();
      const remainingMs = eventEndTimestamp.current - now;
      const newRemaining = Math.max(0, Math.floor(remainingMs / 1000));
      
      setRemainingSeconds(newRemaining);
      
      // ✅ Check for 15-minute warning (900 seconds = 15 minutes)
      if (newRemaining === 900 && !fifteenMinuteWarningGiven && voiceAlertsEnabled) {
        setFifteenMinuteWarningGiven(true);
        // Play simple sound alert instead of voice dialogue
        try {
          SystemSoundUtils.playSystemSound(); // System sound for 15-min warning
          console.log('🔔 15-minute warning alert played');
        } catch (error) {
          console.log('Error playing 15-minute warning sound:', error);
        }
      }
      
      // ✅ Check for event completion (00:00:00)
      if (newRemaining === 0 && voiceAlertsEnabled) {
        // Play simple sound alert for event completion
        try {
          SystemSoundUtils.playSystemSound(); // System sound for event completion
          // Add a second alert sound after a brief delay for emphasis
          setTimeout(() => {
            SystemSoundUtils.playSystemSound();
          }, 500);
          console.log('🏁 Event completion alert played');
          setOkayTimeout(30);
          setEventCompletedModal(true);
        } catch (error) {
          console.log('Error playing event completion sound:', error);
        }
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [fifteenMinuteWarningGiven, voiceAlertsEnabled]);

  // Format seconds to HH:MM:SS
  const formatTime = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Update speed and route on user location change
  const handleUserLocationChange = (e) => {
    try {
      const { latitude, longitude, speed, heading } = e.nativeEvent.coordinate;
      
      // ✅ Always add to route - instant tracking (no 5m filter)
      setUserRoute((prev) => [...prev, { latitude, longitude }]);
      
      setLastUserLocation({ latitude, longitude });
      
      // Update heading/direction for car icon rotation
      if (typeof heading === 'number' && !isNaN(heading)) {
        setUserHeading(heading);
      } else {
        // Calculate heading from previous position if GPS heading not available
        const lastLocation = userRoute[userRoute.length - 1];
        if (lastLocation) {
          const calculatedHeading = calculateBearing(
            lastLocation.latitude,
            lastLocation.longitude,
            latitude,
            longitude
          );
          setUserHeading(calculatedHeading);
        }
      }
      
      checkProximityToCheckpoints(latitude, longitude);
      if (typeof speed === 'number' && !isNaN(speed)) {
        // speed in m/s, convert to km/h
        const speedKmh = Math.round(speed * 3.6);
        setCurrentSpeed(speedKmh);
        
        // ✅ Check speed limit
        checkSpeedLimit(speedKmh);
      }
      
      // ✅ GOOGLE MAPS BEHAVIOR: Continuously center map when following
      if (isFollowingUserRef.current && mapRef.current) {
        try {
          isProgrammaticMove.current = true; // ✅ Mark as programmatic before animation
          const currentZoom = userCurrentRegion || { latitudeDelta: 0.01, longitudeDelta: 0.01 };
          mapRef.current.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: currentZoom.latitudeDelta,
            longitudeDelta: currentZoom.longitudeDelta,
          }, 300); // Fast, smooth centering (reduced from 500ms)
        } catch (error) {
          isProgrammaticMove.current = false; // ✅ Reset on error
          console.log('Error auto-following:', error);
        }
      }
    } catch (err) {
      // ignore
    }
  };

  // ✅ GOOGLE MAPS BEHAVIOR: Detect when user manually moves map to stop following
  const handleRegionChange = (region) => {
    // ✅ Skip detection if this is a programmatic move (from auto-follow)
    if (isProgrammaticMove.current) {
      setUserCurrentRegion(region);
      return;
    }
    
    // ✅ If user is manually interacting with map, stop auto-follow immediately
    if (isFollowingUser && lastUserLocation && userCurrentRegion) {
      const distanceFromUser = getDistanceFromLatLonInMeters(
        region.latitude,
        region.longitude,
        lastUserLocation.latitude,
        lastUserLocation.longitude
      );
      
      // ✅ Detect zoom changes (user zoomed in/out manually)
      const zoomChanged = Math.abs(region.latitudeDelta - userCurrentRegion.latitudeDelta) > 0.0001 ||
                         Math.abs(region.longitudeDelta - userCurrentRegion.longitudeDelta) > 0.0001;
      
      // ✅ Detect pan/scroll (user moved map even slightly - 10m sensitivity)
      const mapMoved = distanceFromUser > 5; // 5 meters sensitivity
      // 10 meters = Very sensitive - slight touch stops it
      // 30 meters = Medium (current) - small swipe stops it
      // 50 meters = Less sensitive - medium swipe needed
      // 100 meters = Least sensitive - must scroll far away
      // ✅ Stop following if user zoomed OR panned map
      if (zoomChanged || mapMoved) {
        isFollowingUserRef.current = false; // ✅ Stop immediately in callbacks
        setIsFollowingUser(false);
        //showCenterToast('Auto-follow stopped - Tap Recenter to resume', 'info');
      }
    }
    
    setUserCurrentRegion(region);
  };

  const handleRegionChangeComplete = (region) => {
    // ✅ Reset flag after animation completes
    const wasProgrammatic = isProgrammaticMove.current;
    isProgrammaticMove.current = false;
    
    // ✅ Only update userCurrentRegion if it was a programmatic move (recenter button)
    // Don't update for manual user zoom/pan - this preserves the recenter button's fixed zoom level
    if (wasProgrammatic) {
      setUserCurrentRegion(region);
    }
  };

  // Handle back button with confirmation
  useEffect(() => {
    const onBackPress = () => {
      // If event completed modal is visible, don't allow back button to dismiss it
      if (eventCompletedModal) {
        return true; // Prevent default back
      }
      
      Alert.alert(
        "Close Map",
        "Do you want to close the map and save/sync all checkpoint data till you reached?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {},
          },
          {
            text: "Yes",
            onPress: () => {
              // Optionally trigger sync here if needed
              navigation.goBack();
            },
          },
        ]
      );
      return true; // Prevent default back
    };
    BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => BackHandler.removeEventListener("hardwareBackPress", onBackPress);
  }, [eventCompletedModal]);

  // Check if all checkpoints are completed
  useEffect(() => {
    if (
      checkpoints.length > 0 &&
      checkpoints.every(cp => checkpointStatus[cp.checkpoint_id]?.completed)
    ) {
      // ✅ Voice Alert for Event Completion
      if (voiceAlertsEnabled) {
        getVoiceAlertUtils().announceEventFinish(checkpoints.length, duration || 'unknown duration');
      }
      
      // Reset the countdown to 30 seconds
      setOkayTimeout(30);
      setEventCompletedModal(true);
    }
  }, [checkpointStatus, checkpoints, voiceAlertsEnabled, duration, setOkayTimeout, setEventCompletedModal]);
  
  // Handle auto-dismiss countdown for event completed modal
  useEffect(() => {
    let timer;
    if (eventCompletedModal && okayTimeout > 0) {
      timer = setTimeout(() => {
        setOkayTimeout(prevTime => prevTime - 1);
      }, 1000);
    } else if (eventCompletedModal && okayTimeout === 0) {
      // Auto-dismiss and navigate to home when timer reaches 0
      handleEventCompletion();
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [eventCompletedModal, okayTimeout]);

  // Cleanup watch position on unmount
  useEffect(() => {
    return () => {
      if (currentLocationTimeoutRef.current) {
        clearTimeout(currentLocationTimeoutRef.current);
      }
      if (watchId) {
        Geolocation.clearWatch(watchId);
      }
      // ✅ Clean up sound resources
      try {
        SoundUtils.release();
        VibrationSoundUtils.release();
        SystemSoundUtils.release();
        EnhancedVoiceAlertUtils.cleanup(); // ✅ Cleanup enhanced voice alerts
      } catch (error) {
        console.log('Error releasing sound resources:', error);
      }
    };
  }, [watchId]);

  // Function to start following user location
  const startFollowingUserLocation = () => {
    // Stop any existing watch
    if (watchId) {
      Geolocation.clearWatch(watchId);
    }

    // Request location permission first
    const requestLocationPermission = async () => {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "This app needs access to your location to show it on the map.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    };

    requestLocationPermission().then((hasPermission) => {
      if (!hasPermission) {
        showCenterToast('Location permission denied', 'error');
        return;
      }

      // Start watching user location
      const id = Geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          
          // Update user coordinates
          setUserCoords({ latitude, longitude });
          
          // ✅ Always add to route - instant tracking (no 5m filter)
          setUserRoute((prev) => [...prev, { latitude, longitude }]);
          
          setLastUserLocation({ latitude, longitude });
          
          // Update heading/direction for car icon rotation
          if (typeof heading === 'number' && !isNaN(heading)) {
            setUserHeading(heading);
          } else {
            // Calculate heading from previous position if GPS heading not available
            const lastLocation = userRoute[userRoute.length - 1];
            if (lastLocation) {
              const calculatedHeading = calculateBearing(
                lastLocation.latitude,
                lastLocation.longitude,
                latitude,
                longitude
              );
              setUserHeading(calculatedHeading);
            }
          }
          
          // ✅ Check speed and speed limit
          if (typeof position.coords.speed === 'number' && !isNaN(position.coords.speed)) {
            const speedKmh = Math.round(position.coords.speed * 3.6);
            setCurrentSpeed(speedKmh);
            checkSpeedLimit(speedKmh);
          }
          
          // ✅ GOOGLE MAPS BEHAVIOR: Continuously center on user location when following
          if (isFollowingUserRef.current && mapRef.current) {
            try {
              isProgrammaticMove.current = true; // ✅ Mark as programmatic before animation
              const currentZoom = userCurrentRegion || { latitudeDelta: 0.01, longitudeDelta: 0.01 };
              mapRef.current.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: currentZoom.latitudeDelta,
                longitudeDelta: currentZoom.longitudeDelta,
              }, 300); // Fast, smooth centering for real-time tracking
            } catch (error) {
              isProgrammaticMove.current = false; // ✅ Reset on error
              console.log('Error auto-following in watchPosition:', error);
            }
          }
          
          // Check proximity to checkpoints
          checkProximityToCheckpoints(latitude, longitude);
          
          // Set following status
          if (!isFollowingUser) {
            setIsFollowingUser(true);
          }
        },
        (error) => {
          let msg = 'Location error';
          if (error && error.message) msg += ': ' + error.message;
          if (error && error.code) msg += ` (code: ${error.code})`;
          
          showCenterToast(msg, 'error');
          isFollowingUserRef.current = false; // ✅ Stop immediately
          setIsFollowingUser(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 5000,
          distanceFilter: 1
        }
      );

      setWatchId(id);
    });
  };

  // Function to stop following user location
  const stopFollowingUserLocation = () => {
    if (watchId) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    isFollowingUserRef.current = false; // ✅ Stop immediately
    setIsFollowingUser(false);
    
    // Optional: Clear the route when stopping tracking
    // setUserRoute([]);
    
    showCenterToast('Stopped following location', 'info');
  };

  // --- MOVE EVENT SIMULATION STATE ---
  const [markerPosition, setMarkerPosition] = useState(null); // Simulation marker
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationIntervalRef = useRef(null);
  const [simulatedSpeed, setSimulatedSpeed] = useState(0); // <-- add this line

  const [isTestMode, setIsTestMode] = useState(false);
  const [isTestModeChecked, setIsTestModeChecked] = useState(false);

  useEffect(() => {
    DeviceInfo.isEmulator().then((isEmu) => {
      setIsTestMode(isEmu);
      setIsTestModeChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!isTestModeChecked) return;
    if (isTestMode) {
      msg = 'App is on Virtual Device';
    } else {
      msg = 'App is on Real Device';
    }
    if (Platform.OS === 'android') {
    } else {
      Alert.alert('Device Info', msg);
    }
  }, [isTestModeChecked, isTestMode]);

  // --- MOVE EVENT SIMULATION FUNCTION ---
  const startUserMovementSimulation = () => {
    if (!checkpoints.length) {
      Alert.alert("No Checkpoints", "There are no checkpoints to simulate.");
      return;
    }
    
    const startPoint = {
      latitude: parseFloat(checkpoints[0].latitude),
      longitude: parseFloat(checkpoints[0].longitude),
    };
    setMarkerPosition(startPoint);
    setUserRoute([startPoint]); // Initialize simulation route
    setIsSimulating(true);
    
    for (let cp of checkpoints) {
      const dist = getDistanceFromLatLonInMeters(
        startPoint.latitude,
        startPoint.longitude,
        parseFloat(cp.latitude),
        parseFloat(cp.longitude)
      );
      const checkpointRadius = (cp.accuracy && !isNaN(parseFloat(cp.accuracy)) && parseFloat(cp.accuracy) > 0) 
        ? parseFloat(cp.accuracy) 
        : 10;
      
      if (dist < checkpointRadius && !checkpointStatus[cp.checkpoint_id]?.completed && !syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
        console.log(`🎮 [startUserMovementSimulation] Initial position reached checkpoint "${cp.checkpoint_name}" (ID: ${cp.checkpoint_id}) - distance: ${dist.toFixed(2)}m`);
        syncingCheckpointsRef.current.add(cp.checkpoint_id);
        
        setCheckpointStatus((prev) => ({
          ...prev,
          [cp.checkpoint_id]: { time: new Date().toLocaleTimeString(), completed: true },
        }));
        
        (async () => {
          setLoadingCheckpointId(cp.checkpoint_id);
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
              showCenterToast('No auth token found', 'error');
              setLoadingCheckpointId(null);
              return;
            }
            
            const res = await fetch(
              "https://rajasthanmotorsports.com/api/events/checkpoints/update",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                  event_id: event_id,
                  checkpoint_id: cp.checkpoint_id,
                  over_speed: overspeedCountRef.current // ✅ Use ref for latest value
                }),
              }
            );
            let data = {};
            try { data = await res.json(); } catch {}
            if ((res.status === 200 && data.status === "success") || data.status === "success") {
              setOverspeedCount(0);
              overspeedCountRef.current = 0; // ✅ Reset ref too
              const cpName = cp.checkpoint_name || cp.checkpoint_id;
              const syncTime = new Date().toLocaleTimeString();
              const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
              console.log(`🎯 [startUserMovementSimulation-Initial] Showing sync success toast for checkpoint "${cpName}" (ID: ${cp.checkpoint_id}) at ${syncTime}`);              
              showCenterToast(successMessage, 'success');
              if (cpName === "FINISH") {
                  setOkayTimeout(30);
                  setEventCompletedModal(true);
              }
              if (cpName === "START") {
                  addStartCheckpointTime();
              }
            } else {
              showCenterToast('Server error: ' + (data.message || 'Failed'), 'error');
            }
          } catch (err) {
            showCenterToast('Network/API error', 'error');
          }
          setLoadingCheckpointId(null);
        })();
        break;
      } else if (dist < checkpointRadius && (checkpointStatus[cp.checkpoint_id]?.completed || syncedCheckpoints.has(cp.checkpoint_id))) {
        console.log(`🔄 [startUserMovementSimulation-Initial] Initial position in range of already synced checkpoint "${cp.checkpoint_name}" (ID: ${cp.checkpoint_id}) - skipping sync`);
      }
    }
    
    let current = startPoint;
    let steps = 0;
    simulationIntervalRef.current = setInterval(() => {
      const availableCheckpoints = checkpoints.filter(cp =>
        parseFloat(cp.latitude) !== current.latitude || parseFloat(cp.longitude) !== current.longitude
      );
      if (availableCheckpoints.length === 0) {
        clearInterval(simulationIntervalRef.current);
        setIsSimulating(false);
        return;
      }
      const targetCp = availableCheckpoints[Math.floor(Math.random() * availableCheckpoints.length)];
      const target = {
        latitude: parseFloat(targetCp.latitude),
        longitude: parseFloat(targetCp.longitude),
      };
      const stepLat = (target.latitude - current.latitude) * 0.02; // ✅ Reduced from 0.1 to 0.02 for slower movement
      const stepLng = (target.longitude - current.longitude) * 0.02; // ✅ Reduced from 0.1 to 0.02 for slower movement
      const newPoint = {
        latitude: current.latitude + stepLat,
        longitude: current.longitude + stepLng,
      };
      
      // ✅ Calculate heading for car rotation in simulation
      const simulatedHeading = calculateBearing(
        current.latitude,
        current.longitude,
        newPoint.latitude,
        newPoint.longitude
      );
      setUserHeading(simulatedHeading);
      
      // Calculate simulated speed (distance/3s * 3.6) - updated for new interval
      const distMoved = getDistanceFromLatLonInMeters(current.latitude, current.longitude, newPoint.latitude, newPoint.longitude);
      const calculatedSpeed = Math.round((distMoved / 3) * 3.6); // ✅ Updated for 3 second interval
      setSimulatedSpeed(calculatedSpeed);
      
      // ✅ Check speed limit for simulation too
      checkSpeedLimit(calculatedSpeed);
      setMarkerPosition(newPoint);
      setUserRoute(prev => [...prev, newPoint]);
      current = newPoint;
      steps++;
      
      // Check if reached any checkpoint (using dynamic accuracy radius)
      for (let cp of checkpoints) {
        const dist = getDistanceFromLatLonInMeters(
          current.latitude,
          current.longitude,
          parseFloat(cp.latitude),
          parseFloat(cp.longitude)
        );
        // ✅ Use dynamic radius based on checkpoint accuracy, fallback to 10 meters
        const checkpointRadius = (cp.accuracy && !isNaN(parseFloat(cp.accuracy)) && parseFloat(cp.accuracy) > 0) 
          ? parseFloat(cp.accuracy) 
          : 10;
        
        // ✅ Use the same syncing prevention mechanism as real location tracking
        if (dist < checkpointRadius && !checkpointStatus[cp.checkpoint_id]?.completed && !syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
          console.log(`🎮 [startUserMovementSimulation] Simulation reached checkpoint "${cp.checkpoint_name}" (ID: ${cp.checkpoint_id}) - distance: ${dist.toFixed(2)}m`);
          
          // ✅ Add to syncing set immediately to prevent duplicates
          syncingCheckpointsRef.current.add(cp.checkpoint_id);
          
          // ✅ Immediately mark as completed to prevent duplicate API calls
          setCheckpointStatus((prev) => ({
            ...prev,
            [cp.checkpoint_id]: { time: new Date().toLocaleTimeString(), completed: true },
          }));
          
          // Call the same API as 'Mark as Completed (Test)' for this checkpoint
          (async () => {
            setLoadingCheckpointId(cp.checkpoint_id);
            try {
              const token = await AsyncStorage.getItem('authToken');
              if (!token) {
                showCenterToast('No auth token found', 'error');
                setLoadingCheckpointId(null);
                return;
              }
              const res = await fetch(
                "https://rajasthanmotorsports.com/api/events/checkpoints/update",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    event_id: event_id,
                    //category_id: category_id,
                    checkpoint_id: cp.checkpoint_id,
                    over_speed: overspeedCountRef.current // ✅ Use ref for latest value
                  }),
                }
              );
              //console.log(`🎯 [event_id "${event_id}" 🎯 [category_id "${category_id}" 🎯 [checkpoint_id "${cp.checkpoint_id}" 🎯 [over_speed "${14}" `);
              let data = {};
              try { data = await res.json(); } catch {}
              if ((res.status === 200 && data.status === "success") || data.status === "success") {
                setOverspeedCount(0);
                overspeedCountRef.current = 0; // ✅ Reset ref too
                const cpName = cp.checkpoint_name || cp.checkpoint_id;
                // ✅ Enhanced toast message with time and center positioning
                const syncTime = new Date().toLocaleTimeString();
                const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
                
                // ✅ Console log for tracking simulation sync toast display
                console.log(`🎯 [startUserMovementSimulation] Showing sync success toast for checkpoint "${cpName}" (ID: ${cp.checkpoint_id}) at ${syncTime}`);
                
                showCenterToast(successMessage, 'success');
                // --- NEW LOGIC: Immediate event exit if "FINISH" checkpoint reached ---
                if (cpName === "FINISH") {
                    setOkayTimeout(30);
                    setEventCompletedModal(true);
                }
                if (cpName === "START") {
                    addStartCheckpointTime();
                }
              } else {
                showCenterToast('Server error: ' + (data.message || 'Failed'), 'error');
              }
            } catch (err) {
              showCenterToast('Network/API error', 'error');
            }
            setLoadingCheckpointId(null);
          })();
          break;
        } 
        // else if (dist < checkpointRadius && (checkpointStatus[cp.checkpoint_id]?.completed || syncedCheckpoints.has(cp.checkpoint_id))) {
        //   // ✅ Log when simulation is in range of already synced checkpoint
        //   console.log(`🔄 [startUserMovementSimulation] "${cp.checkpoint_name}" (ID: ${cp.checkpoint_id}) - skipping sync`);
        // }
      }
      if (steps >= 30) { // 30 steps = 1.5 min (3s interval)
        clearInterval(simulationIntervalRef.current);
        setIsSimulating(false);
        Alert.alert("Simulation Stopped", "Random movement simulation completed.");
      }
    }, 3000); // ✅ Increased from 2000ms to 3000ms for slower movement
  };

  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };
  }, []);

  // Only auto-start simulation on emulator/test mode
  useEffect(() => {
    if (isTestMode) {
      setTimeout(() => {
        startUserMovementSimulation();
      }, 2000); 
    }
  }, [isTestMode]);

  return (
    <View style={styles.container}>
      {/* ✅ Keep screen awake - prevents mobile lock */}
      <KeepAwake />
      
      {/* Top Left Info Bar */}
      <View style={styles.infoBar}>
        <Text style={[
          styles.infoText,
          {
            color: remainingSeconds === 0 ? '#F44336' : remainingSeconds <= 900 ? '#FF5722' : remainingSeconds <= 1800 ? '#FF9800' : '#333',
            fontWeight: remainingSeconds <= 900 ? 'bold' : 'normal',
            backgroundColor: remainingSeconds === 0 ? '#FFEBEE' : 'transparent',
            padding: remainingSeconds === 0 ? 4 : 0,
            borderRadius: remainingSeconds === 0 ? 4 : 0,
          }
        ]}>
          {remainingSeconds === 0 && '🚨 '}
          {remainingSeconds <= 900 && remainingSeconds > 0 && '⚠️ '}
          {remainingSeconds === 0 ? "EVENT TIME OVER!" : startTimeAdded ? `Time Remaining: ${formatTime(remainingSeconds)}` : ""}
          {/* {remainingSeconds === 0 ? 'EVENT TIME OVER!' : `Time Remaining: ${formatTime(remainingSeconds)}`} */}
          {remainingSeconds === 0 && ' 🚨'}
          {remainingSeconds <= 900 && remainingSeconds > 0 && ' ⚠️'}
        </Text>
        <Text style={styles.infoText}>Checkpoint: {Object.values(checkpointStatus).filter(s => s.completed).length}/{checkpoints.length}</Text>
        <Text style={[
          styles.infoText,
          { 
            color: (isSimulating ? simulatedSpeed : currentSpeed) > speedLimit ? '#FF5722' : '#333',
            fontWeight: (isSimulating ? simulatedSpeed : currentSpeed) > speedLimit ? 'bold' : 'normal',
          }
        ]}>
          {(isSimulating ? simulatedSpeed : currentSpeed) > speedLimit && '⚠️ '}
          Speed: {isSimulating ? simulatedSpeed : currentSpeed}/{speedLimit} km/h
          {(isSimulating ? simulatedSpeed : currentSpeed) > speedLimit && ' ⚠️'}
        </Text>
        {/* ✅ Only show this when actually overspeeding */}
        {isOverspeedAlertShown && (isSimulating ? simulatedSpeed : currentSpeed) > speedLimit && (
          <Text style={[styles.infoText, { 
            color: '#fff', 
            backgroundColor: '#FF5722', 
            fontSize: 12, 
            fontWeight: 'bold',
            padding: 4,
            borderRadius: 4,
            textAlign: 'center'
          }]}>
            🚨 REDUCE SPEED! 🚨
            <Text style={{ fontWeight: 'normal' }}> (Overspeed Count: {overspeedCount})</Text>
          </Text>
        )}
      </View>

      

      {/* Top Right Layers Button */}
      <View style={styles.topRightContainer}>
        
        
        {/* Abort Event Button */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: '#FF5722', marginBottom: 15, marginRight: 0 }]}
          onLongPress={() => {
            // Long press detected, opening abort modal
            Alert.alert(
              "⚠️ Abort Event",
              "Are you sure you want to abort this event?",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => {
                    // Abort cancelled
                  }
                },
                {
                  text: "Yes, Abort",
                  style: "destructive",
                  onPress: () => {
                    generateRandomAbortCode();
                    setAbortPasswordModal(true);
                  }
                }
              ]
            );
          }}
          delayLongPress={300}
          onPress={() => {
            showCenterToast('Long press to abort event', 'info');
          }}
        >
        <Text style={styles.iconBtnText}>⚠️</Text>
        </TouchableOpacity>
        
        <View style={styles.topDropdownContainer}>
          <TouchableOpacity
            style={styles.topLayersBtn}
            onPress={() => setLayerDropdownVisible(!layerDropdownVisible)}
          >
            <Text style={styles.topLayersBtnText}>Layers</Text>
          </TouchableOpacity>
          {layerDropdownVisible && (
            <View style={styles.topDropdownMenu}>
              {layerOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownItem, opt.androidOnly && Platform.OS !== "android" && { opacity: 0.5 }]} 
                  onPress={() => !opt.androidOnly || Platform.OS === "android" ? handleMapTypeChange(opt.key) : null}
                  disabled={opt.androidOnly && Platform.OS !== "android"}
                >
                  <Text style={styles.dropdownItemText}>
                    {opt.label + (mapType === opt.key ? " ✓" : "")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
      {isTestMode && !isSimulating && (
        <View>
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 80,
              right: 20,
              backgroundColor: '#ff9800',
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderRadius: 25,
              elevation: 6,
              zIndex: 50,
            }}
            onPress={startUserMovementSimulation}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
              Start Move-Event
            </Text>
          </TouchableOpacity>
          
          {/* Test Voice Alerts Button */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 200,
              right: 20,
              backgroundColor: '#9C27B0',
              paddingVertical: 10,
              paddingHorizontal: 15,
              borderRadius: 20,
              elevation: 6,
              zIndex: 50,
            }}
            onPress={() => {
              if (voiceAlertsEnabled) {
                getVoiceAlertUtils().testAllAlerts();
                showCenterToast('Testing all voice alerts...', 'info');
              } else {
                showCenterToast('Voice alerts are disabled', 'warning');
              }
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
              Test Voice
            </Text>
          </TouchableOpacity>
          
          {/* Test Abort Modal Button */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 140,
              right: 20,
              backgroundColor: '#FF5722',
              paddingVertical: 10,
              paddingHorizontal: 15,
              borderRadius: 20,
              elevation: 6,
              zIndex: 50,
            }}
            onPress={() => {
              // Test button pressed, opening modal
              generateRandomAbortCode();
              setAbortPasswordModal(true);
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
              Test Modal
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={getBoundingRegion(checkpoints)}
        mapType={mapType}
        showsUserLocation={true} // ✅ Enable native location tracking for smooth following
        followsUserLocation={false} // ✅ GOOGLE MAPS BEHAVIOR: Manual control only
        onUserLocationChange={handleUserLocationChange}
        onRegionChange={handleRegionChange} // ✅ Track region changes
        onRegionChangeComplete={handleRegionChangeComplete} // ✅ Detect manual pan
        userLocationAnnotationTitle="My Current Location" // ✅ Custom title
        userLocationCalloutEnabled={true} // ✅ Enable callout on tap
        loadingEnabled={true} // ✅ Show loading indicator
        loadingIndicatorColor="#2196F3" // ✅ Blue loading color
        loadingBackgroundColor="rgba(255,255,255,0.8)" // ✅ Semi-transparent background
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        showsCompass={true}
        showsScale={true}
        mapPadding={{top: 0, right: 0, bottom: 0, left: 0}}
        compassOffset={{x: -10, y: 10}}
        toolbarEnabled={false}
      >
        {/* --- User Movement Route Polyline (Exact Google Maps Style) --- */}
        {/* {userRoute && userRoute.length > 1 && (
          <Polyline
            coordinates={userRoute}
            strokeColor="#4285F4"
            strokeWidth={5}
            linecap={'round'}
            linejoin={'round'}
            geodesic={true}
            strokePattern={[1, 0]} // Solid line like Google Maps
          />
        )} */}
        
        {/* --- Simulated Movement Route (Test Mode Only) --- */}
        {isSimulating && userRoute && userRoute.length > 1 && (
          <Polyline
            coordinates={userRoute}
            strokeColor="#4285F4"
            strokeWidth={5}
            linecap={'round'}
            linejoin={'round'}
            geodesic={true}
            strokePattern={[1, 0]} // Solid line like Google Maps
          />
        )}
        {isSimulating && markerPosition && (
          <Marker 
            coordinate={markerPosition} 
            title="🚗 Sim User" 
            description="Test simulation"
            anchor={{ x: 0.5, y: 0.5 }}
            flat={false}
          >
            {/* Perfect Google Maps Style Car Icon */}
            <View style={{
              width: 25,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              transform: [{ rotate: `${userHeading}deg` }] // Direct rotation like Google Maps
            }}>
              {/* Car Icon with SVG-like design */}
              <View style={{
                width: 18,
                height: 28,
                backgroundColor: '#FF5722',
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#fff',
                shadowColor: '#000',
                shadowOpacity: 0.5,
                shadowOffset: { width: 0, height: 3 },
                elevation: 6,
                overflow: 'hidden',
              }}>
                {/* Front bumper - Clear indication of front */}
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 2,
                  right: 2,
                  height: 4,
                  backgroundColor: '#fff',
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }} />
                
                {/* Front windshield */}
                <View style={{
                  position: 'absolute',
                  top: 4,
                  left: 3,
                  right: 3,
                  height: 6,
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  borderRadius: 2,
                }} />
                
                {/* Side mirrors */}
                <View style={{
                  position: 'absolute',
                  top: 8,
                  left: -1,
                  width: 3,
                  height: 4,
                  backgroundColor: '#FF5722',
                  borderRadius: 1,
                }} />
                <View style={{
                  position: 'absolute',
                  top: 8,
                  right: -1,
                  width: 3,
                  height: 4,
                  backgroundColor: '#FF5722',
                  borderRadius: 1,
                }} />
                
                {/* Main body */}
                <View style={{
                  position: 'absolute',
                  top: 10,
                  left: 1,
                  right: 1,
                  height: 12,
                  backgroundColor: '#FF5722',
                }} />
                
                {/* Rear windshield */}
                <View style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  right: 4,
                  height: 4,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  borderRadius: 1,
                }} />
                
                {/* Rear bumper */}
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 3,
                  right: 3,
                  height: 3,
                  backgroundColor: '#FF5722',
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                }} />
              </View>
            </View>
          </Marker>
        )}
        
        {/* ✅ Enhanced User Location Marker with Car Icon - Always visible when following */}
        {isFollowingUser && lastUserLocation && (
          <Marker
            coordinate={lastUserLocation}
            title="📍 My Live Location"
            description="Real-time tracking active"
            anchor={{ x: 0.5, y: 0.5 }}
            flat={false}
          >
           {/* Perfect Google Maps Style Car Icon - 50% Bigger & Red */}
              <View style={{
                width: 36,
                height: 63,
                justifyContent: 'center',
                alignItems: 'center',
                transform: [{ rotate: `${userHeading}deg` }]
              }}>
                <View style={{
                  width: 27,
                  height: 42,
                  backgroundColor: '#FF0000',
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: '#fff',
                  shadowColor: '#000',
                  shadowOpacity: 0.5,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 8,
                  overflow: 'hidden',
                }}>
                  
                  {/* Front bumper */}
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 3,
                    right: 3,
                    height: 6,
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                  }} />

                  {/* Front windshield */}
                  <View style={{
                    position: 'absolute',
                    top: 6,
                    left: 4,
                    right: 4,
                    height: 9,
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    borderRadius: 2,
                  }} />

                  {/* Side mirrors */}
                  <View style={{
                    position: 'absolute',
                    top: 12,
                    left: -2,
                    width: 4,
                    height: 6,
                    backgroundColor: '#B30000',
                    borderRadius: 2,
                  }} />
                  <View style={{
                    position: 'absolute',
                    top: 12,
                    right: -2,
                    width: 4,
                    height: 6,
                    backgroundColor: '#B30000',
                    borderRadius: 2,
                  }} />

                  {/* Main body */}
                  <View style={{
                    position: 'absolute',
                    top: 15,
                    left: 2,
                    right: 2,
                    height: 18,
                    backgroundColor: '#FF0000',
                  }} />

                  {/* Rear windshield */}
                  <View style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 5,
                    right: 5,
                    height: 6,
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    borderRadius: 2,
                  }} />

                  {/* Rear bumper */}
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 4,
                    right: 4,
                    height: 5,
                    backgroundColor: '#990000',
                    borderBottomLeftRadius: 6,
                    borderBottomRightRadius: 6,
                  }} />
                </View>
              </View>
          </Marker>
        )}
        
        {/* Show current location marker if requested (when not following) */}
        {!isSimulating && !isFollowingUser && showCurrentLocationMarker && currentLocationMarkerCoords && (
          <Marker
            coordinate={currentLocationMarkerCoords}
            title="📍 My Current Location"
            description="You are here"
            pinColor="#2196F3"
          >
            <View style={{
              backgroundColor: '#2196F3',
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 3,
              borderColor: '#fff',
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
              elevation: 5,
            }}>
              <Text style={{ fontSize: 18, color: '#fff' }}>📍</Text>
            </View>
          </Marker>
        )}
        {checkpoints.map((cp, idx) => {
          // ✅ Determine marker color based on completion status
          const isCompleted = checkpointStatus[cp.checkpoint_id]?.completed;
          const markerColor = isCompleted ? 'green' : (cp.color || 'green');

          return (
            <Marker
              key={`${cp.checkpoint_id}-${isCompleted ? 'completed' : 'pending'}`}
              testID={`marker-${cp.checkpoint_id}`}
              coordinate={{
                latitude: parseFloat(cp.latitude),
                longitude: parseFloat(cp.longitude),
              }}
              title={cp.checkpoint_name}
              pinColor={markerColor}
              onPress={() => setSelectedCheckpointId(cp.checkpoint_id)}
            />
          );
        })}
      </MapView>
      {/* TEST BUTTON: Mark selected checkpoint as completed - Only show on simulator/emulator */}
      {isTestMode && selectedCheckpointId && (
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 75, right: 20, backgroundColor: '#4caf50', padding: 14, borderRadius: 28, zIndex: 100, elevation: 8 }}
          onPress={async () => {
            // ✅ Check if checkpoint is already synced or currently syncing
            if (checkpointStatus[selectedCheckpointId]?.completed || syncingCheckpointsRef.current.has(selectedCheckpointId)) {
              console.log(`🔄 [TestButton] Checkpoint "${selectedCheckpointId}" already synced or syncing - skipping`);
              const cpObj = checkpoints.find(c => c.checkpoint_id === selectedCheckpointId);
              const cpName = cpObj?.checkpoint_name || selectedCheckpointId;
              showCenterToast(`Checkpoint "${cpName}" is already synced`, 'warning');
              setSelectedCheckpointId(null);
              return;
            }
            
            // ✅ Mark as syncing to prevent duplicate attempts
            syncingCheckpointsRef.current.add(selectedCheckpointId);

            // Check internet
            const netState = await NetInfo.fetch();
            if (!netState.isConnected) {
              showCenterToast('No internet connection', 'error');
              return;
            }
            setLoadingCheckpointId(selectedCheckpointId);
            try {
                  
              // Use event_id and category_id from route.params, and selectedCheckpointId
              const token = await AsyncStorage.getItem('authToken');
              if (!token) {
                showCenterToast('No auth token found', 'error');
                setLoadingCheckpointId(null);
                setSelectedCheckpointId(null);
                return;
              }
              
              // Debug log removed
              const res = await fetch(
                "https://rajasthanmotorsports.com/api/events/checkpoints/update",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    event_id: event_id,
                    checkpoint_id: selectedCheckpointId,
                    over_speed: overspeedCountRef.current // ✅ Use ref for latest value
                  }),
                }
              );
             
              //console.log(`🎯 [event_id "${event_id}" 🎯 [category_id "${category_id}" 🎯 [checkpoint_id "${selectedCheckpointId}" 🎯 [over_speed "${over_speed}" `);
              let data = {};
              try { data = await res.json(); } catch {}
              if ((res.status === 200 && data.status === "success") || data.status === "success") {
                // Mark as completed
                setOverspeedCount(0);
                overspeedCountRef.current = 0; // ✅ Reset ref too
                const reachedTime = new Date().toLocaleTimeString();
                setCheckpointStatus((prev) => ({
                  ...prev,
                  [selectedCheckpointId]: { time: reachedTime, completed: true },
                }));
                setMarkerColors((prev) => ({ ...prev, [selectedCheckpointId]: '#185a9d' })); // blue
                const cpObj = checkpoints.find(c => c.checkpoint_id === selectedCheckpointId);
                const cpName = cpObj?.checkpoint_name || selectedCheckpointId;
                  
                // Save checkpoint with new fields
                saveCheckpoint({
                  event_id: event_id,
                  category_id: category_id,
                  checkpoint_id: selectedCheckpointId,
                  checkpoint_name: cpObj?.checkpoint_name || '',
                  checkpoint_point: cpObj?.checkpoint_point || '',
                  latitude: cpObj?.latitude || '',
                  longitude: cpObj?.longitude || '',
                  sequence_number: cpObj?.sequence_number || '',
                  description: cpObj?.description || '',
                  time_stamp: reachedTime,
                  status: 'completed',
                  over_speed: overspeedCountRef.current // ✅ Store overspeed count for test mode too
                });
                markSynced(cp.checkpoint_id, event_id, cp.checkpoint_id);
                checkSyncStatus( event_id, selectedCheckpointId);
                // Print local DB log for this checkpoint after saving
                setTimeout(() => {
                  getCheckpointById(selectedCheckpointId, (checkpointData) => {
                    // Local DB checkpoint log removed
                    if (!checkpointData) {
                      // No checkpoint found in local DB
                    }
                  });
                }, 300); // slight delay to ensure save
                
                // ✅ Enhanced toast message with time and center positioning
                const syncTime = new Date().toLocaleTimeString();
                const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
                
                // ✅ Console log for tracking test button sync toast display
                console.log(`🎯 [TestButton] Showing sync success toast for checkpoint "${cpName}" (ID: ${selectedCheckpointId}) at ${syncTime}`);
                
                showCenterToast(successMessage, 'success');
                // --- NEW LOGIC: Immediate event exit if "FINISH" checkpoint reached ---
                if (cpName === "FINISH") {
                    setOkayTimeout(30);
                    setEventCompletedModal(true);
                }
                if (cpName === "START") {
                    addStartCheckpointTime();
                }
              } else {
                showCenterToast('Server error: ' + (data.message || 'Failed'), 'error');
              }
            } catch (err) {
              // API call error occurred
              showCenterToast('Network/API error', 'error');
              console.error('❌ Error syncing checkpoint:', err);
            }
            setLoadingCheckpointId(null);
            setSelectedCheckpointId(null);
          }}
        >
          {loadingCheckpointId === selectedCheckpointId ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Mark as Completed (Test)</Text>
          )}
        </TouchableOpacity>
      )}
      
      {/* Recenter Button - Positioned above Bottom Tab Bar */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 80,
          right: 15,
          backgroundColor: isFollowingUser ? '#2196F3' : '#FFFFFF',
          width: 48,
          height: 48,
          borderRadius: 24,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          zIndex: 100,
          borderWidth: 2,
          borderColor: isFollowingUser ? '#2196F3' : '#E0E0E0',
        }}
        onPress={() => {
          // ✅ GOOGLE MAPS BEHAVIOR: Recenter button zooms and starts auto-following
          if (lastUserLocation && mapRef.current) {
            try {
              // ✅ Predefined zoom level for comfortable driving view
              const recenterZoom = {
                latitude: lastUserLocation.latitude,
                longitude: lastUserLocation.longitude,
                latitudeDelta: 0.001, // ✅ Medium zoom - comfortable for navigation (~1km view)
                longitudeDelta: 0.001, // ✅ Adjust this value: 0.005=close, 0.01=medium, 0.02=far
              };
              
              // ✅ Smooth camera animation to user location with zoom
              isProgrammaticMove.current = true; // ✅ Mark as programmatic
              mapRef.current.animateToRegion(recenterZoom, 1000);
              
              // ✅ Update current region state to maintain this zoom level
              setUserCurrentRegion(recenterZoom);
              
              // ✅ GOOGLE MAPS BEHAVIOR: Always enable auto-follow when recenter is pressed
              if (!isFollowingUser) {
                startFollowingUserLocation();
              }
              isFollowingUserRef.current = true; // ✅ Set ref immediately for callbacks
              setIsFollowingUser(true); // ✅ Set following flag immediately
              
              showCenterToast('Following your location', 'success');
            } catch (error) {
              isProgrammaticMove.current = false; // ✅ Reset on error
              console.log('Error recentering map:', error);
              showCenterToast('Error centering map', 'error');
            }
          } else {
            // ✅ If no location yet, get current location first
            showCenterToast('Getting your location...', 'info');
            Geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords;
                
                if (mapRef.current) {
                  try {
                    const recenterZoom = {
                      latitude,
                      longitude,
                      latitudeDelta: 0.001, // ✅ Medium zoom - comfortable for navigation
                      longitudeDelta: 0.001, // ✅ Match with above zoom level
                    };
                    
                    isProgrammaticMove.current = true; // ✅ Mark as programmatic
                    mapRef.current.animateToRegion(recenterZoom, 600);
                    setUserCurrentRegion(recenterZoom);
                    setLastUserLocation({ latitude, longitude });
                    setUserCoords({ latitude, longitude });
                    
                    // ✅ GOOGLE MAPS BEHAVIOR: Start auto-follow after finding location
                    startFollowingUserLocation();
                    isFollowingUserRef.current = true; // ✅ Set ref immediately
                    setIsFollowingUser(true);
                    
                    showCenterToast('Following your location', 'success');
                  } catch (error) {
                    isProgrammaticMove.current = false; // ✅ Reset on error
                    console.log('Error centering on location:', error);
                    showCenterToast('Error centering map', 'error');
                  }
                }
              },
              (error) => {
                let msg = 'Location error';
                if (error && error.message) msg += ': ' + error.message;
                showCenterToast(msg, 'error');
              },
              {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 2000,
              }
            );
          }
        }}
      >
        {/* Location/GPS Target Icon */}
        <View style={{
          width: 24,
          height: 24,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {/* Outer Circle (Target) */}
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: isFollowingUser ? '#FFFFFF' : '#2196F3',
            position: 'absolute',
          }} />
          {/* Inner Dot */}
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isFollowingUser ? '#FFFFFF' : '#2196F3',
          }} />
        </View>
      </TouchableOpacity>
      
      {/* ✅ Bottom Tab Bar */}
      <View style={styles.bottomTabBar}>
        {/* Checkpoint History Tab */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setModalVisible(true)}
        >
          <View style={styles.tabIconContainer}>
            <Text style={styles.tabIcon}>📋</Text>
          </View>
          <Text style={styles.tabLabel}>History</Text>
        </TouchableOpacity>

        {/* My Location Tab */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            if (isFollowingUser) {
              // ✅ GOOGLE MAPS BEHAVIOR: Pressing My Location again just re-centers
              if (lastUserLocation && mapRef.current) {
                try {
                  mapRef.current.animateToRegion({
                    latitude: lastUserLocation.latitude,
                    longitude: lastUserLocation.longitude,
                    latitudeDelta: userCurrentRegion?.latitudeDelta || 0.0008, // Keep current zoom
                    longitudeDelta: userCurrentRegion?.longitudeDelta || 0.0008, // Keep current zoom
                  }, 800);
                  // showCenterToast('Map centered on your location', 'info');
                } catch (error) {
                  console.log('Error centering map:', error);
                }
              }
            } else {
              // ✅ GOOGLE MAPS BEHAVIOR: First press = zoom in close + start following
              showCenterToast('Getting your location...', 'info');
              Geolocation.getCurrentPosition(
                (position) => {
                  const { latitude, longitude } = position.coords;
                  
                  if (mapRef.current) {
                    try {
                      // ✅ GOOGLE MAPS BEHAVIOR: Initial zoom is close (street level)
                      const initialZoomRegion = {
                        latitude,
                        longitude,
                        latitudeDelta: 0.0008, // ✅ Street level zoom (very close)
                        longitudeDelta: 0.0008, // ✅ Street level zoom (very close)
                      };
                      
                      mapRef.current.animateToRegion(initialZoomRegion, 1200);
                      setUserCurrentRegion(initialZoomRegion); // ✅ Remember this zoom level
                      setHasInitialZoom(true); // ✅ Mark that initial zoom is done
                    } catch (error) {
                      console.log('Error zooming to My Location:', error);
                    }
                  }
                  
                  setUserCoords({ latitude, longitude });
                  setLastUserLocation({ latitude, longitude });
                  setUserRoute([{ latitude, longitude }]);
                  showCenterToast('Location found and tracking started!', 'success');
                  startFollowingUserLocation();
                },
                (error) => {
                  let msg = 'Location error';
                  if (error && error.message) msg += ': ' + error.message;
                  showCenterToast(msg, 'error');
                },
                {
                  enableHighAccuracy: true,
                  timeout: 30000,
                  maximumAge: 5000,
                }
              );
            }
          }}
        >
          <View style={[
            styles.tabIconContainer,
            { backgroundColor: isFollowingUser ? '#2196F3' : '#4CAF50' }
          ]}>
            <Text style={styles.tabIcon}>📍</Text>
          </View>
          <Text style={styles.tabLabel}>
            {isFollowingUser ? 'Following' : 'Location'}
          </Text>
        </TouchableOpacity>
        

        {/* SOS Call Tab */}
        <TouchableOpacity
          style={[styles.tabItem, styles.tabItemLast]}
          onPress={handleSOSCall}
        >
          <View style={[styles.tabIconContainer, { backgroundColor: '#F44336' }]}> 
            <Text style={styles.tabIcon}>🆘</Text>
          </View>
          <Text style={styles.tabLabel}>SOS</Text>
        </TouchableOpacity>

        {/* Clear Route Tab */}
        {/*
        <TouchableOpacity
          style={[styles.tabItem, styles.tabItemLast]}
          onPress={() => {
            if (userRoute.length > 0) {
              setUserRoute([]);
              showCenterToast('Route cleared', 'info');
            } else {
              showCenterToast('No route to clear', 'warning');
            }
          }}
        >
          <View style={[styles.tabIconContainer, { backgroundColor: '#FF9800' }]}> 
            <Text style={styles.tabIcon}>🧹</Text>
          </View>
          <Text style={styles.tabLabel}>Clear</Text>
        </TouchableOpacity>
        */}
      </View>

      {/* Checklist Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Checklist Details</Text>
            {/* Header Row */}
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeaderCell, styles.modalHeaderCellLeft]}>Sr.</Text>
              <Text style={[styles.modalHeaderCell, styles.modalHeaderCellCenter]}>Checkpoint</Text>
              <Text style={[styles.modalHeaderCell, styles.modalHeaderCellTimeRight]}>Time</Text>
              <Text style={[styles.modalHeaderCell, styles.modalHeaderCellRight]}>Status</Text>
            </View>
            <ScrollView style={{ maxHeight: 350, width: '100%' }}>
              {checkpoints.map((cp, idx) => {
                const statusObj = checkpointStatus[cp.checkpoint_id];
                return (
                  <View
                    key={cp.checkpoint_id || idx}
                    style={[styles.modalRow, idx % 2 === 0 ? styles.modalRowEven : styles.modalRowOdd]}
                  >
                    <Text style={[styles.modalCell, styles.modalCellLeft]}>{idx + 1}</Text>
                    <Text style={[styles.modalCell, styles.modalCellCenter]}>{cp.checkpoint_name || `Checkpoint ${idx + 1}`}</Text>
                    <Text style={[styles.modalCell, styles.modalCellRight]}>{statusObj?.time || '-'}</Text>
                    <Text style={[styles.modalCell, styles.modalCellRight]}>{statusObj?.completed ? 'Completed' : 'Not Completed'}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.modalDivider} />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.totalCountText}>Total Checkpoints: {checkpoints.length}</Text>
          </View>
        </View>
      </Modal>

      {/* Event Completed Modal */}
      <Modal
        visible={eventCompletedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // Prevent modal from closing on back button
          return true;
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 24, alignItems: 'center', width: '90%', maxHeight: '90%' }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#185a9d', marginBottom: 12, textAlign: 'center' }}>
              Event is completed!
            </Text>
            <Text style={{ fontSize: 16, color: '#333', marginBottom: 12, textAlign: 'center' }}>
              You can go back to the home page.
            </Text>
            
            {/* Checkpoint History Details */}
            <View style={{ width: '100%', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#185a9d', marginBottom: 8, textAlign: 'center' }}>
                Checkpoint History
              </Text>
              
              {/* Header Row */}
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalHeaderCell, styles.modalHeaderCellLeft]}>Sr.</Text>
                <Text style={[styles.modalHeaderCell, styles.modalHeaderCellCenter]}>Checkpoint</Text>
                <Text style={[styles.modalHeaderCell, styles.modalHeaderCellTimeRight]}>Time</Text>
                <Text style={[styles.modalHeaderCell, styles.modalHeaderCellRight]}>Status</Text>
              </View>
              
              <ScrollView style={{ maxHeight: 200, width: '100%' }}>
                {checkpoints.map((cp, idx) => {
                  const statusObj = checkpointStatus[cp.checkpoint_id];
                  return (
                    <View
                      key={cp.checkpoint_id || idx}
                      style={[styles.modalRow, idx % 2 === 0 ? styles.modalRowEven : styles.modalRowOdd]}
                    >
                      <Text style={[styles.modalCell, styles.modalCellLeft]}>{idx + 1}</Text>
                      <Text style={[styles.modalCell, styles.modalCellCenter]}>{cp.checkpoint_name || `Checkpoint ${idx + 1}`}</Text>
                      <Text style={[styles.modalCell, styles.modalCellRight]}>{statusObj?.time || '-'}</Text>
                      <Text style={[styles.modalCell, styles.modalCellRight]}>{statusObj?.completed ? 'Completed' : 'Not Completed'}</Text>
                    </View>
                  );
                })}
              </ScrollView>
              
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#555', marginTop: 8, textAlign: 'center' }}>
                Total Checkpoints: {checkpoints.length}
              </Text>
            </View>
            
            <Text style={{ 
              fontSize: 14, 
              color: okayTimeout <= 5 ? '#F44336' : '#FF5722', 
              marginBottom: 16, 
              textAlign: 'center', 
              fontWeight: 'bold',
              backgroundColor: okayTimeout <= 5 ? '#FFEBEE' : 'transparent',
              padding: okayTimeout <= 5 ? 5 : 0,
              borderRadius: 4
            }}>
              {okayTimeout <= 5 ? '⚠️ ' : ''}Auto-closing in {okayTimeout} seconds{okayTimeout <= 5 ? ' ⚠️' : ''}
            </Text>
            
            <TouchableOpacity
              style={{ 
                backgroundColor: okayTimeout <= 5 ? '#1976D2' : '#2196F3', 
                paddingVertical: 12, 
                paddingHorizontal: 38, 
                borderRadius: 22,
                elevation: okayTimeout <= 5 ? 8 : 4,
                transform: [{ scale: okayTimeout <= 5 ? 1.05 : 1 }],
                borderWidth: okayTimeout <= 5 ? 2 : 0,
                borderColor: '#fff'
              }}
              onPress={handleEventCompletion}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>FINISH</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Abort Event Password Modal */}
      <Modal
        visible={abortPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAbortPasswordModal(false)}
      >
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 9999
        }}>
          <View style={{ 
            backgroundColor: '#fff', 
            borderRadius: 20, 
            padding: 30, 
            alignItems: 'center', 
            width: '90%', 
            maxWidth: 400,
            elevation: 50,
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowOffset: { width: 0, height: 10 },
            shadowRadius: 20,
            zIndex: 10000
          }}>
            <Text style={{ 
              fontSize: 24, 
              fontWeight: 'bold', 
              color: '#FF5722', 
              marginBottom: 15, 
              textAlign: 'center' 
            }}>
              ⚠️ Abort Event
            </Text>
            <Text style={{ 
              fontSize: 18, 
              color: '#333', 
              marginBottom: 15, 
              textAlign: 'center',
              lineHeight: 24
            }}>
              To confirm event abort, enter the code below:
            </Text>
            
            <View style={{
              backgroundColor: '#f8f9fa',
              borderRadius: 12,
              padding: 15,
              marginBottom: 20,
              borderWidth: 2,
              borderColor: '#FF5722',
              alignItems: 'center'
            }}>
              <Text style={{
                fontSize: 14,
                color: '#666',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                ABORT CODE:
              </Text>
              <Text style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: '#FF5722',
                letterSpacing: 8,
                fontFamily: 'monospace'
              }}>
                {randomAbortCode}
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 10,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  backgroundColor: '#6c757d',
                  borderRadius: 8
                }}
                onPress={() => {
                  generateRandomAbortCode();
                }}
              >
                <Text style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 'bold'
                }}>
                  Generate New Code
                </Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={{
                width: '100%',
                borderWidth: 2,
                borderColor: '#FF5722',
                borderRadius: 15,
                paddingVertical: 15,
                paddingHorizontal: 20,
                fontSize: 18,
                marginBottom: 25,
                backgroundColor: '#fff',
                textAlign: 'center',
                letterSpacing: 4,
                fontFamily: 'monospace',
                color: 'black',

              }}
              placeholder="Enter 4-digit code"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={4}
              value={enteredAbortCode}
              onChangeText={setEnteredAbortCode}
              autoFocus={true}
            />
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              width: '100%',
              gap: 15
            }}>
              <TouchableOpacity
                style={{ 
                  backgroundColor: '#6c757d', 
                  paddingVertical: 15, 
                  paddingHorizontal: 25, 
                  borderRadius: 25,
                  flex: 1,
                  elevation: 3
                }}
                onPress={() => {
                  setAbortPasswordModal(false);
                  setEnteredAbortCode("");
                }}
              >
                <Text style={{ 
                  color: '#fff', 
                  fontWeight: 'bold', 
                  fontSize: 18, 
                  textAlign: 'center' 
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ 
                  backgroundColor: abortLoading ? '#999' : '#FF5722', 
                  paddingVertical: 15, 
                  paddingHorizontal: 25, 
                  borderRadius: 25,
                  flex: 1,
                  elevation: 3
                }}
                onPress={handleAbortEventPassword}
                disabled={abortLoading}
              >
                {abortLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ 
                    color: '#fff', 
                    fontWeight: 'bold', 
                    fontSize: 18, 
                    textAlign: 'center' 
                  }}>
                    Abort
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ Toast overlay - Dynamic icons and colors */}
      {showToast && (
        <View style={[styles.toastContainer, { borderLeftColor: getToastColor(toastType) }]}>
          <View style={{
            backgroundColor: getToastColor(toastType),
            borderRadius: 12,
            width: 24,
            height: 24,
            justifyContent: "center",
            alignItems: "center"
          }}>
            <Text style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>
              {getToastIcon(toastType)}
            </Text>
          </View>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { width: width, height: height },
  toastContainer: {
    position: "absolute",
    top: "50%",
    left: 20,
    right: 20,
    transform: [{ translateY: -25 }], // Center vertically
    backgroundColor: "#fff", // White background like screenshot
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    // borderLeftColor will be set dynamically
  },
  toastText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "left",
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  locationButton: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#2196F3",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 30,
    elevation: 6,
    zIndex: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  topRightContainer: {
    position: "absolute",
    top: 10,
    right: 15,
    zIndex: 30,
    alignItems: "flex-end",
  },
  topDropdownContainer: {
    alignItems: "flex-end",
  },
  topLayersBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    minWidth: 80,
    alignItems: "center",
  },
  topLayersBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  topDropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    elevation: 6,
    shadowColor: "#2196F3",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    minWidth: 140,
  },
  floatingMenu: {
    position: "absolute",
    top: 10, // move to top
    right: 0, // move to right
    flexDirection: "column",
    alignItems: "flex-end",
    zIndex: 30, // ensure above other elements
  },
  bottomFloatingMenu: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },
  iconBtn: {
    backgroundColor: "#4CAF50",
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    marginRight: 12,
    zIndex: 999,       // ✅ सबसे ऊपर
    elevation: 10,     // ✅ Android

  },
  iconBtnText: {
    fontSize: 20,
    color: "#fff",
  },
  // ✅ Special style for My Location Button
  myLocationBtn: {
    backgroundColor: "#4CAF50",
    width: 65, // ✅ Bigger than normal icons (was 55)
    height: 65, // ✅ Bigger than normal icons (was 55)
    borderRadius: 32.5, // ✅ Half of width/height
    justifyContent: "center",
    alignItems: "center",
    elevation: 6, // ✅ Higher elevation for prominence
    shadowColor: "#000",
    shadowOpacity: 0.18, // ✅ More shadow
    shadowOffset: { width: 0, height: 3 }, // ✅ Bigger shadow
    shadowRadius: 6,
    marginRight: 12,
    zIndex: 999,
    borderWidth: 2, // ✅ Border for better visibility
    borderColor: "#fff", // ✅ White border
  },
  myLocationBtnText: {
    fontSize: 26, // ✅ Bigger icon (was 20)
    color: "#fff",
    textShadowColor: "#000", // ✅ Text shadow for better visibility
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  bottomDropdownContainer: {
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
  },
  bottomMenuBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    minWidth: 100,
    alignItems: "center",
  },
  bottomMenuBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  bottomDropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    elevation: 6,
    shadowColor: "#2196F3",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    minWidth: 140,
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
  },
  menuBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    marginRight: 8, // added margin from right
  },
  menuBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  dropdownContainer: {
    width: "100%",
    alignItems: "flex-end",
  },
  dropdownMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 2,
    marginBottom: 8,
    elevation: 6,
    shadowColor: "#2196F3",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    minWidth: 140,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#185a9d",
    fontWeight: "600",
  },
  infoBar: {
    position: 'absolute',
    top: 10,
    left: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', // more transparent
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#185a9d',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    alignItems: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingVertical: 8,
    marginBottom: 2,
    width: '100%',
  },
  modalHeaderCell: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#185a9d',
    textAlign: 'center',
  },
  modalHeaderCellLeft: {
    width: '15%',
    textAlign: 'left',
    paddingLeft: 8,
  },
  modalHeaderCellCenter: {
    width: '35%',
    textAlign: 'left',
    paddingLeft: 4,
  },
  modalHeaderCellTimeRight: {
    width: '20%',
    textAlign: 'center',
    paddingRight: 8,
  },
  modalHeaderCellRight: {
    width: '38%',
    textAlign: 'center',
    paddingRight: 8,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 8,
    marginBottom: 2,
    width: '100%',
  },
  modalRowEven: {
    backgroundColor: '#f7fbff',
  },
  modalRowOdd: {
    backgroundColor: '#e9f5fe',
  },
  modalCell: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  modalCellLeft: {
    width: '15%',
    textAlign: 'left',
    paddingLeft: 8,
  },
  modalCellCenter: {
    width: '30%',
    textAlign: 'left',
    paddingLeft: 4,
  },
  modalCellTimeRight: {
    width: '30%',
    textAlign: 'center',
    paddingRight: 8,
  },
  modalCellRight: {
    width: '30%',
    textAlign: 'center',
    paddingRight: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#b3c6e0',
    width: '100%',
    marginVertical: 12,
    borderRadius: 2,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#185a9d',
    marginBottom: 18,
    textAlign: 'center',
  },
  closeBtn: {
    marginTop: 18,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 22,
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  totalCountText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#185a9d',
    textAlign: 'center',
  },
  
  // ✅ Bottom Tab Bar Styles
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 0,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    zIndex: 100,
    height: 65,
  },
  
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  
  tabItemLast: {
    borderRightWidth: 0,
  },
  
  tabIconContainer: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  
  tabIcon: {
    fontSize: 16,
    color: '#fff',
  },
  
  tabLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
});
export default MapScreen;
