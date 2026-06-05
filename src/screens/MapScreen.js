import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, TouchableOpacity, Text, PermissionsAndroid, Platform, Alert, BackHandler, Linking, Animated, AppState } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
// Uses react-native-geolocation-service (explicit iOS auth + Android FusedLocation).
import Geolocation from "react-native-geolocation-service";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwake, deactivateKeepAwake } from '@sayem314/react-native-keep-awake';
import { createTables, saveCheckpoint, getPendingCheckpoints, markSynced, getCompletedCheckpointsForEvent } from "../services/dbService";
import SoundUtils from '../utils/SoundUtils';
import VibrationSoundUtils from '../utils/VibrationSoundUtils';
import SystemSoundUtils from '../utils/SystemSoundUtils';
import EnhancedVoiceAlertUtils from '../utils/EnhancedVoiceAlertUtils';
import { getDistanceFromLatLonInMeters, calculateBearing, getBoundingRegion, getMarkerColorByPoint, formatTime, createGpsSmoother } from "../utils/mapHelpers";
import styles from "./MapScreen.styles";
import { CheckpointHistoryModal, EventCompletedModal, AbortPasswordModal } from "./MapScreen.modals";
import { UserCarMarker, CheckpointPin } from "./MapScreen.markers";
import { useCenterToast } from "../hooks/useCenterToast";

const MapScreen = ({ route, navigation }) => {
  // Self-contained toast: `showCenterToast(msg, type)` to trigger, <Toast /> rendered once.
  const { show: showCenterToast, Toast } = useCenterToast();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [lastUserLocation, setLastUserLocation] = useState(null);
  const [mapType, setMapType] = useState("standard"); // For Center Map dropdown
  const [layerDropdownVisible, setLayerDropdownVisible] = useState(false);
  const [actionDropdownVisible, setActionDropdownVisible] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0); // Countdown timer for event duration
  const [timerReady, setTimerReady] = useState(false); // Flips true once eventEndTimestamp is resolved (async), so the countdown interval effect re-runs and actually starts ticking — matches MapSimulationScreen's working timer.
  const [fifteenMinuteWarningGiven, setFifteenMinuteWarningGiven] = useState(false); // Track 15-min warning
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const currentSpeedRef = useRef(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [userRoute, setUserRoute] = useState([]); // Track user route - real user movement path
  const [checkpointStatus, setCheckpointStatus] = useState({}); // { checkpoint_id: { time, completed } }
  // Live mirror of checkpointStatus — the once-created GPS watch reads this ref, not stale state.
  const checkpointStatusRef = useRef({});
  const [eventCompletedModal, setEventCompletedModal] = useState(false);
  const [userHeading, setUserHeading] = useState(0); // Track user direction for car rotation - starts north
  const [markerColors, setMarkerColors] = useState({}); // checkpoint_id: color
  const [timeStampDropdownVisible, setTimeStampDropdownVisible] = useState(false); // Dropdown for Time Stamp
  const currentLocationTimeoutRef = useRef(null);
  const [abortPasswordModal, setAbortPasswordModal] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false); // Track if following user location
  const isFollowingUserRef = useRef(false); // ✅ Ref to track following state immediately in callbacks
  const [watchId, setWatchId] = useState(null); // Store watch position ID
  const isProgrammaticMove = useRef(false);
  const userManualZoomRef = useRef({ latitudeDelta: 0.005, longitudeDelta: 0.005 });
  const currentZoomLevelRef = useRef(17);
  const isUserTouchingMap = useRef(false);
  const isPanGestureRef = useRef(false);
  const [speedLimit, setSpeedLimit] = useState(60); // Default speed limit
  // Live mirror of speedLimit (API value arrives after mount) so the GPS watch uses the real limit.
  const speedLimitRef = useRef(60);
  const [isOverspeedAlertShown, setIsOverspeedAlertShown] = useState(false);
  const isOverspeedAlertShownRef = useRef(false);
  const [overspeedCount, setOverspeedCount] = useState(0);
  const overspeedCountRef = useRef(0);
  const lastOverspeedCounterTimestampRef = useRef(0);
  const flashAnim = useRef(new Animated.Value(1)).current;
  const flashAnimationRef = useRef(null);
  const lastOverspeedAlertRef = useRef(0);
  const [abortLoading, setAbortLoading] = useState(false);
  const [randomAbortCode, setRandomAbortCode] = useState("");
  const [enteredAbortCode, setEnteredAbortCode] = useState("");
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const lastOverspeedVoiceAlertRef = useRef(0);
  const [timeWarningGiven, setTimeWarningGiven] = useState(false);
  const [eventEndTime, setEventEndTime] = useState(null);
  const [okayTimeout, setOkayTimeout] = useState(30); // 30 second countdown for "Okay" button
  const { checkpoints: paramCheckpoints, category_id, event_id, kml_path, color, event_organizer_no, speed_limit, event_start_date, event_end_date,duration } = route.params || {};
  const checkpoints = Array.isArray(paramCheckpoints) ? paramCheckpoints : [];
  const eventStartTimeRef = useRef(null);
  const syncingCheckpointsRef = useRef(new Set());
  const eventEndTimestamp = useRef(null);
  const smoothGPSCoordinatesRef = useRef(createGpsSmoother({ smoothingFactor: 0.3, minAccuracy: 30 }));
  const smoothGPSCoordinates = (lat, lng, acc) => smoothGPSCoordinatesRef.current(lat, lng, acc);
  const lastValidHeadingRef = useRef(0); // Stores last valid heading for rotation
  const previousRawLocationRef = useRef(null);
  const MIN_DISTANCE_FOR_HEADING = 1;
  const isCurrentlyOverspeedRef = useRef(false); // Whether currently in overspeed state (for edge detection)
  const speedHistoryRef = useRef([]); // Rolling window of recent speed readings
  const SPEED_HISTORY_SIZE = 3; // Number of readings to average (smooths out spikes)
  const lastSpeedProcessedTimestampRef = useRef(0);
  // 🛠️ DEBUG — remove before production
  const debugFirstFixShownRef = useRef(false);

  useEffect(() => {
    if (!eventStartTimeRef.current) {
      eventStartTimeRef.current = new Date();
    }
  }, []);

  const addStartCheckpointTime = async () => {
    try {
      if (!eventStartTimeRef.current) return;
      const now = new Date();
      const timeTakenSec = Math.floor((now - eventStartTimeRef.current) / 1000);
      if (timeTakenSec > 0 && eventEndTimestamp.current) {
        const newEndTs = eventEndTimestamp.current + (timeTakenSec * 1000);
        eventEndTimestamp.current = newEndTs;
        if (event_id) {
          await AsyncStorage.setItem(`event_${event_id}_end_ts`, String(newEndTs));
        }
      }
    } catch (e) {
    }
  };

  useEffect(() => {
    if (!duration) return;
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
    // ✅ Real-time timer that survives background / app-kill.
    (async () => {
      const totalSeconds = parseDurationToSeconds(duration);
      const key = event_id ? `event_${event_id}_end_ts` : null;
      const now = Date.now();
      let endTs = null;
      if (key) {
        try {
          const saved = await AsyncStorage.getItem(key);
          if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed)) endTs = parsed;
          }
        } catch (e) {}
      }
      if (!endTs) {
        endTs = now + totalSeconds * 1000; // first start for this event
        if (key) {
          try { await AsyncStorage.setItem(key, String(endTs)); } catch (e) {}
        }
      }
      eventEndTimestamp.current = endTs;
      const remainingSec = Math.max(0, Math.floor((endTs - now) / 1000));
      setRemainingSeconds(remainingSec);
      // 🛠️ DEBUG
      const isResumed = !!(await AsyncStorage.getItem(key).catch(() => null));
      showCenterToast(`[TIMER] duration:${duration} | totalSec:${totalSeconds} | remaining:${remainingSec}s | resumed:${isResumed}`, 'info', 3000);
      setTimerReady(true); // ref is now populated → triggers the countdown interval effect to (re-)run and start ticking.
    })();
  }, [duration, event_id]);

  useEffect(() => {
    activateKeepAwake();
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    createTables();
  }, []);

  // Keep checkpointStatusRef in lockstep with state for the mount-time watch closure.
  useEffect(() => {
    checkpointStatusRef.current = checkpointStatus;
  }, [checkpointStatus]);

  useEffect(() => {
    if (event_id) {
      // 🛠️ DEBUG
      showCenterToast(`[RESTORE-START] Loading saved checkpoints from DB for event:${event_id}`, 'info', 3000);
      getCompletedCheckpointsForEvent(event_id, (completedCheckpoints) => {
        const previousCheckpointStatus = {};
        const restoredMarkerColors = {};
        completedCheckpoints.forEach((checkpoint) => {
          previousCheckpointStatus[checkpoint.checkpoint_id] = {
            time: checkpoint.time_stamp,
            completed: true
          };
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
          checkpointStatusRef.current = previousCheckpointStatus; // sync ref now so the watch sees restored state on its first tick
          setCheckpointStatus(previousCheckpointStatus);
          setMarkerColors((prev) => ({ ...prev, ...restoredMarkerColors }));
          // 🛠️ DEBUG
          const names = completedCheckpoints.map(c => c.checkpoint_name).join(', ');
          showCenterToast(`[RESTORE-OK] ${completedCheckpoints.length} checkpoints restored: ${names}`, 'success', 3000);
        } else {
          // 🛠️ DEBUG
          showCenterToast(`[RESTORE-EMPTY] No saved checkpoints found in DB for this event`, 'warning', 3000);
        }
      });
    }
  }, [event_id]);

  useEffect(() => {
    // START checkpoint sync hone pe voice alag se nahi bajegi (overlap avoid)
    if (!voiceAlertsEnabled) return;
    EnhancedVoiceAlertUtils.announceEventStart();
  }, []);

  useEffect(() => {
    if (event_end_date && !eventEndTime) {
      try {
        const endTime = new Date(event_end_date);
        setEventEndTime(endTime);
      } catch (error) {
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
          EnhancedVoiceAlertUtils.announceTimeWarning(minutesRemaining);
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
    // 🛠️ DEBUG
    showCenterToast(`[SPEED-LIMIT] Set from API: ${speed_limit} km/h`, 'info', 3000);
  }
}, [speed_limit]);

  // Keep speedLimitRef in lockstep so the mount-time GPS watch reads the current (API) limit.
  useEffect(() => {
    speedLimitRef.current = speedLimit;
  }, [speedLimit]);

useEffect(() => {
  // Sirf actual internet reconnect hone par sync karo
  let isFirstCall = true;
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (isFirstCall) {
      isFirstCall = false;
      return; // Pehli call ignore — yeh sirf current state read hai, actual change nahi
    }
    if (state.isConnected) {
      // 🛠️ DEBUG
      showCenterToast(`[NET-RECONNECT] Internet back — triggering pending sync`, 'info', 3000);
      await syncPendingCheckpoints();
    }
  });

  return () => unsubscribe();
}, []);

const syncPendingCheckpoints = async () => {
  try {
    let pending = await getPendingCheckpoints();
    if (!Array.isArray(pending)) pending = [];
    // 🛠️ DEBUG
    showCenterToast(`[PENDING-SYNC] Found ${pending.length} checkpoint(s) to sync`, 'info', 3000);
    if (pending.length === 0) return;
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      // 🛠️ DEBUG
      showCenterToast(`[PENDING-SYNC] No auth token — aborting sync`, 'error', 3000);
      return;
    }
    let successCount = 0;
    let failCount = 0;

    for (let item of pending) {
      try {
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
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        let data = {};
        try {
          data = await res.json();
        } catch (jsonErr) {
        }
        
        const isSuccess = data?.status === "success";
        // Treat HTTP-200 with non-error server status as synced too — covers "already_processed"
        // / "duplicate" responses that would otherwise loop forever in the pending queue.
        const isAlreadySynced = res.status === 200 && !isSuccess
          && data?.status !== "error" && data?.status !== "failed";


        if (res.status === 401) {
          showCenterToast('⚠️ Session expired — please logout and login again', 'error');
          break;
        }
        if (res.status === 403) {
          showCenterToast(`⚠️ ${data?.message || 'Access denied by server'}`, 'warning');
          markSynced(item.id, item.event_id, item.checkpoint_id);
          continue;
        }

        if (isSuccess || isAlreadySynced) {
          markSynced(item.id, item.event_id, item.checkpoint_id);
          if (item.event_id === event_id) {
            const pendingCpObj = checkpoints.find(c => c.checkpoint_id === item.checkpoint_id);
            const cpName = pendingCpObj?.checkpoint_name || item.checkpoint_id;
            const cpPointVal = parseInt(pendingCpObj?.checkpoint_point, 10);
            const isFixedMarkerVal = cpPointVal === 1000 || cpPointVal === 2000
              || cpName === 'START' || cpName === 'FINISH';
            if (!isFixedMarkerVal) {
              setMarkerColors((prev) => ({ ...prev, [item.checkpoint_id]: '#185a9d' }));
            }
            const reachedTime = item.time_stamp || new Date().toLocaleTimeString();
            // Sync the ref too so the START gate opens immediately on offline-queue sync.
            if (!checkpointStatusRef.current[item.checkpoint_id]?.completed) {
              checkpointStatusRef.current = {
                ...checkpointStatusRef.current,
                [item.checkpoint_id]: { time: reachedTime, completed: true },
              };
            }
            setCheckpointStatus((prev) => {
              if (prev[item.checkpoint_id]?.completed) return prev;
              return { ...prev, [item.checkpoint_id]: { time: reachedTime, completed: true } };
            });
            if (cpName === 'START') {
              addStartCheckpointTime();
            }
            const syncTime = new Date().toLocaleTimeString();
            if (cpName === 'START') {
              showCenterToast(`🏁 Event Started (synced offline) at ${syncTime}`, 'success');
            } else if (cpName !== 'FINISH') {
              showCenterToast(`Checkpoint "${cpName}" synced successfully at ${syncTime}`, 'success');
              if (voiceAlertsEnabled) {
                try {
                  const completedCount = Object.values(checkpointStatusRef.current).filter(s => s.completed).length;
                  EnhancedVoiceAlertUtils.announceCheckpointComplete(cpName, completedCount, checkpoints.length);
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
          failCount++;
          // 🛠️ DEBUG
          showCenterToast(`[SYNC-FAIL] HTTP:${res.status} | ${data?.status} | ${data?.message || '?'}`, 'error', 3000);
        }
      } catch (err) {
        failCount++;
        // 🛠️ DEBUG
        showCenterToast(`[SYNC-ERR] ${err?.message || String(err)}`, 'error', 3000);
      }
    }

    if (successCount >= 1) {
      showCenterToast(`✅ ${successCount} checkpoint(s) synced`, 'success');
    }
    if (failCount > 0 && successCount === 0) {
      showCenterToast(`⚠️ Sync failed for ${failCount} checkpoint(s) — will retry on reconnect`, 'warning');
    }
  } catch (err) {
  }
};

  // Persist the running overspeed count so it survives background/app-kill.
  const persistOverspeedCount = (count) => {
    if (!event_id) return;
    AsyncStorage.setItem(`event_${event_id}_overspeed`, String(count)).catch(() => {});
  };

  // Restore the running overspeed count on mount (e.g. after an app-kill restart).
  useEffect(() => {
    if (!event_id) return;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(`event_${event_id}_overspeed`);
        if (saved != null) {
          const val = parseInt(saved, 10);
          if (!isNaN(val) && val > 0) {
            overspeedCountRef.current = val;
            setOverspeedCount(val);
          }
        }
      } catch (e) {}
    })();
  }, [event_id]);

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
    const activeSpeedLimit = speedLimitRef.current; // read the live (API) limit, not the stale mount value

    if (rawSpeed > activeSpeedLimit) {
      if (!isCurrentlyOverspeedRef.current) {
        isCurrentlyOverspeedRef.current = true;
        // +1 only the FIRST overspeed in this segment (lastTs===0); re-cross within segment doesn't re-add.
        if (lastOverspeedCounterTimestampRef.current === 0) {
          const newCount = overspeedCountRef.current + 1;
          overspeedCountRef.current = newCount;
          setOverspeedCount(newCount);
          persistOverspeedCount(newCount); // survive background / app-kill
          lastOverspeedCounterTimestampRef.current = now;
        }
      } else if (now - lastOverspeedCounterTimestampRef.current >= 5000) {
        lastOverspeedCounterTimestampRef.current = now;
        const newCount = overspeedCountRef.current + 1;
        overspeedCountRef.current = newCount;
        setOverspeedCount(newCount);
        persistOverspeedCount(newCount);
      }

      if (!isOverspeedAlertShownRef.current) {
        isOverspeedAlertShownRef.current = true;
        setIsOverspeedAlertShown(true);
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
      }

      if (now - lastSpeedProcessedTimestampRef.current > 1500) {
        lastSpeedProcessedTimestampRef.current = now;
        try {
          SoundUtils.playSpeedAlert();
          setTimeout(() => { VibrationSoundUtils.playSpeedAlert(); }, 150);
        } catch (error) {
        }
      }

      if (voiceAlertsEnabled && (now - lastOverspeedVoiceAlertRef.current > 5000)) {
        try {
          EnhancedVoiceAlertUtils.announceOverspeed(rawSpeed, activeSpeedLimit);
        } catch (e) {
        }
        lastOverspeedVoiceAlertRef.current = now;
      }

    } else {
      isCurrentlyOverspeedRef.current = false;
      // Don't reset the 5s counter timestamp on a dip — keeps cadence; reset only at checkpoint.
      if (isOverspeedAlertShownRef.current) {
        isOverspeedAlertShownRef.current = false;
        setIsOverspeedAlertShown(false);
        if (flashAnimationRef.current) {
          flashAnimationRef.current.stop();
          flashAnimationRef.current = null;
        }
        flashAnim.setValue(1);
        try {
          const voiceUtils = EnhancedVoiceAlertUtils;
          if (voiceUtils && typeof voiceUtils.forceStop === 'function') {
            voiceUtils.forceStop();
          }
          SoundUtils.resetAlertCount();
          VibrationSoundUtils.release();
        } catch (error) {
        }
      }
    }
  }, [speedLimit, voiceAlertsEnabled]);

  const syncCheckpointToServer = async (checkpointId, capturedOverspeedCount = 0, suppressStartFinishAlert = false) => {
    if (checkpointStatusRef.current[checkpointId]?.completed && !syncingCheckpointsRef.current.has(checkpointId)) {
      return true;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      const cpObj = checkpoints.find(c => c.checkpoint_id === checkpointId);
      const cpName = cpObj?.checkpoint_name || checkpointId;
      const reachedTime = new Date().toLocaleTimeString();
      showCenterToast(`📴 No internet — Checkpoint "${cpName}" saved locally at ${reachedTime}. Will sync when connected.`, 'warning');
      // 🛠️ DEBUG
      showCenterToast(`[OFFLINE-SAVE] "${cpName}" | overspeed:${capturedOverspeedCount} | SQLite only`, 'warning', 3000);
      if (voiceAlertsEnabled) {
        try {
          const completedCount = Object.values(checkpointStatusRef.current).filter(s => s.completed).length + 1;
          EnhancedVoiceAlertUtils.announceCheckpointComplete(cpName, completedCount, checkpoints.length);
        } catch (e) {}
      }
      syncingCheckpointsRef.current.delete(checkpointId);
      return false;
    }
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        showCenterToast('No auth token found', 'error');
        syncingCheckpointsRef.current.delete(checkpointId);
        return false;
      }
      const requestBody = {
        event_id: event_id,
        checkpoint_id: checkpointId,
        over_speed: capturedOverspeedCount
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
      if (res.status === 401) {
        showCenterToast('⚠️ Session expired — please logout and login again', 'error');
        syncingCheckpointsRef.current.delete(checkpointId);
        return false;
      }
      if (res.status === 403) {
        // "Not a participant" or similar — can never succeed, discard from queue.
        markSynced(null, event_id, checkpointId);
        syncingCheckpointsRef.current.delete(checkpointId);
        return false;
      }
      if ((res.status === 200 && data.status === "success") || data.status === "success") {
        markSynced(null, event_id, checkpointId);
        const cpObj = checkpoints.find(c => c.checkpoint_id === checkpointId);
        const cpName = cpObj?.checkpoint_name || checkpointId;
        const cpPoint = parseInt(cpObj?.checkpoint_point, 10);
        // 🛠️ DEBUG — server sync success
        showCenterToast(`[SERVER-OK] "${cpName}" synced ✅ | overspeed:${capturedOverspeedCount}`, 'success', 3000);
        if (cpName !== 'START' && cpName !== 'FINISH') {
          setMarkerColors((prev) => ({ ...prev, [checkpointId]: '#185a9d' })); // blue for synced
        }
        const syncTime = new Date().toLocaleTimeString();
        if (cpName === 'START') {
          // Toast already fired immediately in checkProximityToCheckpoints when suppressStartFinishAlert is true.
          if (!suppressStartFinishAlert) {
            showCenterToast(`🏁 Event Started! Welcome to the rally at ${syncTime}`, 'success');
          }
          addStartCheckpointTime();
        } else {
          const successMessage = `Checkpoint "${cpName}" synced successfully at ${syncTime}`;
          if (voiceAlertsEnabled) {
            const completedCount = Object.values(checkpointStatusRef.current).filter(s => s.completed).length + 1;
            EnhancedVoiceAlertUtils.announceCheckpointComplete(cpName, completedCount, checkpoints.length);
          }
          showCenterToast(successMessage, 'success');
        }
        if (cpName === "FINISH") {
          // Modal already shown immediately in checkProximityToCheckpoints; avoid resetting the countdown.
          if (!suppressStartFinishAlert) {
            setOkayTimeout(30);
            setEventCompletedModal(true);
          }
        }
        return true;
      } else {
        // 🛠️ DEBUG
        showCenterToast(`[CP-FAIL] HTTP:${res.status} | ${data?.status} | ${data?.message || '?'}`, 'error', 3000);
        syncingCheckpointsRef.current.delete(checkpointId);
        setTimeout(() => {
          syncPendingCheckpoints();
        }, 3000);
       
      }
    } catch (err) {
    
      // 🛠️ DEBUG
      showCenterToast(`[CP-ERR] ${err?.message || String(err)}`, 'error', 3000);
      syncingCheckpointsRef.current.delete(checkpointId);
      setTimeout(() => {
        syncPendingCheckpoints();
      }, 3000);
    }
    return false;
  };


  const checkProximityToCheckpoints = (lat, lng, accuracy = 0) => {
    // Reject fixes with poor GPS accuracy to prevent ghost syncs from drift.
    if (accuracy > 30) {
      // 🛠️ DEBUG
      showCenterToast(`[GPS-GATE] accuracy ${Math.round(accuracy)}m > 30m — skipped`, 'warning', 3000);
      return;
    }
    checkpoints.forEach((cp) => {
      // Skip already-completed checkpoints immediately — no distance math, no alert re-trigger.
      if (checkpointStatusRef.current[cp.checkpoint_id]?.completed) return;
      const distance = getDistanceFromLatLonInMeters(
        lat,
        lng,
        parseFloat(cp.latitude),
        parseFloat(cp.longitude)
      );
      const checkpointRadius = (cp.accuracy && !isNaN(parseFloat(cp.accuracy)) && parseFloat(cp.accuracy) > 0)
        ? parseFloat(cp.accuracy)
        : 30;

      // 🛠️ DEBUG — log proximity for every checkpoint (remove if too noisy)
      // showCenterToast(`[PROX] "${cp.checkpoint_name}" dist:${Math.round(distance)}m radius:${checkpointRadius}m`, 'info', 3000);
      if (distance < checkpointRadius) {
        if (!checkpointStatusRef.current[cp.checkpoint_id]?.completed && !syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
          syncingCheckpointsRef.current.add(cp.checkpoint_id);
          const capturedOverspeedCount = overspeedCountRef.current;
          overspeedCountRef.current = 0;
          setOverspeedCount(0);
          persistOverspeedCount(0); // count captured into this checkpoint → reset persisted value for next segment
          isCurrentlyOverspeedRef.current = false;
          lastOverspeedCounterTimestampRef.current = 0;
          speedHistoryRef.current = [];
          if (isOverspeedAlertShownRef.current) {
            isOverspeedAlertShownRef.current = false;
            setIsOverspeedAlertShown(false);
            if (flashAnimationRef.current) {
              flashAnimationRef.current.stop();
              flashAnimationRef.current = null;
            }
            flashAnim.setValue(1);
            try {
              const voiceUtils = EnhancedVoiceAlertUtils;
              if (voiceUtils && typeof voiceUtils.forceStop === 'function') voiceUtils.forceStop();
              SoundUtils.resetAlertCount();
              VibrationSoundUtils.release();
            } catch (e) {}
          }
          const reachedTime = new Date().toLocaleTimeString();
          // 🛠️ DEBUG — checkpoint detected
          showCenterToast(`[CP-DETECTED] "${cp.checkpoint_name}" | overspeed:${capturedOverspeedCount} | time:${reachedTime}`, 'info', 3000);
          // Update the ref synchronously (mirrors MapSimulationScreen) so the START gate
          checkpointStatusRef.current = {
            ...checkpointStatusRef.current,
            [cp.checkpoint_id]: { time: reachedTime, completed: true },
          };
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
            over_speed: capturedOverspeedCount
          });
          // 🛠️ DEBUG — local DB save confirm
          showCenterToast(`[DB-SAVED] "${cp.checkpoint_name}" | overspeed:${capturedOverspeedCount} | event:${event_id}`, 'info', 3000);

          // Fire START/FINISH alert immediately — don't block on server round-trip.
          const cpNameImm = (cp.checkpoint_name || '').trim();
          const cpPointImm = parseInt(cp.checkpoint_point, 10);
          const isStartImm = cpNameImm === 'START' || cpPointImm === 1000;
          const isFinishImm = cpNameImm === 'FINISH' || cpPointImm === 2000;

          if (isStartImm) {
            showCenterToast(`🏁 Event Started! Welcome to the rally at ${reachedTime}`, 'success');
          } else if (isFinishImm) {
            showCenterToast(`🏁 Finish line crossed at ${reachedTime}!`, 'success');
            if (voiceAlertsEnabled) {
              try { EnhancedVoiceAlertUtils.announceEventFinish(checkpoints.length, duration || 'unknown duration'); } catch (e) {}
            }
            setOkayTimeout(30);
            setEventCompletedModal(true);
          }

          syncCheckpointToServer(cp.checkpoint_id, capturedOverspeedCount, isStartImm || isFinishImm);
        } else if (checkpointStatusRef.current[cp.checkpoint_id]?.completed || syncingCheckpointsRef.current.has(cp.checkpoint_id)) {
        }
      }
    });
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

  const generateRandomAbortCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRandomAbortCode(code);
    return code;
  };
  
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
      // Event over → clear timer + overspeed keys so a fresh re-run starts clean.
      await AsyncStorage.multiRemove([
        `event_${event_id}_end_ts`,
        `event_${event_id}_overspeed`,
      ]);
    } catch (error) {
    }
    
    setEventCompletedModal(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Drawer', params: { screen: 'Dashboard' } }],
    });
  };

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
      showCenterToast('Error making SOS call', 'error');
    }
  };

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
      await AsyncStorage.setItem(`event_${event_id}_status`, 'completed');
      // Event aborted → clear live timer + overspeed keys (fresh re-run starts clean).
      await AsyncStorage.multiRemove([
        `event_${event_id}_end_ts`,
        `event_${event_id}_overspeed`,
      ]);

      // Clear location watching
      if (watchId) {
        Geolocation.clearWatch(watchId);
        setWatchId(null);
      }

      if (voiceAlertsEnabled) {
        EnhancedVoiceAlertUtils.announceEventAborted();
      }

      showCenterToast('Event aborted successfully', 'success');

      // Navigate directly to Home screen (no details alert)
      navigation.navigate('Drawer', { screen: 'Dashboard' });
    } catch (error) {
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

      // Use <= 900 instead of === 900 to avoid missing exact tick (GPS/JS timer jitter se miss ho sakta tha)
      if (newRemaining <= 900 && newRemaining > 895 && !fifteenMinuteWarningGiven) {
        setFifteenMinuteWarningGiven(true);
        try {
          SystemSoundUtils.playSystemSound(); // Alarm-style beep
          setTimeout(() => SystemSoundUtils.playSystemSound(), 600); // Double beep
        } catch (error) {
        }
        showCenterToast('⏰ 15 minutes remaining in the event!', 'warning');
        if (voiceAlertsEnabled) {
          try { EnhancedVoiceAlertUtils.announceTimeWarning(15); } catch (e) {}
        }
      }

      if (newRemaining === 0) {
        try {
          SystemSoundUtils.playSystemSound();
          setTimeout(() => SystemSoundUtils.playSystemSound(), 500);
        } catch (error) {
        }
        // Play the actual event-over sound (event_end.mp3 via SoundModule) so time-over has audio, not just vibration — works on both Android and iOS.
        if (voiceAlertsEnabled) {
          try { EnhancedVoiceAlertUtils.announceEventFinish(checkpoints.length, duration || 'unknown duration'); } catch (e) {}
        }
        setOkayTimeout(30);
        setEventCompletedModal(true);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timerReady, fifteenMinuteWarningGiven, voiceAlertsEnabled]);

  // On user gesture, remember the zoom so auto-follow preserves it.
  const handleRegionChange = (region) => {
    if (isProgrammaticMove.current) return;
    isUserTouchingMap.current = true;
    if (!region.latitudeDelta || isNaN(region.latitudeDelta) || region.latitudeDelta <= 0) return;
    userManualZoomRef.current = {
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };
    const zoom = Math.round(Math.log2(360 / region.latitudeDelta));
    currentZoomLevelRef.current = Math.max(15, Math.min(20, zoom));
  };

  // Fires after any gesture finishes — always capture the final zoom so it sticks.
  const handleRegionChangeComplete = (region) => {
    const wasProgrammatic = isProgrammaticMove.current;
    isProgrammaticMove.current = false;
    isUserTouchingMap.current = false;
    isPanGestureRef.current = false;
    if (!wasProgrammatic) {
      if (!region.latitudeDelta || isNaN(region.latitudeDelta) || region.latitudeDelta <= 0) return;
      userManualZoomRef.current = {
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      };
      const zoom = Math.round(Math.log2(360 / region.latitudeDelta));
      currentZoomLevelRef.current = Math.max(15, Math.min(20, zoom));
    }
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
        EnhancedVoiceAlertUtils.announceEventFinish(checkpoints.length, duration || 'unknown duration');
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
        EnhancedVoiceAlertUtils.cleanup();
      } catch (error) {
      }
    };
  }, [watchId]);

  const restoreEventData = useCallback(() => {
    if (!event_id) return;

    // 🛠️ DEBUG
    showCenterToast(`[BG-RESTORE] App foregrounded — reloading DB checkpoints`, 'info', 3000);

    getCompletedCheckpointsForEvent(event_id, (completedCheckpoints) => {
      const previousCheckpointStatus = {};
      const restoredMarkerColors = {};
      completedCheckpoints.forEach((checkpoint) => {
        previousCheckpointStatus[checkpoint.checkpoint_id] = {
          time: checkpoint.time_stamp,
          completed: true
        };
        const cpPoint = parseInt(checkpoint.checkpoint_point, 10);
        const cpName = checkpoint.checkpoint_name || '';
        const isFixed = cpPoint === 1000 || cpPoint === 2000
          || cpName === 'START' || cpName === 'FINISH';
        if (!isFixed) {
          restoredMarkerColors[checkpoint.checkpoint_id] = '#185a9d';
        }
      });

      if (Object.keys(previousCheckpointStatus).length > 0) {
        checkpointStatusRef.current = { ...checkpointStatusRef.current, ...previousCheckpointStatus };
        setCheckpointStatus((prev) => ({ ...prev, ...previousCheckpointStatus }));
        setMarkerColors((prev) => ({ ...prev, ...restoredMarkerColors }));
        // 🛠️ DEBUG
        const names = completedCheckpoints.map(c => c.checkpoint_name).join(', ');
        showCenterToast(`[BG-RESTORE-OK] ${completedCheckpoints.length} checkpoints: ${names}`, 'success', 3000);
      } else {
        // 🛠️ DEBUG
        showCenterToast(`[BG-RESTORE-EMPTY] No checkpoints found in DB`, 'warning', 3000);
      }
    });

    AsyncStorage.getItem(`event_${event_id}_overspeed`).then((saved) => {
      if (saved != null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val > 0) {
          overspeedCountRef.current = val;
          setOverspeedCount(val);
          // 🛠️ DEBUG
          showCenterToast(`[BG-OVERSPEED] Restored overspeed count: ${val}`, 'info', 3000);
        }
      }
    }).catch((err) => {
      // 🛠️ DEBUG
      showCenterToast(`[BG-OVERSPEED-ERR] ${err?.message || 'AsyncStorage failed'}`, 'error', 3000);
    });
  }, [event_id]);

  // Start the GPS watch on mount so marker/route/checkpoint/speed are live immediately.
  useEffect(() => {
    startFollowingUserLocation();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        // 🛠️ DEBUG
        showCenterToast(`[APP-BG] App going to background — animations stopped`, 'info', 3000);
        // Stop looping animations — running Animated.loop in background can cause memory leaks.
        if (flashAnimationRef.current) {
          flashAnimationRef.current.stop();
          flashAnimationRef.current = null;
        }
      }

      if (nextState === 'active') {
        // Restart overspeed flash if it was active before backgrounding.
        if (isOverspeedAlertShownRef.current && !flashAnimationRef.current) {
          flashAnimationRef.current = Animated.loop(
            Animated.sequence([
              Animated.timing(flashAnim, { toValue: 0.15, duration: 350, useNativeDriver: true }),
              Animated.timing(flashAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
            ])
          );
          flashAnimationRef.current.start();
        }
        startFollowingUserLocation();
        restoreEventData();
        // Resume recovery: grab an immediate one-shot fix when app returns to foreground.
        ensureLocationPermission().then((hasPermission) => {
          if (!hasPermission) return;
          Geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords;
              const smoothed = smoothGPSCoordinates(latitude, longitude, accuracy);
              setLastUserLocation(smoothed);
              setUserRoute((prev) => [...prev, smoothed]);
              if (isFollowingUserRef.current && mapRef.current && !isUserTouchingMap.current) {
                try {
                  isProgrammaticMove.current = true;
                  mapRef.current.animateCamera(
                    { center: { latitude: smoothed.latitude, longitude: smoothed.longitude }, zoom: currentZoomLevelRef.current },
                    { duration: 300 }
                  );
                } catch (e) {
                  isProgrammaticMove.current = false;
                }
              }
              checkProximityToCheckpoints(smoothed.latitude, smoothed.longitude, accuracy);
            },
            () => {},
            GEO_HIGH_ACCURACY_OPTS
          );
        });
      }
    });
    return () => {
      try { sub.remove(); } catch (e) {}
    };
  }, [restoreEventData]);

  // Single permission helper used by every Geolocation call below.
  const ensureLocationPermission = async () => {
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
    // iOS — returns 'granted' | 'denied' | 'restricted' | 'disabled'.
    const status = await Geolocation.requestAuthorization('whenInUse');
    return status === 'granted';
  };

  // Shared high-accuracy geolocation options. distanceFilter:3 prevents JS-thread flood at speed; maximumAge:2000 avoids re-rendering on stale fixes.
  const GEO_HIGH_ACCURACY_OPTS = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 2000,
    distanceFilter: 3,
    forceRequestLocation: true,
    forceLocationManager: false,
    showLocationDialog: true,
    interval: 1000,
    fastestInterval: 500,
    // iOS: keep GPS alive when app is backgrounded / screen locked (needs UIBackgroundModes:location in Info.plist). Ignored on Android.
    allowsBackgroundLocationUpdates: true,
    pausesLocationUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  };

  // Function to start following user location
  const startFollowingUserLocation = () => {
    // Stop any existing watch
    if (watchId) {
      Geolocation.clearWatch(watchId);
    }

    ensureLocationPermission().then((hasPermission) => {
      if (!hasPermission) {
        showCenterToast('Location permission denied', 'error');
        return;
      }

      const id = Geolocation.watchPosition(
        (position) => {
          // 🛠️ DEBUG — first fix only
          if (!debugFirstFixShownRef.current) {
            debugFirstFixShownRef.current = true;
            showCenterToast(`[GPS-FIX] accuracy:${Math.round(position.coords.accuracy)}m speed:${Math.round((position.coords.speed || 0) * 3.6)}kmh`, 'info', 3000);
          }
          // Drop low-quality fixes — satellite lag causes off-road jumps above 25m accuracy.
          if (position.coords.accuracy > 25) {
            // 🛠️ DEBUG
            showCenterToast(`[GPS-DROP] accuracy ${Math.round(position.coords.accuracy)}m > 25m`, 'warning', 3000);
            return;
          }
          const { latitude, longitude, heading, accuracy } = position.coords;
          const previousRaw = previousRawLocationRef.current || { latitude, longitude };

          // 🛠️ DEBUG — off-road diagnosis
          const rawJump = getDistanceFromLatLonInMeters(
            previousRaw.latitude, previousRaw.longitude, latitude, longitude
          );
          if (rawJump > 50) {
            // Big GPS jump — likely cause of off-road
            showCenterToast(
              `[OFF-ROAD⚠️] Raw jump ${Math.round(rawJump)}m in 1 tick! acc:${Math.round(accuracy)}m — smoother applying heavy correction`,
              'error', 3000
            );
          } else if (rawJump > 20) {
            showCenterToast(
              `[GPS-JUMP] ${Math.round(rawJump)}m jump detected | acc:${Math.round(accuracy)}m`,
              'warning', 3000
            );
          }

          const smoothedLocation = smoothGPSCoordinates(latitude, longitude, accuracy);

          // 🛠️ DEBUG — how much did smoother correct?
          const smoothCorrection = getDistanceFromLatLonInMeters(
            smoothedLocation.latitude, smoothedLocation.longitude, latitude, longitude
          );
          if (smoothCorrection > 15) {
            showCenterToast(
              `[SMOOTH-CORRECTION] ${Math.round(smoothCorrection)}m correction applied | raw→smooth`,
              'warning', 3000
            );
          }

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
          if (typeof position.coords.speed === 'number' && !isNaN(position.coords.speed)) {
            const speedKmh = Math.round(position.coords.speed * 3.6);
            checkSpeedLimit(speedKmh);
          }
          if (isFollowingUserRef.current && mapRef.current && !isUserTouchingMap.current) {
            try {
              isProgrammaticMove.current = true;
              mapRef.current.animateCamera(
                {
                  center: {
                    latitude: smoothedLocation.latitude,
                    longitude: smoothedLocation.longitude,
                  },
                  zoom: currentZoomLevelRef.current,
                },
                { duration: 400 }
              );
            } catch (error) {
              isProgrammaticMove.current = false;
            }
          }
          
          checkProximityToCheckpoints(smoothedLocation.latitude, smoothedLocation.longitude, accuracy);
          // ✅ FIX: isFollowingUser state yahan SET mat karo — stale closure se dobara ON ho jaata tha
        },
        (error) => {
          let msg = 'Location error';
          if (error && error.message) msg += ': ' + error.message;
          if (error && error.code) msg += ` (code: ${error.code})`;
          showCenterToast(msg, 'error');
          isFollowingUserRef.current = false; // ✅ Stop immediately
          setIsFollowingUser(false);
        },
        GEO_HIGH_ACCURACY_OPTS
      );
      // 🛠️ DEBUG
      showCenterToast(`[GPS-WATCH] Started watchId:${id}`, 'info', 3000);
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

  // One-shot recenter-to-current-GPS helper (recenter button + My Location tab).
  const fetchAndCenterOnCurrentLocation = async ({ successToast, enableFollow, resetRoute }) => {
    // Needs an explicit location-permission grant on both platforms before a fix.
    const hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      showCenterToast('Location permission denied', 'error');
      return;
    }
    showCenterToast('Getting your location...', 'info');
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (mapRef.current) {
          try {
            // Mark this camera move as programmatic so the region handler ignores it.
            isProgrammaticMove.current = true;
            isUserTouchingMap.current = false;
            isPanGestureRef.current = false;
            currentZoomLevelRef.current = 17;
            // Street-level zoom (≈ Google Maps navigation default) facing direction of travel.
            mapRef.current.animateCamera(
              { center: { latitude, longitude }, heading: userHeading, zoom: 17 },
              { duration: 800 }
            );
            // Remember this as the user's preferred zoom delta for subsequent auto-follow ticks.
            userManualZoomRef.current = { latitudeDelta: 0.005, longitudeDelta: 0.005 };
          } catch (error) {
            isProgrammaticMove.current = false;
            showCenterToast('Error centering map', 'error');
          }
        }
        setLastUserLocation({ latitude, longitude });
        if (resetRoute) setUserRoute([{ latitude, longitude }]);
        // Always (re)start the GPS watch so live tracking is active from now on.
        startFollowingUserLocation();
        if (enableFollow) {
          isFollowingUserRef.current = true;
          setIsFollowingUser(true);
        }
        if (successToast) showCenterToast(successToast, 'success');
      },
      (error) => {
        let msg = 'Location error';
        if (error && error.message) msg += ': ' + error.message;
        showCenterToast(msg, 'error');
      },
      GEO_HIGH_ACCURACY_OPTS
    );
  };

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
          Speed: {currentSpeed}/{speedLimit} km/h
          {isOverspeedAlertShown && ' ⚠️'}
        </Text>
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
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}  // Now uses Google Maps on both platforms
        style={styles.map}
        initialRegion={getBoundingRegion(checkpoints)}
        mapType={mapType}
        showsUserLocation={false}
        followsUserLocation={false}
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
        {lastUserLocation && (
          <UserCarMarker coordinate={lastUserLocation} heading={userHeading} speed={currentSpeed} />
        )}
        {checkpoints.map((cp) => (
          <CheckpointPin
            key={`${cp.checkpoint_id}-${checkpointStatus[cp.checkpoint_id]?.completed ? 'completed' : 'pending'}`}
            checkpoint={cp}
            completed={!!checkpointStatus[cp.checkpoint_id]?.completed}
          />
        ))}
      </MapView>
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
              currentZoomLevelRef.current = 20;
              userManualZoomRef.current = { latitudeDelta: 0.0006, longitudeDelta: 0.0006 };
              mapRef.current.animateCamera({
                center: {
                  latitude: lastUserLocation.latitude,
                  longitude: lastUserLocation.longitude,
                },
                zoom: 20,
                heading: userHeading,
                pitch: 0,
              }, { duration: 600 });

              const wasAlreadyFollowing = isFollowingUser;
              if (!wasAlreadyFollowing) {
                startFollowingUserLocation();
              }
              isFollowingUserRef.current = true;
              setIsFollowingUser(true);
              if (!wasAlreadyFollowing) {
                showCenterToast('Following your location', 'info');
              }
            } catch (error) {
              isProgrammaticMove.current = false;
              showCenterToast('Error centering map', 'error');
            }
          } else {
            // No fix yet — recenter button: fetch + center + enable auto-follow.
            fetchAndCenterOnCurrentLocation({
              successToast: 'Following your location',
              enableFollow: true,
              resetRoute: false,
            });
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
              if (lastUserLocation && mapRef.current) {
                try {
                  isProgrammaticMove.current = true;
                  isUserTouchingMap.current = false;
                  isPanGestureRef.current = false;
                  mapRef.current.animateCamera(
                    {
                      center: {
                        latitude: lastUserLocation.latitude,
                        longitude: lastUserLocation.longitude,
                      },
                      zoom: currentZoomLevelRef.current,
                    },
                    { duration: 500 }
                  );
                } catch (error) {
                  isProgrammaticMove.current = false;
                }
              }
            } else {
              // My Location tab: fetch + center + start the route trail.
              fetchAndCenterOnCurrentLocation({
                successToast: 'Location found and tracking started!',
                enableFollow: false,
                resetRoute: true,
              });
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

      <CheckpointHistoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        checkpoints={checkpoints}
        checkpointStatus={checkpointStatus}
      />

      <EventCompletedModal
        visible={eventCompletedModal}
        checkpoints={checkpoints}
        checkpointStatus={checkpointStatus}
        okayTimeout={okayTimeout}
        onConfirm={handleEventCompletion}
      />

      <AbortPasswordModal
        visible={abortPasswordModal}
        abortCode={randomAbortCode}
        enteredCode={enteredAbortCode}
        onEnteredCodeChange={setEnteredAbortCode}
        onRegenerate={generateRandomAbortCode}
        onCancel={() => { setAbortPasswordModal(false); setEnteredAbortCode(""); }}
        onConfirm={handleAbortEventPassword}
        loading={abortLoading}
      />

      <Toast />
    </View>
  );
};

export default MapScreen;
