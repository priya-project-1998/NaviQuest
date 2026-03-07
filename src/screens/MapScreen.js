import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, PermissionsAndroid, Platform, Alert, Modal, ScrollView, BackHandler, ActivityIndicator, ToastAndroid, TextInput, Linking, Vibration, Animated, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { activateKeepAwake, deactivateKeepAwake } from '@sayem314/react-native-keep-awake';
import { createTables, saveCheckpoint, getPendingCheckpoints, markSynced, getCheckpointById, getCompletedCheckpointsForEvent } from "../services/dbService";
import SoundUtils from '../utils/SoundUtils';
import VibrationSoundUtils from '../utils/VibrationSoundUtils';
import SystemSoundUtils from '../utils/SystemSoundUtils';
import EnhancedVoiceAlertUtils from '../utils/EnhancedVoiceAlertUtils';

const { width, height } = Dimensions.get("window");
const MapScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets(); // ✅ Get safe area insets for iOS notch/Dynamic Island
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
  const currentSpeedRef = useRef(0); // ✅ Ref for instant access to latest speed
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
  const userManualZoomRef = useRef({ latitudeDelta: 0.005, longitudeDelta: 0.005 }); // ✅ Store user's manual zoom level - preserved during auto-follow (Google Maps nav default)
  const currentZoomLevelRef = useRef(17); // ✅ Track current zoom level (17 = street level like Google Maps nav)
  const isUserTouchingMap = useRef(false); // ✅ Track if user is actively touching/gesturing on map (pinch/pan)
  const isPanGestureRef = useRef(false); // ✅ Track specifically if user is panning (not zooming)
  const [speedLimit, setSpeedLimit] = useState(60); // Default speed limit
  const [isOverspeedAlertShown, setIsOverspeedAlertShown] = useState(false);
  const isOverspeedAlertShownRef = useRef(false); // ✅ Ref to avoid stale closure in checkSpeedLimit
  const [overspeedCount, setOverspeedCount] = useState(0);
  const overspeedCountRef = useRef(0); // ✅ Ref to track latest overspeedCount value
  const lastOverspeedCounterTimestampRef = useRef(0); // ✅ Track last time overspeed counter was incremented (for 5s interval)
  const flashAnim = useRef(new Animated.Value(1)).current; // ✅ For flashing REDUCE SPEED banner
  const flashAnimationRef = useRef(null); // ✅ Ref to control flash animation loop
  const [lastOverspeedAlert, setLastOverspeedAlert] = useState(0);
  const lastOverspeedAlertRef = useRef(0); // ✅ Ref to avoid stale closure
  const [abortLoading, setAbortLoading] = useState(false);
  const [randomAbortCode, setRandomAbortCode] = useState("");
  const [enteredAbortCode, setEnteredAbortCode] = useState("");
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [eventStartAnnounced, setEventStartAnnounced] = useState(false);
  const [lastOverspeedVoiceAlert, setLastOverspeedVoiceAlert] = useState(0);
  const lastOverspeedVoiceAlertRef = useRef(0); // ✅ Ref to avoid stale closure
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
  const smoothedLocationRef = useRef(null); // Stores smoothed GPS coordinates
  const lastValidHeadingRef = useRef(0); // Stores last valid heading for rotation
  const previousRawLocationRef = useRef(null); // ✅ Store previous raw location for heading calculation
  const GPS_SMOOTHING_FACTOR = 0.15; // ✅ Lower = smoother (0.15 = 15% new, 85% old) - keeps car on road
  const MIN_ACCURACY_THRESHOLD = 30; // ✅ Reduced to 30m - ignore very inaccurate readings
  const MIN_DISTANCE_FOR_HEADING = 1; // ✅ Reduced to 1 meter - faster heading updates for turns
  const isCurrentlyOverspeedRef = useRef(false); // Whether currently in overspeed state (for edge detection)
  const speedHistoryRef = useRef([]); // Rolling window of recent speed readings
  const SPEED_HISTORY_SIZE = 3; // Number of readings to average (smooths out spikes)
  const lastSpeedProcessedTimestampRef = useRef(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success"); // success, error, info, warning
  const [markerPosition, setMarkerPosition] = useState(null); // Simulation marker
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationIntervalRef = useRef(null);
  const [simulatedSpeed, setSimulatedSpeed] = useState(0); // <-- add this line
  const [isTestMode, setIsTestMode] = useState(false);
  const [isTestModeChecked, setIsTestModeChecked] = useState(false);

  const smoothGPSCoordinates = (newLat, newLng, accuracy) => {
    if (accuracy && accuracy > MIN_ACCURACY_THRESHOLD) {
      console.log(`🚫 GPS accuracy too low: ${accuracy}m, ignoring update`);
      return smoothedLocationRef.current || { latitude: newLat, longitude: newLng };
    }
    const previousRaw = previousRawLocationRef.current;
    previousRawLocationRef.current = { latitude: newLat, longitude: newLng };
    if (!smoothedLocationRef.current) {
      smoothedLocationRef.current = { latitude: newLat, longitude: newLng };
      return smoothedLocationRef.current;
    }

    const R = 6371000;
    const dLat = (newLat - smoothedLocationRef.current.latitude) * Math.PI / 180;
    const dLon = (newLng - smoothedLocationRef.current.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(smoothedLocationRef.current.latitude * Math.PI / 180) * Math.cos(newLat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const distanceFromSmoothed = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    let dynamicFactor = GPS_SMOOTHING_FACTOR;
    if (distanceFromSmoothed > 50) {
      dynamicFactor = 0.05;
    } else if (accuracy && accuracy < 10) {
      dynamicFactor = 0.4;
    } else if (accuracy && accuracy < 20) {
      dynamicFactor = 0.25;
    }
    const smoothedLat = smoothedLocationRef.current.latitude + dynamicFactor * (newLat - smoothedLocationRef.current.latitude);
    const smoothedLng = smoothedLocationRef.current.longitude + dynamicFactor * (newLng - smoothedLocationRef.current.longitude);
    smoothedLocationRef.current = { latitude: smoothedLat, longitude: smoothedLng };
    return smoothedLocationRef.current;
  };

  const getVoiceAlertUtils = () => {return EnhancedVoiceAlertUtils;};
 
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

  const getMarkerColorByPoint = (checkpointPoint, checkpointName = '') => {
    const point = parseInt(checkpointPoint, 10);
    const name = (checkpointName || '').trim().toUpperCase();

    if (point === 1000) {
      console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → GREEN (START) #4CAF50`);
      return '#4CAF50'; // Green - START
    } else if (point === 2000) {
      console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → RED (FINISH) #F44336`);
      return '#F44336'; // Red - FINISH
    } else if (point === 3000) {
      console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → YELLOW (Regular) #FFEB3B`);
      return '#FFEB3B'; // Yellow - Regular
    } else if (point === 5000) {
      console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → PURPLE (Mandatory) #9C27B0`);
      return '#9C27B0'; // Purple - Mandatory
    } else if (point === 0 || isNaN(point)) {
      // ✅ Fallback: description was empty → use checkpoint_name to decide color
      if (name.startsWith('START')) {
        console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → name-fallback START → GREEN #4CAF50`);
        return '#4CAF50';
      } else if (name.startsWith('FINISH')) {
        console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → name-fallback FINISH → RED #F44336`);
        return '#F44336';
      } else {
        // Regular checkpoint with empty description — treat as Black (Regular)
        console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → point=0 + empty description → Black (Regular) #000000`);
        return '#000000';
      }
    }
    // Truly unknown value
    console.log(`🎨 [Color] name="${checkpointName}" | point="${checkpointPoint}" | parsed=${point} → default → BLACK #000000`);
    return '#000000';
  };

  const showCenterToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    const duration = type === "success" ? 10000 : 5000; // success: 10sec, others: 5sec
    setTimeout(() => { setShowToast(false); }, duration);
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
      if (eventEndTimestamp.current) {
        eventEndTimestamp.current = eventEndTimestamp.current + (timeTakenSec * 1000);
      }
      setStartTimeAdded(true); // ✅ flag ON once start time added
    }
  } catch (e) {
    console.log("Error adding START time:", e);
  }
};

  useEffect(() => {
    if (duration) {
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
      const now = Date.now();
      eventEndTimestamp.current = now + (totalSeconds * 1000);
      setRemainingSeconds(totalSeconds);
    }
  }, [duration]);

  useEffect(() => {
    activateKeepAwake();
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    createTables();
  }, []);

  useEffect(() => {
    if (event_id) {
      getCompletedCheckpointsForEvent(event_id, (completedCheckpoints) => {
        const previousCheckpointStatus = {};
        const restoredMarkerColors = {};
        completedCheckpoints.forEach((checkpoint) => {
          previousCheckpointStatus[checkpoint.checkpoint_id] = {
            time: checkpoint.time_stamp,
            completed: true
          };
          // ✅ FIX: Startup pe bhi START/FINISH ka color blue mat lagao
          // checkpoint_point aur name dono se check karo
          const cpPoint = parseInt(checkpoint.checkpoint_point, 10);
          const cpName = checkpoint.checkpoint_name || '';
          const isFixed = cpPoint === 1000 || cpPoint === 2000
            || cpName === 'START' || cpName === 'FINISH';
          if (!isFixed) {
            restoredMarkerColors[checkpoint.checkpoint_id] = '#185a9d'; // blue for completed regular checkpoints
          }
        });
        
        if (Object.keys(previousCheckpointStatus).length > 0) {
          setCheckpointStatus(previousCheckpointStatus);
          setMarkerColors((prev) => ({ ...prev, ...restoredMarkerColors }));
        }
      });
    }
  }, [event_id]);

  useEffect(() => {
    // ✅ Map open hote hi event_start sound seedha bajao — no delay
    // START checkpoint sync hone pe voice alag se nahi bajegi (overlap avoid)
    if (!voiceAlertsEnabled) return;
    console.log('🔊 Playing event_start sound immediately on map open');
    getVoiceAlertUtils().announceEventStart();
    setEventStartAnnounced(true);
  }, []); 

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

  useEffect(() => {
    if (eventEndTime && voiceAlertsEnabled && !timeWarningGiven) {
      const checkTimeWarning = () => {
        const now = new Date();
        const timeDiff = eventEndTime.getTime() - now.getTime();
        const minutesRemaining = Math.floor(timeDiff / (1000 * 60));
        if (minutesRemaining <= 15 && minutesRemaining > 0 && !timeWarningGiven) {
          getVoiceAlertUtils().announceTimeWarning(minutesRemaining);
          setTimeWarningGiven(true);
        }
      };
      const timeInterval = setInterval(checkTimeWarning, 60000);
      checkTimeWarning();
      return () => clearInterval(timeInterval);
    }
  }, [eventEndTime, voiceAlertsEnabled, timeWarningGiven]);

  useEffect(() => {
  if (speed_limit && speed_limit !== speedLimit) {
    setSpeedLimit(speed_limit);
  }
}, [speed_limit]);

useEffect(() => {
  // ✅ FIX: NetInfo mount hote hi pehli baar current state fire karta hai — use skip karo
  // Sirf actual internet reconnect hone par sync karo
  let isFirstCall = true;
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (isFirstCall) {
      isFirstCall = false;
      return; // Pehli call ignore — yeh sirf current state read hai, actual change nahi
    }
    if (state.isConnected) {
      console.log('🔄 Internet reconnected - syncing pending checkpoints...');
      await syncPendingCheckpoints();
    }
  });

  return () => unsubscribe();
}, []);

const syncPendingCheckpoints = async () => {
  try {
    let pending = await getPendingCheckpoints();
    if (!Array.isArray(pending)) pending = [];
    if (pending.length === 0) {
      console.log('✅ No pending checkpoints to sync');
      return;
    }
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
          markSynced(item.id, item.event_id, item.checkpoint_id);
          if (item.event_id === event_id) {
            const pendingCpObj = checkpoints.find(c => c.checkpoint_id === item.checkpoint_id);
            const cpName = pendingCpObj?.checkpoint_name || item.checkpoint_id;
            const cpPointVal = parseInt(pendingCpObj?.checkpoint_point, 10);
            // ✅ FIX: checkpoint_point null/missing hone par bhi START/FINISH ko blue mat lagao
            // Name-based fallback bhi lagao taaki reliable rahe
            const isFixedMarkerVal = cpPointVal === 1000 || cpPointVal === 2000 
              || cpName === 'START' || cpName === 'FINISH';
            // ✅ Blue marker set karo — START/FINISH ka color nahi badlega
            if (!isFixedMarkerVal) {
              setMarkerColors((prev) => ({ ...prev, [item.checkpoint_id]: '#185a9d' }));
            }
            // ✅ Individual toast + voice per checkpoint when syncing offline data
            const syncTime = new Date().toLocaleTimeString();
            if (cpName === 'START') {
              showCenterToast(`🏁 Event Started (synced offline) at ${syncTime}`, 'success');
            } else if (cpName !== 'FINISH') {
              showCenterToast(`Checkpoint "${cpName}" synced successfully at ${syncTime}`, 'success');
              if (voiceAlertsEnabled) {
                try {
                  const completedCount = Object.values(checkpointStatus).filter(s => s.completed).length;
                  getVoiceAlertUtils().announceCheckpointComplete(cpName, completedCount, checkpoints.length);
                } catch (e) {}
              }
            }
            if (cpName === 'FINISH') {
              showCenterToast(`🏁 Event Finished (synced offline) at ${syncTime}`, 'success');
              setOkayTimeout(30);
              setEventCompletedModal(true);
            }
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

    // ✅ Summary toast sirf tab dikhao jab 2+ checkpoints sync ho rahe hon (har ek ka individual toast pehle hi show hua)
    if (successCount > 1) {
      showCenterToast(`✅ Synced ${successCount} pending checkpoints`, 'success');
    }
    if (failCount > 0) {
      showCenterToast(`⚠️ Failed to sync ${failCount} checkpoint(s) — will retry`, 'warning');
    }
  } catch (err) {
    console.error('❌ Error in syncPendingCheckpoints:', err);
  }
};

  const checkSpeedLimit = useCallback((currentSpeedKmh) => {
    const now = Date.now();
    speedHistoryRef.current.push(currentSpeedKmh);
    if (speedHistoryRef.current.length > SPEED_HISTORY_SIZE) {
      speedHistoryRef.current.shift();
    }
    const smoothedSpeed = Math.round(
      speedHistoryRef.current.reduce((sum, s) => sum + s, 0) / speedHistoryRef.current.length
    );

    currentSpeedRef.current = smoothedSpeed;
    setCurrentSpeed(smoothedSpeed);
    const rawSpeed = currentSpeedKmh;

    if (rawSpeed > speedLimit) {
      // ✅ First time entering overspeed — increment counter immediately
      if (!isCurrentlyOverspeedRef.current) {
        isCurrentlyOverspeedRef.current = true;
        const newCount = overspeedCountRef.current + 1;
        overspeedCountRef.current = newCount;
        setOverspeedCount(newCount);
        lastOverspeedCounterTimestampRef.current = now; // ✅ Reset 5s timer on first detection
        console.log(`⚠️ Overspeed #${newCount} at ${rawSpeed} km/h (limit: ${speedLimit})`);
      } else if (now - lastOverspeedCounterTimestampRef.current >= 5000) {
        // ✅ Still overspeeding after 5 seconds — increment counter again
        lastOverspeedCounterTimestampRef.current = now;
        const newCount = overspeedCountRef.current + 1;
        overspeedCountRef.current = newCount;
        setOverspeedCount(newCount);
        console.log(`⚠️ Persistent Overspeed #${newCount} at ${rawSpeed} km/h (limit: ${speedLimit}) — still speeding after 5s`);
      }

      // ✅ Show banner + start flashing animation
      if (!isOverspeedAlertShownRef.current) {
        isOverspeedAlertShownRef.current = true;
        setIsOverspeedAlertShown(true);
        // Start flashing animation
        if (flashAnimationRef.current) {
          flashAnimationRef.current.stop();
        }
        flashAnimationRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(flashAnim, { toValue: 0.15, duration: 350, useNativeDriver: true }),
            Animated.timing(flashAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
          ])
        );
        flashAnimationRef.current.start();
        console.log(`🚨 REDUCE SPEED alert SHOWN at ${rawSpeed} km/h`);
      }

      if (now - lastSpeedProcessedTimestampRef.current > 1500) {
        lastSpeedProcessedTimestampRef.current = now;
        try {
          SoundUtils.playSpeedAlert();
          setTimeout(() => { VibrationSoundUtils.playSpeedAlert(); }, 150);
        } catch (error) {
          console.log('Error playing alert:', error);
        }
      }

      if (voiceAlertsEnabled && (now - lastOverspeedVoiceAlertRef.current > 5000)) {
        try {
          getVoiceAlertUtils().announceOverspeed(rawSpeed, speedLimit);
        } catch (e) {
          console.log('Voice alert error:', e);
        }
        lastOverspeedVoiceAlertRef.current = now;
      }

    } else {
      // ✅ Speed back to normal — stop overspeed tracking
      isCurrentlyOverspeedRef.current = false;
      lastOverspeedCounterTimestampRef.current = 0; // ✅ Reset 5s interval timer
      if (isOverspeedAlertShownRef.current) {
        isOverspeedAlertShownRef.current = false;
        setIsOverspeedAlertShown(false);
        // ✅ Stop flashing animation and reset opacity
        if (flashAnimationRef.current) {
          flashAnimationRef.current.stop();
          flashAnimationRef.current = null;
        }
        flashAnim.setValue(1);
        console.log(`✅ Speed back to normal: ${rawSpeed} km/h — alert cleared`);
        try {
          const voiceUtils = getVoiceAlertUtils();
          if (voiceUtils && typeof voiceUtils.forceStop === 'function') {
            voiceUtils.forceStop();
          }
          SoundUtils.resetAlertCount();
          VibrationSoundUtils.release();
        } catch (error) {
          console.log('Error stopping alerts:', error);
        }
      }
    }
  }, [speedLimit, voiceAlertsEnabled]);

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
            }
          }
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

  const syncCheckpointToServer = async (checkpointId, capturedOverspeedCount = 0) => {
    if (checkpointStatus[checkpointId]?.completed && !syncingCheckpointsRef.current.has(checkpointId)) {
      return true; 
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      const cpObj = checkpoints.find(c => c.checkpoint_id === checkpointId);
      const cpName = cpObj?.checkpoint_name || checkpointId;
      const reachedTime = new Date().toLocaleTimeString();
      showCenterToast(`📴 No internet — Checkpoint "${cpName}" saved locally at ${reachedTime}. Will sync when connected.`, 'warning');
      if (voiceAlertsEnabled) {
        try {
          const completedCount = Object.values(checkpointStatus).filter(s => s.completed).length + 1;
          getVoiceAlertUtils().announceCheckpointComplete(cpName, completedCount, checkpoints.length);
        } catch (e) {}
      }
      syncingCheckpointsRef.current.delete(checkpointId);
      return false;
    }
    setLoadingCheckpointId(checkpointId);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        showCenterToast('No auth token found', 'error');
        setLoadingCheckpointId(null);
        syncingCheckpointsRef.current.delete(checkpointId);
        return false;
      }
      const requestBody = {
        event_id: event_id,
        checkpoint_id: checkpointId,
        over_speed: capturedOverspeedCount // ✅ Use captured count passed from checkpoint detection (already frozen)
      };
            
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
        markSynced(null, event_id, checkpointId);
        const cpObj = checkpoints.find(c => c.checkpoint_id === checkpointId);
        const cpName = cpObj?.checkpoint_name || checkpointId;
        const cpPoint = parseInt(cpObj?.checkpoint_point, 10);
        if (cpName !== 'START' && cpName !== 'FINISH') {
          setMarkerColors((prev) => ({ ...prev, [checkpointId]: '#185a9d' })); // blue for synced
        }
        const syncTime = new Date().toLocaleTimeString();
        if (cpName === 'START') {
          showCenterToast(`🏁 Event Started! Welcome to the rally at ${syncTime}`, 'success');
        } else {
          const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
          if (voiceAlertsEnabled) {
            const completedCount = Object.values(checkpointStatus).filter(s => s.completed).length + 1;
            getVoiceAlertUtils().announceCheckpointComplete(cpName, completedCount, checkpoints.length);
          }
          showCenterToast(successMessage, 'success');
        }
        setLoadingCheckpointId(null);
        if (cpName === "FINISH") {
            setOkayTimeout(30);
            setEventCompletedModal(true);
        }
        if (cpName === "START") {
            addStartCheckpointTime();
        }
        return true;
      } else {
        showCenterToast('Server error: ' + (data.message || 'Failed'), 'error');
        syncingCheckpointsRef.current.delete(checkpointId);
        setTimeout(() => {
          syncPendingCheckpoints();
        }, 3000);
       
      }
    } catch (err) {
    
      showCenterToast('Network/API error - checkpoint saved locally', 'warning');
      syncingCheckpointsRef.current.delete(checkpointId);
      setTimeout(() => {
        syncPendingCheckpoints();
      }, 3000);
    }
    setLoadingCheckpointId(null);
    return false;
  };

  const checkProximityToCheckpoints = (lat, lng) => {
    checkpoints.forEach((cp) => {
      const distance = getDistanceFromLatLonInMeters(
        lat,
        lng,
        parseFloat(cp.latitude),
        parseFloat(cp.longitude)
      );
      const checkpointRadius = (cp.accuracy && !isNaN(parseFloat(cp.accuracy)) && parseFloat(cp.accuracy) > 0) 
        ? parseFloat(cp.accuracy) 
        : 10;
      
      if (distance < checkpointRadius) {
        if (!checkpointStatus[cp.checkpoint_id]?.completed && !syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
          syncingCheckpointsRef.current.add(cp.checkpoint_id);
          const capturedOverspeedCount = overspeedCountRef.current;
          // ✅ Reset all overspeed state for fresh segment tracking
          overspeedCountRef.current = 0;
          setOverspeedCount(0);
          isCurrentlyOverspeedRef.current = false;
          lastOverspeedCounterTimestampRef.current = 0; // ✅ Reset 5s interval timer for next segment
          speedHistoryRef.current = [];
          // ✅ Stop overspeed banner + flash animation immediately on checkpoint reach
          if (isOverspeedAlertShownRef.current) {
            isOverspeedAlertShownRef.current = false;
            setIsOverspeedAlertShown(false);
            if (flashAnimationRef.current) {
              flashAnimationRef.current.stop();
              flashAnimationRef.current = null;
            }
            flashAnim.setValue(1);
            try {
              const voiceUtils = getVoiceAlertUtils();
              if (voiceUtils && typeof voiceUtils.forceStop === 'function') voiceUtils.forceStop();
              SoundUtils.resetAlertCount();
              VibrationSoundUtils.release();
            } catch (e) {}
          }
          console.log(`🏁 Checkpoint "${cp.checkpoint_name}" reached - overspeed count captured: ${capturedOverspeedCount}, reset to 0`);        
          const reachedTime = new Date().toLocaleTimeString();
          setCheckpointStatus((prev) => ({
            ...prev,
            [cp.checkpoint_id]: { time: reachedTime, completed: true },
          }));
          
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
            over_speed: capturedOverspeedCount // ✅ Use captured count (not ref which is already reset)
          });
          syncCheckpointToServer(cp.checkpoint_id, capturedOverspeedCount); // ✅ Pass captured count
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
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
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
      await AsyncStorage.setItem(`event_${event_id}_status`, 'completed');
      await AsyncStorage.setItem(`event_${event_id}_completion_time`, new Date().toISOString());
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


  useEffect(() => {
    if (!eventEndTimestamp.current) return;
    
    const timer = setInterval(() => {
      const now = Date.now();
      const remainingMs = eventEndTimestamp.current - now;
      const newRemaining = Math.max(0, Math.floor(remainingMs / 1000));
      
      setRemainingSeconds(newRemaining);

      // ✅ Scene 6 — 15-minute warning
      // Use <= 900 instead of === 900 to avoid missing exact tick (GPS/JS timer jitter se miss ho sakta tha)
      if (newRemaining <= 900 && newRemaining > 895 && !fifteenMinuteWarningGiven) {
        setFifteenMinuteWarningGiven(true);
        try {
          SystemSoundUtils.playSystemSound(); // Alarm-style beep
          setTimeout(() => SystemSoundUtils.playSystemSound(), 600); // Double beep
          console.log('🔔 15-minute warning alert played');
        } catch (error) {
          console.log('Error playing 15-minute warning sound:', error);
        }
        // ✅ Toast on screen
        showCenterToast('⏰ 15 minutes remaining in the event!', 'warning');
        // ✅ Voice announcement
        if (voiceAlertsEnabled) {
          try { getVoiceAlertUtils().announceTimeWarning(15); } catch (e) {}
        }
      }

      // ✅ Scene 7 — Event time over (timer reached 0)
      if (newRemaining === 0) {
        try {
          SystemSoundUtils.playSystemSound();
          setTimeout(() => SystemSoundUtils.playSystemSound(), 500);
          console.log('🏁 Event completion alert played');
        } catch (error) {
          console.log('Error playing event completion sound:', error);
        }
        setOkayTimeout(30);
        setEventCompletedModal(true);
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
      const { latitude, longitude, speed, heading, accuracy } = e.nativeEvent.coordinate;
      const previousRaw = previousRawLocationRef.current || { latitude, longitude };
      const smoothedLocation = smoothGPSCoordinates(latitude, longitude, accuracy);
      setUserRoute((prev) => [...prev, smoothedLocation]);
      setLastUserLocation(smoothedLocation);
      let newHeading = userHeading;
      const distanceMoved = getDistanceFromLatLonInMeters(
        previousRaw.latitude, 
        previousRaw.longitude, 
        latitude, 
        longitude
      );
      
      if (typeof heading === 'number' && !isNaN(heading) && heading > 0) {
        newHeading = heading;
        lastValidHeadingRef.current = heading;
      } else if (distanceMoved >= MIN_DISTANCE_FOR_HEADING) {
        newHeading = calculateBearing(
          previousRaw.latitude, 
          previousRaw.longitude, 
          latitude, 
          longitude
        );
        lastValidHeadingRef.current = newHeading;
      } else {
        newHeading = lastValidHeadingRef.current;
      }
      setUserHeading(newHeading);
      previousRawLocationRef.current = { latitude, longitude };
      checkProximityToCheckpoints(smoothedLocation.latitude, smoothedLocation.longitude);
      if (typeof speed === 'number' && !isNaN(speed)) {
        const speedKmh = Math.round(speed * 3.6);
        checkSpeedLimit(speedKmh);
      }
      
      if (isFollowingUserRef.current && mapRef.current && !isUserTouchingMap.current) {
        try {
          isProgrammaticMove.current = true;
          mapRef.current.animateToRegion({
            latitude: smoothedLocation.latitude,
            longitude: smoothedLocation.longitude,
            latitudeDelta: userManualZoomRef.current.latitudeDelta,
            longitudeDelta: userManualZoomRef.current.longitudeDelta,
          }, 400);
        } catch (error) {
          isProgrammaticMove.current = false;
          console.log('Error auto-following:', error);
        }
      }
    } catch (err) {
    }
  };

  const handleRegionChange = (region) => {
    if (isProgrammaticMove.current) {
      setUserCurrentRegion(region);
      return;
    }
    userManualZoomRef.current = {
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };
    const zoom = Math.round(Math.log2(360 / region.latitudeDelta));
    currentZoomLevelRef.current = Math.max(1, Math.min(20, zoom));
    setUserCurrentRegion(region);
  };

  const handleRegionChangeComplete = (region) => {
    isProgrammaticMove.current = false;
    isUserTouchingMap.current = false;
    isPanGestureRef.current = false;
    // ✅ Always save the latest zoom level after any gesture completes
    userManualZoomRef.current = {
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };
    const zoom = Math.round(Math.log2(360 / region.latitudeDelta));
    currentZoomLevelRef.current = Math.max(1, Math.min(20, zoom));
    setUserCurrentRegion(region);
  };

  useEffect(() => {
    const onBackPress = () => {
      if (eventCompletedModal) return true;
      Alert.alert("Close Map", "Do you want to close the map and save/sync all checkpoint data till you reached?", [{ text: "Cancel", style: "cancel", onPress: () => {} }, { text: "Yes", onPress: () => { navigation.goBack(); } }]);
      return true;
    };
    const unsubscribe = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => unsubscribe.remove();
  }, [eventCompletedModal]);

  useEffect(() => {
    if (
      checkpoints.length > 0 &&
      checkpoints.every(cp => checkpointStatus[cp.checkpoint_id]?.completed)
    ) {
      if (voiceAlertsEnabled) {
        getVoiceAlertUtils().announceEventFinish(checkpoints.length, duration || 'unknown duration');
      }
      setOkayTimeout(30);
      setEventCompletedModal(true);
    }
  }, [checkpointStatus, checkpoints, voiceAlertsEnabled, duration, setOkayTimeout, setEventCompletedModal]);
  
  useEffect(() => {
    let timer;
    if (eventCompletedModal && okayTimeout > 0) {
      timer = setTimeout(() => {
        setOkayTimeout(prevTime => prevTime - 1);
      }, 1000);
    } else if (eventCompletedModal && okayTimeout === 0) {
      handleEventCompletion();
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [eventCompletedModal, okayTimeout]);

  useEffect(() => {
    return () => {
      if (currentLocationTimeoutRef.current) {
        clearTimeout(currentLocationTimeoutRef.current);
      }
      if (watchId) {
        Geolocation.clearWatch(watchId);
      }
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

      const id = Geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading, accuracy } = position.coords;
          const previousRaw = previousRawLocationRef.current || { latitude, longitude };
          const smoothedLocation = smoothGPSCoordinates(latitude, longitude, accuracy);
          setUserCoords(smoothedLocation);
          setUserRoute((prev) => [...prev, smoothedLocation]);
          setLastUserLocation(smoothedLocation);
          let newHeading = userHeading;
          const distanceMoved = getDistanceFromLatLonInMeters(
            previousRaw.latitude, 
            previousRaw.longitude, 
            latitude, 
            longitude
          );
          
          if (typeof heading === 'number' && !isNaN(heading) && heading > 0) {
            newHeading = heading;
            lastValidHeadingRef.current = heading;
          } else if (distanceMoved >= MIN_DISTANCE_FOR_HEADING) {
            newHeading = calculateBearing(
              previousRaw.latitude, 
              previousRaw.longitude, 
              latitude, // ✅ Use RAW coordinates
              longitude
            );
            lastValidHeadingRef.current = newHeading;
          } else {
            newHeading = lastValidHeadingRef.current;
          }
          setUserHeading(newHeading);
          previousRawLocationRef.current = { latitude, longitude };
          if (typeof position.coords.speed === 'number' && !isNaN(position.coords.speed)) {
            const speedKmh = Math.round(position.coords.speed * 3.6);
            checkSpeedLimit(speedKmh);
          }
          if (isFollowingUserRef.current && mapRef.current && !isUserTouchingMap.current) {
            try {
              isProgrammaticMove.current = true;
              mapRef.current.animateToRegion({
                latitude: smoothedLocation.latitude,
                longitude: smoothedLocation.longitude,
                latitudeDelta: userManualZoomRef.current.latitudeDelta,
                longitudeDelta: userManualZoomRef.current.longitudeDelta,
              }, 400);
            } catch (error) {
              isProgrammaticMove.current = false;
              console.log('Error auto-following in watchPosition:', error);
            }
          }
          
          checkProximityToCheckpoints(smoothedLocation.latitude, smoothedLocation.longitude);
          // ✅ FIX: isFollowingUser state yahan SET mat karo — stale closure se dobara ON ho jaata tha
          // Following state sirf button press (startFollowingUserLocation call) pe manage hoti hai
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

  const stopFollowingUserLocation = () => {
    if (watchId) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    isFollowingUserRef.current = false; // ✅ Stop immediately
    setIsFollowingUser(false);
    showCenterToast('Stopped following location', 'info');
  };


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
        const capturedOverspeed = overspeedCountRef.current;
        overspeedCountRef.current = 0;
        setOverspeedCount(0);
        isCurrentlyOverspeedRef.current = false;
        speedHistoryRef.current = [];
        
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
                  over_speed: capturedOverspeed // ✅ Use captured count
                }),
              }
            );
            let data = {};
            try { data = await res.json(); } catch {}
            if ((res.status === 200 && data.status === "success") || data.status === "success") {
              const cpName = cp.checkpoint_name || cp.checkpoint_id;
              const syncTime = new Date().toLocaleTimeString();
              if (cpName === 'START') {
                const welcomeMessage = `🏁 Event Started! Welcome to the rally at ${syncTime}`;
                showCenterToast(welcomeMessage, 'success');
              } else {
                const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
                if (voiceAlertsEnabled) {
                  const completedCount = Object.values(checkpointStatus).filter(s => s.completed).length + 1; // +1 for current
                  getVoiceAlertUtils().announceCheckpointComplete(cpName, completedCount, checkpoints.length);
                }
                showCenterToast(successMessage, 'success');
              }
              
              setLoadingCheckpointId(null);
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
      
      const simulatedHeading = calculateBearing(
        current.latitude,
        current.longitude,
        newPoint.latitude,
        newPoint.longitude
      );
      setUserHeading(simulatedHeading);
      const distMoved = getDistanceFromLatLonInMeters(current.latitude, current.longitude, newPoint.latitude, newPoint.longitude);
      const calculatedSpeed = Math.round((distMoved / 3) * 3.6); // ✅ Updated for 3 second interval
      setSimulatedSpeed(calculatedSpeed);
      checkSpeedLimit(calculatedSpeed);
      setMarkerPosition(newPoint);
      setUserRoute(prev => [...prev, newPoint]);
      current = newPoint;
      steps++;
      
      for (let cp of checkpoints) {
        const dist = getDistanceFromLatLonInMeters(
          current.latitude,
          current.longitude,
          parseFloat(cp.latitude),
          parseFloat(cp.longitude)
        );
        const checkpointRadius = (cp.accuracy && !isNaN(parseFloat(cp.accuracy)) && parseFloat(cp.accuracy) > 0) 
          ? parseFloat(cp.accuracy) 
          : 10;
        
        if (dist < checkpointRadius && !checkpointStatus[cp.checkpoint_id]?.completed && !syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
          syncingCheckpointsRef.current.add(cp.checkpoint_id);
          const capturedOverspeed = overspeedCountRef.current;
          overspeedCountRef.current = 0;
          setOverspeedCount(0);
          isCurrentlyOverspeedRef.current = false;
          speedHistoryRef.current = [];
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
                    over_speed: capturedOverspeed // ✅ Use captured count
                  }),
                }
              );
              let data = {};
              try { data = await res.json(); } catch {}
              if ((res.status === 200 && data.status === "success") || data.status === "success") {
                const cpName = cp.checkpoint_name || cp.checkpoint_id;
                const cpPoint = parseInt(cp.checkpoint_point, 10);
                const syncTime = new Date().toLocaleTimeString();
                if (cpPoint === 1000) {
                  const welcomeMessage = `� Event Started! Welcome to the rally at ${syncTime}`;
                  showCenterToast(welcomeMessage, 'success');
                } else {
                  const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
                  showCenterToast(successMessage, 'success');
                }
                
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
      }
      if (steps >= 30) { // 30 steps = 1.5 min (3s interval)
        clearInterval(simulationIntervalRef.current);
        setIsSimulating(false);
        Alert.alert("Simulation Stopped", "Random movement simulation completed.");
      }
    }, 3000); 
  };

  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (isTestMode) {
      setTimeout(() => {
        startUserMovementSimulation();
      }, 2000); 
    }
  }, [isTestMode]);



  return (
    <View style={styles.container}>
      
      {/* Top Left Info Bar - ✅ Fixed for iOS notch/Dynamic Island */}
      <View style={[styles.infoBar, { top: Platform.OS === 'ios' ? insets.top + 5 : 10 }]}>
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
          {remainingSeconds === 0 ? "EVENT TIME OVER!" : remainingSeconds > 0 ? `Time Remaining: ${formatTime(remainingSeconds)}` : ""}
          {/* ✅ FIX: Show time immediately when duration is set, not just after START checkpoint */}
          {remainingSeconds === 0 && ' 🚨'}
          {remainingSeconds <= 900 && remainingSeconds > 0 && ' ⚠️'}
        </Text>
        <Text style={styles.infoText}>Checkpoint: {Object.values(checkpointStatus).filter(s => s.completed).length}/{checkpoints.length}</Text>
        <Text style={[
          styles.infoText,
          { 
            color: isOverspeedAlertShown ? '#FF5722' : '#333',
            fontWeight: isOverspeedAlertShown ? 'bold' : 'normal',
          }
        ]}>
          {isOverspeedAlertShown && '⚠️ '}
          Speed: {isSimulating ? simulatedSpeed : currentSpeed}/{speedLimit} km/h
          {isOverspeedAlertShown && ' ⚠️'}
        </Text>
        {/* ✅ FIX: Show REDUCE SPEED based on isOverspeedAlertShown only (ref-synced, always consistent) */}
        {isOverspeedAlertShown && (
          <Animated.View style={{ opacity: flashAnim }}>
            <Text style={[styles.infoText, { 
              color: '#fff', 
              backgroundColor: '#FF1744', 
              fontSize: 13, 
              fontWeight: 'bold',
              paddingVertical: 5,
              paddingHorizontal: 8,
              borderRadius: 6,
              textAlign: 'center',
              overflow: 'hidden',
            }]}>
              🚨 REDUCE SPEED! 🚨{'  '}
              <Text style={{ fontWeight: 'normal', fontSize: 11 }}>(Overspeed #{overspeedCount})</Text>
            </Text>
          </Animated.View>
        )}
      </View>

      <View style={[styles.topRightContainer, { top: Platform.OS === 'ios' ? insets.top + 5 : 10 }]}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: '#FF5722', marginBottom: 15, marginRight: 0 }]}
          onLongPress={() => {
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
        provider={PROVIDER_GOOGLE}  // Now uses Google Maps on both platforms
        style={styles.map}
        initialRegion={getBoundingRegion(checkpoints)}
        mapType={mapType}
        showsUserLocation={false} // ✅ Disabled — custom red car marker handles user location display
        followsUserLocation={false} // ✅ Manual control only
        onUserLocationChange={handleUserLocationChange}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPanDrag={() => {
          isPanGestureRef.current = true;
          isUserTouchingMap.current = true;
          if (isFollowingUserRef.current) {
            isFollowingUserRef.current = false;
            setIsFollowingUser(false);
          }
        }}
        loadingEnabled={true}
        loadingIndicatorColor="#2196F3"
        loadingBackgroundColor="rgba(255,255,255,0.8)"
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
       
        
        {isSimulating && markerPosition && (
          <Marker 
            coordinate={markerPosition} 
            title="🚗 Sim User" 
            description="Test simulation"
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={userHeading}
          >
            {/* Perfect Google Maps Style Car Icon */}
            <View style={{
              width: 25,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
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
        
        {/* ✅ User Car Marker - Always visible when location is known (not simulating) */}
        {/* Same red car in both following ON and OFF states */}
        {!isSimulating && lastUserLocation && (
          <Marker
            coordinate={lastUserLocation}
            title="📍 My Location"
            description="Your current position"
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={userHeading}
          >
            {/* Car Icon — Always Red */}
            <View style={{
              width: 36,
              height: 63,
              justifyContent: 'center',
              alignItems: 'center',
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
        {checkpoints.map((cp, idx) => {
          // ✅ Determine marker color based on completion status and checkpoint_point
          const isCompleted = checkpointStatus[cp.checkpoint_id]?.completed;
          // ✅ Use checkpoint_point value to identify START/FINISH — with name fallback for empty description CPs
          const cpPoint = parseInt(cp.checkpoint_point, 10);
          const cpNameUpper = (cp.checkpoint_name || '').trim().toUpperCase();
          const isFixedMarker = cpPoint === 1000 || cpPoint === 2000
            || cpNameUpper.startsWith('START') || cpNameUpper.startsWith('FINISH');
          const markerColor = (!isFixedMarker && isCompleted)
            ? '#185a9d' // blue — completed regular/mandatory checkpoint
            : getMarkerColorByPoint(cp.checkpoint_point, cp.checkpoint_name); // pass name for fallback

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
            if (checkpointStatus[selectedCheckpointId]?.completed || syncingCheckpointsRef.current.has(selectedCheckpointId)) {
              console.log(`🔄 [TestButton] Checkpoint "${selectedCheckpointId}" already synced or syncing - skipping`);
              const cpObj = checkpoints.find(c => c.checkpoint_id === selectedCheckpointId);
              const cpName = cpObj?.checkpoint_name || selectedCheckpointId;
              showCenterToast(`Checkpoint "${cpName}" is already synced`, 'warning');
              setSelectedCheckpointId(null);
              return;
            }
            
            syncingCheckpointsRef.current.add(selectedCheckpointId);
            const capturedOverspeed = overspeedCountRef.current;
            overspeedCountRef.current = 0;
            setOverspeedCount(0);
            isCurrentlyOverspeedRef.current = false;
            speedHistoryRef.current = [];

            const netState = await NetInfo.fetch();
            if (!netState.isConnected) {
              showCenterToast('No internet connection', 'error');
              return;
            }
            setLoadingCheckpointId(selectedCheckpointId);
            try {
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
                    over_speed: capturedOverspeed // ✅ Use captured count
                  }),
                }
              );
             
              let data = {};
              try { data = await res.json(); } catch {}
              if ((res.status === 200 && data.status === "success") || data.status === "success") {
                const reachedTime = new Date().toLocaleTimeString();
                setCheckpointStatus((prev) => ({
                  ...prev,
                  [selectedCheckpointId]: { time: reachedTime, completed: true },
                }));

                const cpObj = checkpoints.find(c => c.checkpoint_id === selectedCheckpointId);
                const cpName = cpObj?.checkpoint_name || selectedCheckpointId;
                const cpPointTest = parseInt(cpObj?.checkpoint_point, 10);
                if (cpName !== 'START' && cpName !== 'FINISH') {
                  setMarkerColors((prev) => ({ ...prev, [selectedCheckpointId]: '#185a9d' })); // blue
                }
                  
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
                  over_speed: capturedOverspeed // ✅ Use captured count (already reset for next segment)
                });
                markSynced(cp.checkpoint_id, event_id, cp.checkpoint_id);
                checkSyncStatus( event_id, selectedCheckpointId);
                setTimeout(() => {
                  getCheckpointById(selectedCheckpointId, (checkpointData) => {
                    if (!checkpointData) {
                    }
                  });
                }, 300); // slight delay to ensure save
                
                const syncTime = new Date().toLocaleTimeString();
                if (cpName === 'START') {
                  const welcomeMessage = `� Event Started! Welcome to the rally at ${syncTime}`;
                  showCenterToast(welcomeMessage, 'success');
                } else {
                  const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
                  showCenterToast(successMessage, 'success');
                }
                
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
          if (lastUserLocation && mapRef.current) {
            try {
              isProgrammaticMove.current = true;
              isUserTouchingMap.current = false;
              isPanGestureRef.current = false;
              // ✅ Recenter: street-level zoom (0.005 delta = ~zoom 17)
              // animateToRegion use karo — zoom field reliable hai (animateCamera Google Maps pe zoom ignore karta hai)
              currentZoomLevelRef.current = 17;
              userManualZoomRef.current = { latitudeDelta: 0.005, longitudeDelta: 0.005 };
              mapRef.current.animateToRegion({
                latitude: lastUserLocation.latitude,
                longitude: lastUserLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }, 600);
              
              setUserCurrentRegion({
                latitude: lastUserLocation.latitude,
                longitude: lastUserLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
              
              // ✅ Always enable auto-follow when recenter is pressed
              if (!isFollowingUser) {
                startFollowingUserLocation();
              }
              isFollowingUserRef.current = true;
              setIsFollowingUser(true);
              
              showCenterToast('Following your location', 'success');
            } catch (error) {
              isProgrammaticMove.current = false;
              console.log('Error centering map:', error);
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
                    isProgrammaticMove.current = true;
                    isUserTouchingMap.current = false;
                    isPanGestureRef.current = false;
                    currentZoomLevelRef.current = 17;
                    // ✅ Street-level zoom on first location fetch
                    mapRef.current.animateCamera({
                      center: { latitude, longitude },
                      heading: userHeading, // ✅ Face direction of travel
                      zoom: 17, // ✅ Street-level zoom
                    }, { duration: 800 });
                    
                    userManualZoomRef.current = {
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    };
                    setUserCurrentRegion({
                      latitude,
                      longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    });
                    setLastUserLocation({ latitude, longitude });
                    setUserCoords({ latitude, longitude });
                    
                    startFollowingUserLocation();
                    isFollowingUserRef.current = true;
                    setIsFollowingUser(true);
                    
                    showCenterToast('Following your location', 'success');
                  } catch (error) {
                    isProgrammaticMove.current = false;
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
              // ✅ Already following — re-center, preserve current zoom
              if (lastUserLocation && mapRef.current) {
                try {
                  isProgrammaticMove.current = true;
                  isUserTouchingMap.current = false;
                  isPanGestureRef.current = false;
                  mapRef.current.animateToRegion({
                    latitude: lastUserLocation.latitude,
                    longitude: lastUserLocation.longitude,
                    latitudeDelta: userManualZoomRef.current.latitudeDelta,
                    longitudeDelta: userManualZoomRef.current.longitudeDelta,
                  }, 500);
                } catch (error) {
                  isProgrammaticMove.current = false;
                  console.log('Error centering map:', error);
                }
              }
            } else {
              showCenterToast('Getting your location...', 'info');
              Geolocation.getCurrentPosition(
                (position) => {
                  const { latitude, longitude } = position.coords;
                  
                  if (mapRef.current) {
                    try {
                      isProgrammaticMove.current = true;
                      isUserTouchingMap.current = false;
                      isPanGestureRef.current = false;
                      currentZoomLevelRef.current = 17;
                      // ✅ Street-level zoom like Google Maps navigation
                      mapRef.current.animateCamera({
                        center: { latitude, longitude },
                        heading: userHeading, // ✅ Face direction of travel from start
                        zoom: 17, // ✅ Street-level zoom (Google Maps navigation default)
                      }, { duration: 800 });
                      
                      setHasInitialZoom(true);
                      
                      // ✅ Save this as user's zoom preference
                      userManualZoomRef.current = {
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      };
                      setUserCurrentRegion({
                        latitude,
                        longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      });
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
          disabled={true}
        >
          <View style={[
            styles.tabIconContainer,
            { backgroundColor: isFollowingUser ? '#2196F3' : '#4CAF50' }
          ]}>
            <Text style={styles.tabIcon}>📍</Text>
          </View>
          <Text style={styles.tabLabel}>
            {isFollowingUser ? 'Auto Following' : 'Auto-follow OFF'}
          </Text>
        </TouchableOpacity>
        
        {/* SOS Call Tab */}
        <TouchableOpacity style={[styles.tabItem, styles.tabItemLast]} onPress={handleSOSCall}>
          <View style={[styles.tabIconContainer, { backgroundColor: '#F44336' }]}> 
            <Text style={styles.tabIcon}>🆘</Text>
          </View>
          <Text style={styles.tabLabel}>SOS</Text>
        </TouchableOpacity>
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxHeight: '90%', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 }}>
            {/* ✅ Scene 7: Title with celebration emoji */}
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#185a9d', marginBottom: 4, textAlign: 'center' }}>
              🎉 Event Completed!
            </Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 14, textAlign: 'center' }}>
              Congratulations! All done. Redirecting to home...
            </Text>
            
            {/* Checkpoint History Details */}
            <View style={{ width: '100%', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#185a9d', marginBottom: 8, textAlign: 'center' }}>
                📋 Checkpoint History
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
                      <Text style={[styles.modalCell, styles.modalCellRight, { color: statusObj?.completed ? '#4CAF50' : '#F44336' }]}>
                        {statusObj?.completed ? '✓' : '✗'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
              
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#555', marginTop: 8, textAlign: 'center' }}>
                Total: {Object.values(checkpointStatus).filter(s => s.completed).length}/{checkpoints.length} completed
              </Text>
            </View>
            
            {/* ✅ Scene 7: OK button WITH countdown number inside — "OK (28)" style */}
            <TouchableOpacity
              style={{ 
                backgroundColor: okayTimeout <= 5 ? '#D32F2F' : '#185a9d', 
                paddingVertical: 13, 
                paddingHorizontal: 44, 
                borderRadius: 25,
                elevation: 6,
                marginTop: 4,
                minWidth: 160,
                alignItems: 'center',
                borderWidth: okayTimeout <= 5 ? 2 : 0,
                borderColor: '#FF5722'
              }}
              onPress={handleEventCompletion}
            >
              {/* ✅ "OK (28)" — countdown inside button */}
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
                OK{okayTimeout > 0 ? ` (${okayTimeout})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Abort Event Password Modal */}
      <Modal
        visible={abortPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAbortPasswordModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}
            activeOpacity={1}
            onPress={() => {/* dismiss keyboard on backdrop tap */}}
          >
            <TouchableOpacity activeOpacity={1} style={{ width: '90%', maxWidth: 400 }}>
              <View style={{ 
                backgroundColor: '#fff', 
                borderRadius: 20, 
                padding: 24, 
                alignItems: 'center', 
                width: '100%',
                elevation: 50,
                shadowColor: '#000',
                shadowOpacity: 0.5,
                shadowOffset: { width: 0, height: 10 },
                shadowRadius: 20,
              }}>
                <Text style={{ 
                  fontSize: 24, 
                  fontWeight: 'bold', 
                  color: '#FF5722', 
                  marginBottom: 10, 
                  textAlign: 'center' 
                }}>
                  ⚠️ Abort Event
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: '#333', 
                  marginBottom: 14, 
                  textAlign: 'center',
                  lineHeight: 20
                }}>
                  To confirm event abort, enter the code below:
                </Text>
                
                {/* Abort Code Box */}
                <View style={{
                  backgroundColor: '#fff5f2',
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 15,
                  marginBottom: 14,
                  borderWidth: 2,
                  borderColor: '#FF5722',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}>
                  <View>
                    <Text style={{ fontSize: 11, color: '#666', fontWeight: 'bold' }}>ABORT CODE:</Text>
                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#FF5722', letterSpacing: 8, fontFamily: 'monospace' }}>
                      {randomAbortCode}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#6c757d', borderRadius: 8 }}
                    onPress={() => { generateRandomAbortCode(); }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Generate{'\n'}New Code</Text>
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={{
                    width: '100%',
                    borderWidth: 2,
                    borderColor: '#FF5722',
                    borderRadius: 15,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    fontSize: 22,
                    marginBottom: 18,
                    backgroundColor: '#fff',
                    textAlign: 'center',
                    letterSpacing: 6,
                    fontFamily: 'monospace',
                    color: 'black',
                  }}
                  placeholder="Enter 4-digit code"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={enteredAbortCode}
                  onChangeText={setEnteredAbortCode}
                  autoFocus={false}
                />

                {/* Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                  <TouchableOpacity
                    style={{ 
                      backgroundColor: '#6c757d', 
                      paddingVertical: 15, 
                      borderRadius: 25,
                      flex: 1,
                      elevation: 3
                    }}
                    onPress={() => {
                      setAbortPasswordModal(false);
                      setEnteredAbortCode("");
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ 
                      backgroundColor: abortLoading ? '#999' : '#FF5722', 
                      paddingVertical: 15, 
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
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                        Abort
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemLast: {
    marginRight: 0,
  },
  tabIconContainer: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
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
