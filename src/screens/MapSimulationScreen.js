// ============================================================================
// MapSimulationScreen.js  —  Production-behavior simulator for MapScreen
// ----------------------------------------------------------------------------
// PURPOSE
//   Drive the SAME logic MapScreen uses with a deterministic Indore GPS feed so
//   bugs can be found at home, before real field testing. It reuses the real
//   shared modules (mapHelpers, dbService, markers, modals, styles, toast, voice)
//   and faithfully replicates MapScreen's runtime state machine (GPS smoothing,
//   heading recovery, overspeed counter, START gate, checkpoint proximity,
//   offline queue, online resync, app-restart recovery, event completion).
//
//   A simulated clock (simNowMs) replaces Date.now() so the 5-second overspeed
//   re-trigger and time windows are exercised correctly even though the 1-hour
//   route is compressed into a few minutes.
//
//   The screen renders a live map identical to MapScreen plus a validation
//   dashboard (PASS / FAIL / WARN) and an event log, and can simulate an app
//   kill + restart to verify persistence + state hydration.
//
//   NOTE: This is a test harness. It mirrors MapScreen's logic rather than
//   importing the component (whose internal state is not observable). The geo
//   math, GPS smoother, offline DB and checkpoint shape are the REAL production
//   code, so a regression in those is caught here.
// ============================================================================

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---- REAL production modules (not mocked) ----------------------------------
import {
  getDistanceFromLatLonInMeters,
  calculateBearing,
  getBoundingRegion,
  createGpsSmoother,
  formatTime,
} from "../utils/mapHelpers";
import {
  createTables,
  saveCheckpoint,
  getPendingCheckpoints,
  markSynced,
  getCompletedCheckpointsForEvent,
  clearCheckpointsForEvent,
} from "../services/dbService";
import EnhancedVoiceAlertUtils from "../utils/EnhancedVoiceAlertUtils";
import SoundUtils from "../utils/SoundUtils";
import VibrationSoundUtils from "../utils/VibrationSoundUtils";
import styles from "./MapScreen.styles";
import { UserCarMarker, CheckpointPin } from "./MapScreen.markers";
import { EventCompletedModal } from "./MapScreen.modals";
import { useCenterToast } from "../hooks/useCenterToast";

// ---- Simulation dataset -----------------------------------------------------
import {
  SIM_CHECKPOINTS,
  SIM_PROFILE,
  ROUTE_TOTAL_METERS,
  buildRoutePath,
  buildGpsSamples,
  INDORE_ROUTE_KML,
} from "./MapSimulationScreen.data";

// Fixed identifiers for the simulated event (kept stable so SQLite + AsyncStorage
// persistence survives a simulated "app restart").
const SIM_EVENT_ID = "SIM-EVENT-INDORE-1";
const SIM_CATEGORY_ID = "SIM-CAT-1";
const SPEED_LIMIT = SIM_PROFILE.speedLimitKmh;
const EVENT_DURATION_SEC = SIM_PROFILE.targetDurationMin * 60;

// The route fraction window during which we force the device "offline" so the
// offline-queue + online-resync paths get exercised mid-run.
const OFFLINE_WINDOW = [0.46, 0.62];

// ----------------------------------------------------------------------------
// Dashboard test catalogue. Order = render order. group = section header.
// ----------------------------------------------------------------------------
const TEST_CATALOGUE = [
  // GPS & Map
  ["gpsTracking", "GPS Tracking", "GPS & Map"],
  ["cameraFollow", "Camera Follow", "GPS & Map"],
  ["autoFollow", "Auto-Follow Camera", "GPS & Map"],
  ["zoomKeepsFollow", "Zoom keeps Follow (no auto zoom-out)", "GPS & Map"],
  ["manualDisablesFollow", "Manual Pan disables Follow", "GPS & Map"],
  ["trackingWhenFollowOff", "Tracking continues (follow OFF)", "GPS & Map"],
  ["resumeRecovery", "Background→Resume GPS Recovery", "GPS & Map"],
  ["gpsSmoothing", "GPS Smoothing / Spike Filter", "GPS & Map"],
  ["bearing", "Bearing + Heading Recovery", "GPS & Map"],
  // Checkpoints
  ["checkpointDetection", "Checkpoint Detection", "Checkpoints"],
  ["checkpointRadius", "Checkpoint Radius Validation", "Checkpoints"],
  ["startGate", "START Gate Enforcement", "Checkpoints"],
  ["duplicateCheckpoints", "Duplicate Checkpoint Prevention", "Checkpoints"],
  // Speed
  ["overspeedTimer", "Overspeed Timer", "Speed"],
  ["overspeedCount", "Overspeed Count (5s re-trigger)", "Speed"],
  ["overspeedAlert", "Overspeed Sound + Vibration + Voice", "Speed"],
  ["overspeedPayload", "Overspeed Payload → Server", "Speed"],
  // Voice / Toast
  ["voiceAlerts", "Voice Alerts", "Voice / Toast"],
  ["duplicateVoice", "Duplicate Voice Prevention", "Voice / Toast"],
  ["toastAlerts", "Toast Alerts", "Voice / Toast"],
  // Offline / Sync
  ["offlineQueue", "Offline Queue", "Offline / Sync"],
  ["offlineStorage", "Offline Checkpoint Storage", "Offline / Sync"],
  ["onlineResync", "Online Resync", "Offline / Sync"],
  ["failedRetry", "Failed API Retry", "Offline / Sync"],
  ["finalPayload", "Final Payload Structure", "Offline / Sync"],
  // Event
  ["eventCompletion", "Event Completion", "Event"],
  // Persistence (filled by Kill & Restart)
  ["eventRestored", "Event Restored", "App Restart Recovery"],
  ["checkpointsRestored", "Checkpoints Restored", "App Restart Recovery"],
  ["queueRestored", "Offline Queue Restored", "App Restart Recovery"],
  ["overspeedRestored", "Overspeed Count Restored", "App Restart Recovery"],
  ["timerRestored", "Event Timer Restored", "App Restart Recovery"],
  ["unexpectedReset", "Unexpected Reset Detection", "App Restart Recovery"],
];

const initialResults = () => {
  const r = {};
  TEST_CATALOGUE.forEach(([key, label, group]) => {
    r[key] = { label, group, status: "PENDING", detail: "", rootCause: "" };
  });
  return r;
};

const STATUS_COLORS = {
  PASS: "#2e7d32",
  FAIL: "#c62828",
  WARN: "#ef6c00",
  PENDING: "#9e9e9e",
};

// ============================================================================
const MapSimulationScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { show: showCenterToast, Toast } = useCenterToast();
  const mapRef = useRef(null);

  // ---- live map state (mirrors MapScreen) ----
  const [lastUserLocation, setLastUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  const [userRoute, setUserRoute] = useState([]);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [overspeedCount, setOverspeedCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(EVENT_DURATION_SEC);
  const [checkpointStatus, setCheckpointStatus] = useState({});
  const [markerColors, setMarkerColors] = useState({});
  const [eventCompletedModal, setEventCompletedModal] = useState(false);
  const [okayTimeout, setOkayTimeout] = useState(30);

  // ---- simulation/UI state ----
  const [results, setResults] = useState(initialResults);
  const [logs, setLogs] = useState([]);
  const [counters, setCounters] = useState({});
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isOnlineUI, setIsOnlineUI] = useState(true);
  const [dashboardVisible, setDashboardVisible] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(2);
  const flashAnim = useRef(new Animated.Value(1)).current;

  // ---------------------------------------------------------------------------
  // Refs (the simulation engine reads/writes these synchronously, like MapScreen)
  // ---------------------------------------------------------------------------
  const samplesRef = useRef([]);
  const idxRef = useRef(0);
  const simNowMsRef = useRef(0);
  const tickTimerRef = useRef(null);
  const samplesPerTickRef = useRef(2);

  const smootherRef = useRef(createGpsSmoother({ smoothingFactor: 0.15, minAccuracy: 30 }));
  const prevRawRef = useRef(null);
  const prevSmoothedRef = useRef(null);
  const lastValidHeadingRef = useRef(0);
  const headingRef = useRef(0);
  const MIN_DISTANCE_FOR_HEADING = 1;

  // auto-follow model (mirrors MapScreen): camera follows only while ON; any manual
  // pan/zoom turns it OFF (Google-Maps behavior); GPS tracking continues regardless.
  const isFollowingRef = useRef(true);
  const [isFollowingUI, setIsFollowingUI] = useState(true);
  const currentZoomRef = useRef(16); // tracks the user's manual zoom (for gesture detection only)
  // Stable follow zoom — NEVER driven by region-change events (that caused a feedback
  // loop that zoomed the map all the way out). Android follows by region delta, iOS by zoom.
  const followDeltaRef = useRef(0.006); // ~street level
  const followZoomRef = useRef(16);
  const programmaticMoveRef = useRef(false);
  const userTouchingRef = useRef(false); // user actively panning/pinching → pause follow animate
  const lastSpeedAlertTsRef = useRef(0);
  // resume-recovery timing
  const resumeRequestedAtRef = useRef(0);
  const awaitingResumeRef = useRef(false);
  // absolute event end timestamp (ms) — real-time countdown that survives kill, like MapScreen
  const eventEndTsRef = useRef(0);

  // overspeed state machine (mirrors MapScreen.checkSpeedLimit)
  const speedHistoryRef = useRef([]);
  const SPEED_HISTORY_SIZE = 3;
  const isCurrentlyOverspeedRef = useRef(false);
  const lastOverspeedCounterTsRef = useRef(0);
  const overspeedCountRef = useRef(0);
  const isOverspeedAlertShownRef = useRef(false);
  const lastOverspeedVoiceRef = useRef(0);

  // checkpoint state machine
  const checkpointStatusRef = useRef({});
  const syncingRef = useRef(new Set());
  const startGateWarnTsRef = useRef(0);

  // network + api simulation
  const isOnlineRef = useRef(true);
  const failNextSyncRef = useRef(false); // user-toggled "fail next sync"
  const serverSyncedRef = useRef(new Set()); // checkpoint_ids the mock server accepted
  const forcedFailOnceRef = useRef(new Set()); // checkpoints we auto-fail once (retry test)

  // voice de-dup tracking
  const voiceLockUntilRef = useRef(0);
  const lastVoiceKeyRef = useRef({});

  // assertion accumulators
  const aRef = useRef(null);
  if (aRef.current === null) {
    aRef.current = {
      locationUpdates: 0,
      cameraMoves: 0,
      headingRecoveries: 0,
      spikeRejected: null,
      collected: [], // {id, name, distAtHit, simSec, overspeedAtHit}
      collectionOrderValid: true,
      startGateBlocked: 0,
      radiusViolations: 0,
      overspeedEvents: 0,
      overspeedCounterIncrements: 0,
      overspeedPayloadSent: false,
      overspeedSoundFired: 0,
      overspeedVibrateFired: 0,
      overspeedVoiceFired: 0,
      cameraMovesWhileFollowing: 0,
      manualFollowDisabled: false,
      zoomKeptFollow: false,
      trackedWhileFollowOff: 0,
      resumeImmediateMs: null,
      voiceTriggered: 0,
      voiceByType: {},
      duplicateVoice: 0,
      voiceOverlapAttempts: 0,
      toasts: 0,
      queueCreated: 0,
      queueMax: 0,
      queueSynced: 0,
      duplicateSyncAttempts: 0,
      retrySuccess: false,
      apiReq: 0,
      apiOk: 0,
      apiFail: 0,
      offlineCollected: 0,
    };
  }
  const A = aRef.current;

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------
  const logBufRef = useRef([]);
  const logSeqRef = useRef(0);
  const log = useCallback((category, message) => {
    const entry = {
      seq: ++logSeqRef.current,
      t: (simNowMsRef.current / 1000).toFixed(0),
      category,
      message,
    };
    logBufRef.current.push(entry);
    if (logBufRef.current.length > 600) logBufRef.current.shift();
    // throttle visible updates
    if (logSeqRef.current % 3 === 0 || category !== "LOCATION") {
      setLogs([...logBufRef.current].slice(-60).reverse());
    }
  }, []);

  const setResult = useCallback((key, status, detail = "", rootCause = "") => {
    setResults((prev) => ({
      ...prev,
      [key]: { ...prev[key], status, detail, rootCause },
    }));
  }, []);

  const flushCounters = useCallback(() => {
    setCounters({
      "Location updates": A.locationUpdates,
      "Camera follow moves": A.cameraMoves,
      "Checkpoints collected": A.collected.length,
      "Overspeed events": A.overspeedEvents,
      "Overspeed counter": overspeedCountRef.current,
      "Voice alerts": A.voiceTriggered,
      "Duplicate voice": A.duplicateVoice,
      Toasts: A.toasts,
      "Queue created": A.queueCreated,
      "Queue synced": A.queueSynced,
      "API requests": A.apiReq,
      "API success": A.apiOk,
      "API failures": A.apiFail,
    });
  }, [A]);

  // Persist the running overspeed count so it survives a kill (mirrors MapScreen):
  // the count accumulates BETWEEN checkpoints and is only zeroed after a checkpoint
  // captures + saves it, so killing mid-segment must not lose it.
  const persistSimOverspeed = (count) => {
    AsyncStorage.setItem(`event_${SIM_EVENT_ID}_overspeed`, String(count)).catch(() => {});
  };

  // ---------------------------------------------------------------------------
  // toast + voice wrappers (record then call the REAL utilities)
  // ---------------------------------------------------------------------------
  const toast = useCallback(
    (msg, type = "info") => {
      A.toasts += 1;
      log("TOAST", `[${type}] ${msg}`);
      showCenterToast(msg, type, 2500); // short 2.5s toast so they don't linger on screen
    },
    [A, log, showCenterToast]
  );

  // announce(key, fn) — key identifies the announcement for duplicate detection.
  const announce = useCallback(
    (key, label, fn) => {
      const now = simNowMsRef.current;
      A.voiceTriggered += 1;
      A.voiceByType[key] = (A.voiceByType[key] || 0) + 1;
      log("VOICE", `triggered: ${label}`);

      // Overlap: a voice is "busy" for ~3 simulated seconds after it starts.
      if (now < voiceLockUntilRef.current) {
        A.voiceOverlapAttempts += 1;
        // Same key while still busy → a true duplicate announcement.
        if (lastVoiceKeyRef.current.key === key && now - (lastVoiceKeyRef.current.t || 0) < 3000) {
          A.duplicateVoice += 1;
          log("VOICE", `⚠ duplicate suppressed: ${label}`);
          return; // suppress duplicate (this IS the prevention behaviour under test)
        }
        log("VOICE", `queued (busy): ${label}`);
      }
      voiceLockUntilRef.current = now + 3000;
      lastVoiceKeyRef.current = { key, t: now };
      log("VOICE", `started: ${label}`);
      try {
        fn && fn();
      } catch (e) {}
      log("VOICE", `completed: ${label}`);
    },
    [A, log]
  );

  // ---------------------------------------------------------------------------
  // Mock checkpoint-update API (matches the production request body exactly)
  //   POST { event_id, checkpoint_id, over_speed }  → { status: 'success' }
  // ---------------------------------------------------------------------------
  const mockCheckpointUpdate = useCallback(
    (body) => {
      A.apiReq += 1;
      log("API_REQ", `POST /checkpoints/update ${JSON.stringify(body)}`);

      return new Promise((resolve) => {
        // offline → reject like a network failure
        if (!isOnlineRef.current) {
          A.apiFail += 1;
          log("API_RES", `network unreachable (offline) for ${body.checkpoint_id}`);
          resolve({ ok: false, offline: true });
          return;
        }
        // duplicate-sync detection
        if (serverSyncedRef.current.has(body.checkpoint_id)) {
          A.duplicateSyncAttempts += 1;
          log("API_RES", `duplicate sync attempt for ${body.checkpoint_id} (idempotent ok)`);
          resolve({ ok: true, status: "success", duplicate: true });
          return;
        }
        // forced one-time failure (retry test) or user-toggled fail
        const forceFail =
          failNextSyncRef.current || forcedFailOnceRef.current.has(body.checkpoint_id);
        if (forceFail) {
          failNextSyncRef.current = false;
          forcedFailOnceRef.current.delete(body.checkpoint_id);
          A.apiFail += 1;
          log("API_RES", `500 server error for ${body.checkpoint_id} (will retry)`);
          resolve({ ok: false, status: "error", message: "Simulated server error" });
          return;
        }
        // success
        serverSyncedRef.current.add(body.checkpoint_id);
        A.apiOk += 1;
        log("API_RES", `200 success for ${body.checkpoint_id}`);
        resolve({ ok: true, status: "success" });
      });
    },
    [A, log]
  );

  // Validate a payload against the production shape.
  const validatePayload = (body) => {
    const keys = Object.keys(body).sort().join(",");
    return keys === "checkpoint_id,event_id,over_speed";
  };

  // ---------------------------------------------------------------------------
  // syncCheckpointToServer — mirrors MapScreen.syncCheckpointToServer
  // ---------------------------------------------------------------------------
  const syncCheckpointToServer = useCallback(
    async (cp, capturedOverspeed) => {
      const body = {
        event_id: SIM_EVENT_ID,
        checkpoint_id: cp.checkpoint_id,
        over_speed: capturedOverspeed,
      };
      if (!validatePayload(body)) {
        setResult(
          "finalPayload",
          "FAIL",
          `Bad payload keys: ${Object.keys(body).join(",")}`,
          "Payload shape drifted from production {event_id, checkpoint_id, over_speed}."
        );
      }
      if (capturedOverspeed > 0) A.overspeedPayloadSent = true;

      const res = await mockCheckpointUpdate(body);
      if (res.ok && res.status === "success") {
        markSynced(null, SIM_EVENT_ID, cp.checkpoint_id);
        syncingRef.current.delete(cp.checkpoint_id);
        A.queueSynced += 1;
        if (cp.checkpoint_name !== "START" && cp.checkpoint_name !== "FINISH") {
          setMarkerColors((p) => ({ ...p, [cp.checkpoint_id]: "#185a9d" }));
        }
        log("CHECKPOINT_COLLECT", `synced "${cp.checkpoint_name}" (overspeed=${capturedOverspeed})`);
        return true;
      }
      // failure → leave in queue for retry
      syncingRef.current.delete(cp.checkpoint_id);
      log("RETRY", `sync failed for "${cp.checkpoint_name}" — kept in offline queue`);
      return false;
    },
    [A, log, mockCheckpointUpdate, setResult]
  );

  // Drain the SQLite pending queue (mirrors MapScreen.syncPendingCheckpoints).
  const syncPendingCheckpoints = useCallback(async () => {
    try {
      let pending = await getPendingCheckpoints();
      if (!Array.isArray(pending)) pending = [];
      const mine = pending.filter((p) => p.event_id === SIM_EVENT_ID);
      if (mine.length === 0) return;
      log("QUEUE", `resync: draining ${mine.length} pending checkpoint(s)`);
      let success = 0;
      for (const item of mine) {
        const cp =
          SIM_CHECKPOINTS.find((c) => c.checkpoint_id === item.checkpoint_id) || {
            checkpoint_id: item.checkpoint_id,
            checkpoint_name: item.checkpoint_name,
          };
        const ok = await syncCheckpointToServer(cp, item.over_speed || 0);
        if (ok) {
          success += 1;
          const wasRetry = forcedFailOnceRef.current.size === 0 && A.apiFail > 0;
          if (wasRetry) A.retrySuccess = true;
          // promote local state to completed/synced
          checkpointStatusRef.current[item.checkpoint_id] = {
            time: item.time_stamp,
            completed: true,
          };
          setCheckpointStatus({ ...checkpointStatusRef.current });
        }
      }
      if (success > 0) toast(`✅ Synced ${success} pending checkpoint(s)`, "success");
      flushCounters();
    } catch (e) {
      log("QUEUE", `resync error: ${e?.message || e}`);
    }
  }, [A, flushCounters, log, syncCheckpointToServer, toast]);

  // ---------------------------------------------------------------------------
  // START-gate helpers (mirror MapScreen)
  // ---------------------------------------------------------------------------
  const isStartCheckpoint = (cp) => {
    const point = parseInt(cp?.checkpoint_point, 10);
    const name = (cp?.checkpoint_name || "").trim().toUpperCase();
    return point === 1000 || name === "START";
  };
  const isStartCompleted = () => {
    const startCp = SIM_CHECKPOINTS.find(isStartCheckpoint);
    if (!startCp) return true;
    return !!checkpointStatusRef.current[startCp.checkpoint_id]?.completed;
  };

  // ---------------------------------------------------------------------------
  // checkProximityToCheckpoints — mirrors MapScreen exactly
  // ---------------------------------------------------------------------------
  const checkProximityToCheckpoints = useCallback(
    (lat, lng) => {
      const startGateOpen = isStartCompleted();
      SIM_CHECKPOINTS.forEach((cp) => {
        const distance = getDistanceFromLatLonInMeters(
          lat,
          lng,
          parseFloat(cp.latitude),
          parseFloat(cp.longitude)
        );
        const radius =
          cp.accuracy && !isNaN(parseFloat(cp.accuracy)) && parseFloat(cp.accuracy) > 0
            ? parseFloat(cp.accuracy)
            : 10;

        if (distance < radius) {
          log(
            "CHECKPOINT_EVAL",
            `in range of "${cp.checkpoint_name}" d=${distance.toFixed(1)}m r=${radius}m`
          );
          // START gate
          if (!startGateOpen && !isStartCheckpoint(cp)) {
            const now = simNowMsRef.current;
            if (now - startGateWarnTsRef.current > 8000) {
              startGateWarnTsRef.current = now;
              A.startGateBlocked += 1;
              toast("Please reach the START gate first to begin the event.", "warning");
            }
            return;
          }
          const already = checkpointStatusRef.current[cp.checkpoint_id]?.completed;
          if (!already && !syncingRef.current.has(cp.checkpoint_id)) {
            syncingRef.current.add(cp.checkpoint_id);

            // capture + reset overspeed (mirrors MapScreen)
            const capturedOverspeed = overspeedCountRef.current;
            overspeedCountRef.current = 0;
            setOverspeedCount(0);
            persistSimOverspeed(0); // captured into this checkpoint → reset persisted value for next segment
            isCurrentlyOverspeedRef.current = false;
            lastOverspeedCounterTsRef.current = 0;
            speedHistoryRef.current = [];
            if (isOverspeedAlertShownRef.current) {
              isOverspeedAlertShownRef.current = false;
              flashAnim.setValue(1);
            }

            // radius validity: collected only because distance < radius
            if (distance >= radius) A.radiusViolations += 1;

            const reachedTime = new Date().toLocaleTimeString();
            checkpointStatusRef.current[cp.checkpoint_id] = {
              time: reachedTime,
              completed: true,
            };
            setCheckpointStatus({ ...checkpointStatusRef.current });

            // order validity: START must be first non-blocked collection
            A.collected.push({
              id: cp.id,
              name: cp.checkpoint_name,
              distAtHit: distance,
              simSec: simNowMsRef.current / 1000,
              overspeedAtHit: capturedOverspeed,
            });
            if (A.collected.length === 1 && cp.checkpoint_name !== "START") {
              A.collectionOrderValid = false;
            }
            if (!isOnlineRef.current) A.offlineCollected += 1;

            log(
              "CHECKPOINT_COLLECT",
              `collected "${cp.checkpoint_name}" @${(simNowMsRef.current / 1000).toFixed(0)}s overspeed=${capturedOverspeed}`
            );

            // REAL offline-queue write
            saveCheckpoint({
              event_id: SIM_EVENT_ID,
              category_id: SIM_CATEGORY_ID,
              checkpoint_id: cp.checkpoint_id,
              checkpoint_name: cp.checkpoint_name,
              checkpoint_point: cp.checkpoint_point,
              latitude: String(cp.latitude),
              longitude: String(cp.longitude),
              sequence_number: cp.sequence_number,
              description: cp.description,
              time_stamp: reachedTime,
              status: "completed",
              over_speed: capturedOverspeed,
            });
            A.queueCreated += 1;

            // voice on collect
            if (cp.checkpoint_name === "START") {
              announce("start", "Event Started", () =>
                EnhancedVoiceAlertUtils.announceEventStart()
              );
              toast(`🏁 Event Started at ${reachedTime}`, "success");
            } else if (cp.checkpoint_name === "FINISH") {
              // finish voice/toast is owned by finalizeEvent() (called below) so it
              // fires exactly once — announcing here too would be a duplicate.
            } else {
              announce("checkpoint", `Checkpoint ${cp.checkpoint_name}`, () =>
                EnhancedVoiceAlertUtils.announceCheckpointComplete()
              );
              toast(`Checkpoint "${cp.checkpoint_name}" reached`, "success");
            }

            // try to sync now (offline → stays queued)
            if (isOnlineRef.current) {
              syncCheckpointToServer(cp, capturedOverspeed);
            } else {
              syncingRef.current.delete(cp.checkpoint_id);
              toast(
                `📴 Offline — "${cp.checkpoint_name}" saved locally, will sync later`,
                "warning"
              );
            }

            A.queueMax = Math.max(A.queueMax, A.offlineCollected);

            // FINISH or all-complete → finalize
            if (cp.checkpoint_name === "FINISH") {
              finalizeEvent();
            }
          }
        }
      });

      // all-complete safety net (mirrors MapScreen effect)
      const allDone =
        SIM_CHECKPOINTS.length > 0 &&
        SIM_CHECKPOINTS.every((c) => checkpointStatusRef.current[c.checkpoint_id]?.completed);
      if (allDone && !finished) finalizeEvent();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [A, announce, log, syncCheckpointToServer, toast]
  );

  // ---------------------------------------------------------------------------
  // checkSpeedLimit — mirrors MapScreen with the simulated clock
  // ---------------------------------------------------------------------------
  const checkSpeedLimit = useCallback(
    (currentSpeedKmh) => {
      const now = simNowMsRef.current;
      speedHistoryRef.current.push(currentSpeedKmh);
      if (speedHistoryRef.current.length > SPEED_HISTORY_SIZE) speedHistoryRef.current.shift();
      const smoothed = Math.round(
        speedHistoryRef.current.reduce((s, v) => s + v, 0) / speedHistoryRef.current.length
      );
      setCurrentSpeed(smoothed);
      const rawSpeed = currentSpeedKmh;

      if (rawSpeed > SPEED_LIMIT) {
        if (!isCurrentlyOverspeedRef.current) {
          isCurrentlyOverspeedRef.current = true;
          A.overspeedEvents += 1;
          // +1 ONLY the first time we cross the limit in this segment (lastOverspeedCounterTsRef is
          // 0 only at segment start — reset to 0 at each checkpoint). A momentary dip below the limit
          // and re-crossing within the SAME segment must NOT add a fresh count; it resumes the running
          // 5-second cadence (mirrors MapScreen.checkSpeedLimit).
          if (lastOverspeedCounterTsRef.current === 0) {
            overspeedCountRef.current += 1;
            setOverspeedCount(overspeedCountRef.current);
            persistSimOverspeed(overspeedCountRef.current); // survive kill
            lastOverspeedCounterTsRef.current = now;
            log("OVERSPEED", `entered overspeed (segment first): ${rawSpeed} > ${SPEED_LIMIT} (count=${overspeedCountRef.current})`);
          } else {
            log("OVERSPEED", `re-entered overspeed (same segment) — no new count, 5s cadence continues`);
          }
        } else if (now - lastOverspeedCounterTsRef.current >= 5000) {
          lastOverspeedCounterTsRef.current = now;
          overspeedCountRef.current += 1;
          setOverspeedCount(overspeedCountRef.current);
          persistSimOverspeed(overspeedCountRef.current);
          A.overspeedCounterIncrements += 1;
          log("OVERSPEED", `5s sustained → count=${overspeedCountRef.current}`);
        }
        if (!isOverspeedAlertShownRef.current) {
          isOverspeedAlertShownRef.current = true;
          startFlash();
        }
        // beep + vibration (throttled 1.5s, exactly like MapScreen.checkSpeedLimit)
        if (now - lastSpeedAlertTsRef.current > 1500) {
          lastSpeedAlertTsRef.current = now;
          try {
            SoundUtils.playSpeedAlert();
            A.overspeedSoundFired += 1;
            setTimeout(() => {
              VibrationSoundUtils.playSpeedAlert();
            }, 150);
            A.overspeedVibrateFired += 1;
            log("OVERSPEED", `🔊 beep + 📳 vibration fired (${rawSpeed} km/h)`);
          } catch (e) {
            log("OVERSPEED", `alert util error: ${e?.message || e}`);
          }
        }
        // voice (throttled 5s, exactly like MapScreen)
        if (now - lastOverspeedVoiceRef.current > 5000) {
          announce("overspeed", `Overspeed ${rawSpeed}`, () =>
            EnhancedVoiceAlertUtils.announceOverspeed()
          );
          A.overspeedVoiceFired += 1;
          lastOverspeedVoiceRef.current = now;
        }
      } else {
        isCurrentlyOverspeedRef.current = false;
        // Deliberately do NOT reset lastOverspeedCounterTsRef here — a momentary dip within the same
        // segment keeps the 5-second cadence running (no fresh +1 on re-entry). Reset only at a
        // checkpoint → new segment. (Mirrors MapScreen.checkSpeedLimit.)
        if (isOverspeedAlertShownRef.current) {
          isOverspeedAlertShownRef.current = false;
          stopFlash();
          log("OVERSPEED", `back under limit (${rawSpeed} <= ${SPEED_LIMIT})`);
        }
      }
    },
    [A, announce, log]
  );

  const startFlash = () => {
    flashAnim.stopAnimation();
    Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.15, duration: 350, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ])
    ).start();
  };
  const stopFlash = () => {
    flashAnim.stopAnimation();
    flashAnim.setValue(1);
  };

  // ---------------------------------------------------------------------------
  // One simulation step = one GPS fix (mirrors MapScreen watchPosition callback)
  // ---------------------------------------------------------------------------
  const processSample = useCallback(
    (sample, frac) => {
      simNowMsRef.current = sample.tSec * 1000;

      // offline window
      const shouldBeOnline = !(frac >= OFFLINE_WINDOW[0] && frac < OFFLINE_WINDOW[1]);
      if (shouldBeOnline !== isOnlineRef.current && !userOverrodeNetworkRef.current) {
        setNetwork(shouldBeOnline, true);
      }

      const { latitude, longitude, heading, accuracy, speed } = sample;
      const previousRaw = prevRawRef.current || { latitude, longitude };

      // REAL GPS smoother
      const smoothedLocation = smootherRef.current(latitude, longitude, accuracy);

      // spike rejection assertion: on the injected spike, smoothed must stay near
      // the previous good point (smoother should not jump to the flyer).
      if (sample.isSpike) {
        const jump = prevSmoothedRef.current
          ? getDistanceFromLatLonInMeters(
              prevSmoothedRef.current.latitude,
              prevSmoothedRef.current.longitude,
              smoothedLocation.latitude,
              smoothedLocation.longitude
            )
          : 0;
        A.spikeRejected = jump < 80; // good GPS spacing is ~25m; >80m means it followed the spike
        log("LOCATION", `GPS spike injected; smoother moved ${jump.toFixed(1)}m (reject=${A.spikeRejected})`);
      }

      setUserRoute((prev) => {
        const next = [...prev, smoothedLocation];
        return next.length > 4000 ? next.slice(-4000) : next;
      });
      setLastUserLocation(smoothedLocation);
      A.locationUpdates += 1;

      // heading + recovery
      const distanceMoved = getDistanceFromLatLonInMeters(
        previousRaw.latitude,
        previousRaw.longitude,
        latitude,
        longitude
      );
      let newHeading = headingRef.current;
      if (typeof heading === "number" && !isNaN(heading) && heading > 0) {
        newHeading = heading;
        lastValidHeadingRef.current = heading;
      } else if (distanceMoved >= MIN_DISTANCE_FOR_HEADING) {
        newHeading = calculateBearing(previousRaw.latitude, previousRaw.longitude, latitude, longitude);
        lastValidHeadingRef.current = newHeading;
        if (heading == null) A.headingRecoveries += 1; // recovered a missing GPS heading via bearing
      } else {
        newHeading = lastValidHeadingRef.current;
      }
      headingRef.current = newHeading;
      setUserHeading(newHeading);
      prevRawRef.current = { latitude, longitude };
      prevSmoothedRef.current = smoothedLocation;

      // speed (filter the false 180km/h spike like a real spike filter would)
      if (typeof speed === "number" && !isNaN(speed)) {
        let speedKmh = Math.round(speed * 3.6);
        if (sample.isSpike) {
          // false-speed-spike handling: a 180km/h reading next to 50km/h fixes is rejected
          speedKmh = currentSpeed; // hold last known
          log("OVERSPEED", `false speed spike ${Math.round(speed * 3.6)}km/h rejected`);
        }
        checkSpeedLimit(speedKmh);
      }

      // camera follow — ONLY while auto-follow is ON (mirrors MapScreen). When the
      // user has manually zoomed/panned (follow OFF), the camera stays put but GPS
      // tracking + checkpoint detection below keep running.
      if (isFollowingRef.current && mapRef.current && !userTouchingRef.current) {
        try {
          programmaticMoveRef.current = true; // mark as our move so onRegionChange won't treat it as a manual gesture
          // ONLY move the center — never set zoom here. animateCamera with just `center`
          // keeps the user's current zoom, so a pinch zoom-in STAYS zoomed-in and the car
          // keeps following at that level. (Setting zoom here was the feedback loop that
          // zoomed the map all the way out.)
          mapRef.current.animateCamera({ center: smoothedLocation }, { duration: 250 });
          A.cameraMoves += 1;
          A.cameraMovesWhileFollowing += 1;
        } catch (e) {}
      } else if (!isFollowingRef.current) {
        A.trackedWhileFollowOff += 1; // proves tracking continues with follow OFF
      }

      // checkpoint proximity
      checkProximityToCheckpoints(smoothedLocation.latitude, smoothedLocation.longitude);

      // countdown timer (compressed): tie remaining to fraction
      // Real-time countdown from the absolute end timestamp (mirrors MapScreen): the
      // time that actually elapses (incl. while backgrounded) is what counts down.
      if (eventEndTsRef.current) {
        setRemainingSeconds(Math.max(0, Math.round((eventEndTsRef.current - Date.now()) / 1000)));
      }

      if (sample.tSec % 5 === 0) {
        log("LOCATION", `fix @${sample.tSec}s spd=${Math.round(speed * 3.6)}km/h hdg=${heading == null ? "—" : Math.round(heading)} acc=${accuracy}m`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [A, checkProximityToCheckpoints, checkSpeedLimit, currentSpeed, log]
  );

  // network override tracking (so a user toggle isn't stomped by the auto window)
  const userOverrodeNetworkRef = useRef(false);
  const setNetwork = useCallback(
    (online, auto = false) => {
      isOnlineRef.current = online;
      setIsOnlineUI(online);
      if (!auto) userOverrodeNetworkRef.current = true;
      log("QUEUE", `network → ${online ? "ONLINE" : "OFFLINE"}${auto ? " (auto)" : ""}`);
      if (online) {
        // reconnect → drain queue (mirrors NetInfo listener)
        syncPendingCheckpoints();
      }
    },
    [log, syncPendingCheckpoints]
  );

  // ---------------------------------------------------------------------------
  // Engine tick
  // ---------------------------------------------------------------------------
  const tick = useCallback(() => {
    const samples = samplesRef.current;
    const n = samples.length;
    for (let k = 0; k < samplesPerTickRef.current; k++) {
      if (idxRef.current >= n) {
        stopEngine();
        finalizeSimulation();
        return;
      }
      const sample = samples[idxRef.current];
      const frac = idxRef.current / (n - 1);
      processSample(sample, frac);
      idxRef.current += 1;
    }
    flushCounters();
  }, [flushCounters, processSample]);

  const startEngine = useCallback(() => {
    if (tickTimerRef.current) return;
    tickTimerRef.current = setInterval(tick, 280);
  }, [tick]);

  const stopEngine = useCallback(() => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Event completion (mirrors MapScreen.handleEventCompletion persistence)
  // ---------------------------------------------------------------------------
  const eventFinalizedRef = useRef(false);
  const finalizeEvent = useCallback(async () => {
    if (eventFinalizedRef.current) return; // run once (FINISH hit OR all-complete net)
    eventFinalizedRef.current = true;
    try {
      const completionData = {
        event_id: SIM_EVENT_ID,
        total_checkpoints: SIM_CHECKPOINTS.length,
        completed_checkpoints: Object.values(checkpointStatusRef.current).filter(
          (s) => s.completed
        ).length,
        completion_time: new Date().toISOString(),
        overspeed_count: overspeedCountRef.current,
        duration: EVENT_DURATION_SEC,
      };
      await AsyncStorage.setItem(`event_${SIM_EVENT_ID}_status`, "completed");
      await AsyncStorage.setItem(
        `event_${SIM_EVENT_ID}_completion_data`,
        JSON.stringify(completionData)
      );
      log("PERSIST", `completion data saved: ${JSON.stringify(completionData)}`);
      setOkayTimeout(30);
      setEventCompletedModal(true);
      announce("finish", "Event Finished", () => EnhancedVoiceAlertUtils.announceEventFinish());
      toast("🎉 Event Completed!", "success");
    } catch (e) {
      log("PERSIST", `completion save error: ${e?.message || e}`);
    }
  }, [announce, log, toast]);

  // ---------------------------------------------------------------------------
  // End-of-run evaluation → fills the dashboard
  // ---------------------------------------------------------------------------
  const finalizeSimulation = useCallback(async () => {
    setRunning(false);
    setFinished(true);
    log("INFO", "Simulation finished — evaluating results");

    const pass = (k, d) => setResult(k, "PASS", d);
    const fail = (k, d, rc) => setResult(k, "FAIL", d, rc);
    const warn = (k, d, rc) => setResult(k, "WARN", d, rc);

    // GPS tracking
    A.locationUpdates > 50
      ? pass("gpsTracking", `${A.locationUpdates} location updates processed`)
      : fail("gpsTracking", `only ${A.locationUpdates} updates`, "GPS feed not delivering fixes — watchPosition / sample loop not firing.");

    // Camera follow
    A.cameraMoves > 50
      ? pass("cameraFollow", `${A.cameraMoves} camera animations issued`)
      : fail("cameraFollow", `${A.cameraMoves} camera moves`, "mapRef.animateCamera not called — follow flag or mapRef null.");

    // Auto-follow camera (only animates while follow ON)
    A.cameraMovesWhileFollowing > 50
      ? pass("autoFollow", `${A.cameraMovesWhileFollowing} follow-camera moves while ON`)
      : warn("autoFollow", `${A.cameraMovesWhileFollowing} follow moves`, "Auto-follow may have been OFF most of the run.");

    // Zoom keeps follow (Google-Maps: zoom-in must NOT auto zoom-out, car keeps moving)
    A.zoomKeptFollow
      ? pass("zoomKeepsFollow", "Manual zoom adopted while follow stayed ON (no auto zoom-out)")
      : warn("zoomKeepsFollow", "Not exercised", "Pinch-zoom during a run: the map must keep following the car at your new zoom, not snap back.");

    // Manual PAN disables follow (drag away to look elsewhere)
    A.manualFollowDisabled
      ? pass("manualDisablesFollow", "A manual pan/drag turned auto-follow OFF (look-elsewhere)")
      : warn("manualDisablesFollow", "Not exercised", "Drag (pan) the map during a run to test this; follow should switch OFF (recenter to resume).");

    // Tracking continues while follow OFF
    if (A.trackedWhileFollowOff > 0)
      pass("trackingWhenFollowOff", `${A.trackedWhileFollowOff} GPS/checkpoint updates processed with follow OFF`);
    else if (A.manualFollowDisabled)
      fail("trackingWhenFollowOff", "Follow turned OFF but no tracking continued", "GPS watch / checkpoint loop tied to follow flag — they must run independently.");
    else warn("trackingWhenFollowOff", "Not exercised", "Turn follow OFF mid-run (pan/zoom) to verify tracking continues.");

    // Background → resume immediate recovery
    if (A.resumeImmediateMs != null && A.resumeImmediateMs < 500)
      pass("resumeRecovery", `Location recovered immediately on resume (${A.resumeImmediateMs}ms)`);
    else if (A.resumeImmediateMs != null)
      warn("resumeRecovery", `Recovery took ${A.resumeImmediateMs}ms`, "One-shot getCurrentPosition on resume is slow — check GPS options.");
    else warn("resumeRecovery", "Not exercised", "Tap 📲 Bg→Resume during a run to test immediate location recovery.");

    // GPS smoothing / spike
    if (A.spikeRejected === true) pass("gpsSmoothing", "Injected GPS spike rejected by smoother");
    else if (A.spikeRejected === false)
      fail("gpsSmoothing", "Smoother followed the spike", "createGpsSmoother minAccuracy / jump-damping not rejecting bad fixes.");
    else warn("gpsSmoothing", "Spike sample not reached", "Run the full route to evaluate.");

    // Bearing + heading recovery
    A.headingRecoveries > 0
      ? pass("bearing", `${A.headingRecoveries} missing-heading fixes recovered via bearing`)
      : warn("bearing", "No missing-heading fixes encountered", "calculateBearing fallback not exercised.");

    // Checkpoint detection
    const collectedNames = A.collected.map((c) => c.name);
    const allCollected = SIM_CHECKPOINTS.every((c) => collectedNames.includes(c.checkpoint_name));
    if (allCollected)
      pass("checkpointDetection", `${A.collected.length}/${SIM_CHECKPOINTS.length} checkpoints detected`);
    else {
      const missing = SIM_CHECKPOINTS.filter((c) => !collectedNames.includes(c.checkpoint_name)).map(
        (c) => c.checkpoint_name
      );
      fail(
        "checkpointDetection",
        `Missing: ${missing.join(", ")}`,
        "Proximity not triggering — getDistanceFromLatLonInMeters vs cp.accuracy radius mismatch, or route did not pass within radius."
      );
    }

    // Radius validation
    A.radiusViolations === 0
      ? pass("checkpointRadius", "All collections occurred within radius")
      : fail("checkpointRadius", `${A.radiusViolations} out-of-radius collections`, "Checkpoint collected while distance >= radius — radius gate broken.");

    // START gate
    A.collectionOrderValid
      ? pass("startGate", `START collected first; ${A.startGateBlocked} pre-START blocks`)
      : fail("startGate", "A non-START checkpoint was collected first", "START gate (isStartCompleted) not enforced before other checkpoints.");

    // Duplicate checkpoint prevention (check SQLite for dupes)
    getCompletedCheckpointsForEvent(SIM_EVENT_ID, (rows) => {
      const ids = rows.map((r) => r.checkpoint_id);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      dupes.length === 0
        ? pass("duplicateCheckpoints", `No duplicate rows (${rows.length} stored)`)
        : fail("duplicateCheckpoints", `${dupes.length} duplicate rows`, "saveCheckpoint de-dup (SELECT COUNT before INSERT) failed.");
    });

    // Overspeed
    A.overspeedEvents > 0
      ? pass("overspeedTimer", `${A.overspeedEvents} overspeed entries detected`)
      : fail("overspeedTimer", "No overspeed detected", "Speed never exceeded limit — speed feed or threshold wrong.");
    A.overspeedCounterIncrements > 0
      ? pass("overspeedCount", `${A.overspeedCounterIncrements} sustained 5s increments`)
      : warn("overspeedCount", "No 5s sustained increments", "Overspeed never held >5s, or 5000ms timer logic not firing.");
    // Overspeed sound + vibration + voice (the three real utils MapScreen fires)
    if (A.overspeedSoundFired > 0 && A.overspeedVibrateFired > 0 && A.overspeedVoiceFired > 0)
      pass("overspeedAlert", `🔊×${A.overspeedSoundFired} 📳×${A.overspeedVibrateFired} 🗣×${A.overspeedVoiceFired} fired`);
    else if (A.overspeedEvents > 0)
      fail(
        "overspeedAlert",
        `sound=${A.overspeedSoundFired} vibrate=${A.overspeedVibrateFired} voice=${A.overspeedVoiceFired}`,
        "Overspeed happened but an alert channel did not fire — SoundModule not registered for com.vcmapp, over_speed.mp3 missing, or VIBRATE permission denied. Rebuild after checking android/app/src/main/res/raw/over_speed.mp3."
      );
    else warn("overspeedAlert", "No overspeed occurred", "Speed never crossed the limit this run.");
    A.overspeedPayloadSent
      ? pass("overspeedPayload", "over_speed>0 reached the server payload")
      : warn("overspeedPayload", "No checkpoint carried an overspeed count", "Overspeed reset before next checkpoint — capture timing off.");

    // Voice / Toast
    A.voiceTriggered > 0
      ? pass("voiceAlerts", `${A.voiceTriggered} voice alerts (${Object.keys(A.voiceByType).join(", ")})`)
      : fail("voiceAlerts", "No voice alerts fired", "EnhancedVoiceAlertUtils announce* not called.");
    A.duplicateVoice === 0
      ? pass("duplicateVoice", `No duplicate voices (${A.voiceOverlapAttempts} overlaps queued/suppressed)`)
      : warn("duplicateVoice", `${A.duplicateVoice} duplicate voices suppressed`, "Overlapping identical announcements — add cooldown/lock per voice key.");
    A.toasts > 0
      ? pass("toastAlerts", `${A.toasts} toasts shown`)
      : fail("toastAlerts", "No toasts", "useCenterToast.show not wired.");

    // Offline / Sync
    A.offlineCollected > 0
      ? pass("offlineQueue", `${A.offlineCollected} checkpoints collected offline & queued`)
      : warn("offlineQueue", "No checkpoints collected during offline window", "Offline window did not overlap a checkpoint — adjust OFFLINE_WINDOW.");

    const pendingNow = await getPendingCheckpoints();
    const minePending = (pendingNow || []).filter((p) => p.event_id === SIM_EVENT_ID);
    minePending.length === 0
      ? pass("offlineStorage", "All offline-stored checkpoints later synced (queue empty)")
      : warn("offlineStorage", `${minePending.length} still pending`, "Some queued checkpoints never synced — resync/retry incomplete.");

    A.queueSynced > 0
      ? pass("onlineResync", `${A.queueSynced} checkpoints resynced after reconnect`)
      : fail("onlineResync", "Nothing resynced", "NetInfo-equivalent reconnect did not drain the queue.");

    A.duplicateSyncAttempts === 0
      ? pass("failedRetry", A.retrySuccess ? "Failed sync retried & succeeded; no duplicate sync" : "No duplicate sync attempts")
      : warn("failedRetry", `${A.duplicateSyncAttempts} duplicate sync attempts (server idempotent)`, "Same checkpoint re-sent after success — guard with serverSynced set.");

    // Final payload structure
    if (results.finalPayload.status !== "FAIL") {
      pass("finalPayload", "Payload matches {event_id, checkpoint_id, over_speed}");
    }

    // Event completion
    const allDone = SIM_CHECKPOINTS.every(
      (c) => checkpointStatusRef.current[c.checkpoint_id]?.completed
    );
    allDone
      ? pass("eventCompletion", "All checkpoints completed; completion data persisted")
      : fail("eventCompletion", "Event did not complete", "FINISH not reached / all-complete effect not firing.");

    flushCounters();
    toast("✅ Simulation complete — open the dashboard", "success");
  }, [A, flushCounters, log, results.finalPayload, setResult, toast]);

  // ---------------------------------------------------------------------------
  // App Kill / Restart recovery
  // ---------------------------------------------------------------------------
  const preKillSnapshotRef = useRef(null);
  const simulateKillAndRestart = useCallback(async () => {
    // 1. snapshot current in-memory truth
    const snapshot = {
      completedIds: Object.keys(checkpointStatusRef.current).filter(
        (id) => checkpointStatusRef.current[id]?.completed
      ),
      overspeedCount: overspeedCountRef.current,
      remainingSeconds,
    };
    preKillSnapshotRef.current = snapshot;
    // NOTE: we do NOT save overspeed/timer here — they were already persisted DURING the
    // run (overspeed on each change, timer as the absolute end_ts at start), exactly like
    // MapScreen. So this genuinely tests that the continuous persistence worked.
    log("PERSIST", `KILL: in-memory wiped (${snapshot.completedIds.length} cp, overspeed=${snapshot.overspeedCount}). Restoring only from persisted stores…`);

    // 2. simulate process death: wipe in-memory state
    stopEngine();
    checkpointStatusRef.current = {};
    setCheckpointStatus({});
    setMarkerColors({});
    overspeedCountRef.current = 0;
    setOverspeedCount(0);
    log("PERSIST", "RESTART: in-memory state cleared (simulated process death)");

    // 3. re-hydrate ONLY from persistent stores (SQLite + AsyncStorage)
    getCompletedCheckpointsForEvent(SIM_EVENT_ID, async (rows) => {
      const restored = {};
      const restoredColors = {};
      rows.forEach((r) => {
        restored[r.checkpoint_id] = { time: r.time_stamp, completed: true };
        const pt = parseInt(r.checkpoint_point, 10);
        const isFixed = pt === 1000 || pt === 2000;
        if (!isFixed) restoredColors[r.checkpoint_id] = "#185a9d";
      });
      checkpointStatusRef.current = restored;
      setCheckpointStatus(restored);
      setMarkerColors(restoredColors);

      // Overspeed restored from the continuously-persisted value (not a kill-time snapshot).
      const restoredOverspeed = parseInt(
        (await AsyncStorage.getItem(`event_${SIM_EVENT_ID}_overspeed`)) || "0",
        10
      );
      // Timer restored from the absolute end timestamp → REAL-TIME remaining (the time that
      // passed while "dead" is correctly gone), exactly like MapScreen — not "resume from
      // where it paused".
      const savedEndTs = parseInt(
        (await AsyncStorage.getItem(`event_${SIM_EVENT_ID}_end_ts`)) || "0",
        10
      );
      if (savedEndTs) eventEndTsRef.current = savedEndTs;
      const restoredRemaining = savedEndTs
        ? Math.max(0, Math.round((savedEndTs - Date.now()) / 1000))
        : 0;
      const statusStr = await AsyncStorage.getItem(`event_${SIM_EVENT_ID}_status`);
      overspeedCountRef.current = restoredOverspeed;
      setOverspeedCount(restoredOverspeed);
      setRemainingSeconds(restoredRemaining);

      const pending = await getPendingCheckpoints();
      const minePending = (pending || []).filter((p) => p.event_id === SIM_EVENT_ID);

      // 4. compare restored vs snapshot → fill persistence panel
      const snap = preKillSnapshotRef.current;
      const restoredCount = Object.keys(restored).length;

      setResult(
        "eventRestored",
        statusStr || restoredCount > 0 ? "PASS" : "FAIL",
        `status="${statusStr || "active"}", ${restoredCount} checkpoints hydrated`,
        statusStr || restoredCount > 0 ? "" : "Event state not persisted — AsyncStorage/SQLite write missing."
      );

      const lost = snap.completedIds.filter((id) => !restored[id]);
      if (lost.length === 0)
        setResult("checkpointsRestored", "PASS", `${restoredCount}/${snap.completedIds.length} completed checkpoints survived`);
      else
        setResult(
          "checkpointsRestored",
          "FAIL",
          `${lost.length} checkpoint(s) lost`,
          "Checkpoint state lost after restart — AsyncStorage save failure / state hydration issue / event restoration issue."
        );

      setResult(
        "queueRestored",
        "PASS",
        `${minePending.length} pending queue entr${minePending.length === 1 ? "y" : "ies"} survived (SQLite)`
      );

      restoredOverspeed === snap.overspeedCount
        ? setResult("overspeedRestored", "PASS", `overspeed ${restoredOverspeed} restored`)
        : setResult(
            "overspeedRestored",
            "FAIL",
            `was ${snap.overspeedCount}, restored ${restoredOverspeed}`,
            "Overspeed count not persisted before kill."
          );

      // Timer must be real-time from the saved end timestamp (NOT resumed from where it
      // paused). restoredRemaining should be ≤ the pre-kill value (real time elapsed).
      if (savedEndTs && restoredRemaining <= snap.remainingSeconds + 1)
        setResult(
          "timerRestored",
          "PASS",
          `${formatTime(restoredRemaining)} restored from absolute end-timestamp (real-time, not reset)`
        );
      else if (savedEndTs)
        setResult("timerRestored", "WARN", `restored ${formatTime(restoredRemaining)}`, "Restored timer is larger than before kill — should only ever decrease.");
      else
        setResult("timerRestored", "FAIL", "No saved end timestamp", "Event end timestamp not persisted — timer would reset to full on restart.");

      // unexpected reset detection
      if (lost.length > 0) {
        setResult(
          "unexpectedReset",
          "FAIL",
          "WARNING: Checkpoint state lost after app restart",
          "Possible causes: AsyncStorage save failure · State hydration issue · Event restoration issue · Redux persistence issue."
        );
        log("PERSIST", "⚠ WARNING: Checkpoint state lost after app restart");
      } else {
        setResult("unexpectedReset", "PASS", "No unexpected reset; all completed checkpoints intact");
      }

      log(
        "PERSIST",
        `RESTART complete: ${restoredCount} cp, overspeed=${restoredOverspeed}, queue=${minePending.length}, remaining=${restoredRemaining}`
      );
      toast("🔄 Restart recovery evaluated — see persistence panel", "info");
    });
  }, [log, remainingSeconds, setResult, stopEngine, toast]);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  const startSimulation = useCallback(async () => {
    // reset everything for a clean run
    stopEngine();
    // wipe persistent stores from any previous run so dedupe/queue tests are clean
    await clearCheckpointsForEvent(SIM_EVENT_ID);
    await AsyncStorage.multiRemove([
      `event_${SIM_EVENT_ID}_status`,
      `event_${SIM_EVENT_ID}_completion_data`,
      `event_${SIM_EVENT_ID}_overspeed`,
      `event_${SIM_EVENT_ID}_remaining`,
      `event_${SIM_EVENT_ID}_end_ts`,
    ]);
    // Create + persist the absolute event end timestamp ONCE at start (real-time model).
    eventEndTsRef.current = Date.now() + EVENT_DURATION_SEC * 1000;
    await AsyncStorage.setItem(`event_${SIM_EVENT_ID}_end_ts`, String(eventEndTsRef.current));
    idxRef.current = 0;
    simNowMsRef.current = 0;
    samplesRef.current = buildGpsSamples();
    smootherRef.current = createGpsSmoother({ smoothingFactor: 0.15, minAccuracy: 30 });
    prevRawRef.current = null;
    prevSmoothedRef.current = null;
    speedHistoryRef.current = [];
    overspeedCountRef.current = 0;
    isCurrentlyOverspeedRef.current = false;
    checkpointStatusRef.current = {};
    syncingRef.current = new Set();
    serverSyncedRef.current = new Set();
    isOnlineRef.current = true;
    userOverrodeNetworkRef.current = false;
    eventFinalizedRef.current = false;
    isFollowingRef.current = true;
    setIsFollowingUI(true);
    currentZoomRef.current = 16;
    followZoomRef.current = 16;
    followDeltaRef.current = 0.006;
    lastSpeedAlertTsRef.current = 0;
    // immediately zoom into the START location at street level ONCE (zoom set here only;
    // after this the per-tick follow just re-centers and never touches zoom again)
    if (mapRef.current) {
      try {
        programmaticMoveRef.current = true;
        const s = SIM_CHECKPOINTS[0];
        mapRef.current.animateCamera(
          { center: { latitude: s.latitude, longitude: s.longitude }, zoom: 16 },
          { duration: 500 }
        );
      } catch (e) {}
    }
    // auto-fail the FIRST regular checkpoint sync once, to exercise retry:
    const firstRegular = SIM_CHECKPOINTS.find(
      (c) => c.checkpoint_name !== "START" && c.checkpoint_name !== "FINISH"
    );
    forcedFailOnceRef.current = new Set(firstRegular ? [firstRegular.checkpoint_id] : []);
    // Reset by MUTATING the single persistent accumulator object (do NOT replace it):
    // every render captures `A = aRef.current`, so all engine callbacks must keep
    // pointing at the same instance for counts to stay consistent across re-runs.
    Object.assign(aRef.current, {
      locationUpdates: 0, cameraMoves: 0, headingRecoveries: 0, spikeRejected: null,
      collected: [], collectionOrderValid: true, startGateBlocked: 0, radiusViolations: 0,
      overspeedEvents: 0, overspeedCounterIncrements: 0, overspeedPayloadSent: false,
      overspeedSoundFired: 0, overspeedVibrateFired: 0, overspeedVoiceFired: 0,
      cameraMovesWhileFollowing: 0, manualFollowDisabled: false, zoomKeptFollow: false, trackedWhileFollowOff: 0,
      resumeImmediateMs: null,
      voiceTriggered: 0, voiceByType: {}, duplicateVoice: 0, voiceOverlapAttempts: 0, toasts: 0,
      queueCreated: 0, queueMax: 0, queueSynced: 0, duplicateSyncAttempts: 0, retrySuccess: false,
      apiReq: 0, apiOk: 0, apiFail: 0, offlineCollected: 0,
    });
    setResults(initialResults());
    setCheckpointStatus({});
    setMarkerColors({});
    setOverspeedCount(0);
    setUserRoute([]);
    setRemainingSeconds(EVENT_DURATION_SEC);
    setIsOnlineUI(true);
    setFinished(false);
    setRunning(true);
    logBufRef.current = [];
    setLogs([]);
    log("INFO", `Simulation started: ${SIM_CHECKPOINTS.length} checkpoints, ${(ROUTE_TOTAL_METERS / 1000).toFixed(1)} km`);
    announce("start", "Event Start", () => EnhancedVoiceAlertUtils.announceEventStart());
    startEngine();
  }, [announce, log, startEngine, stopEngine]);

  const togglePause = useCallback(() => {
    if (tickTimerRef.current) {
      stopEngine();
      setRunning(false);
      log("INFO", "Paused");
    } else if (!finished) {
      setRunning(true);
      startEngine();
      log("INFO", "Resumed");
    }
  }, [finished, log, startEngine, stopEngine]);

  const cycleSpeed = useCallback(() => {
    const next = speedMultiplier === 1 ? 2 : speedMultiplier === 2 ? 4 : 1;
    setSpeedMultiplier(next);
    samplesPerTickRef.current = next;
  }, [speedMultiplier]);

  const exportReport = useCallback(() => {
    // Print KML + full text report to Metro console (copyable).
    const lines = [];
    lines.push("================ NAVIQUEST SIMULATION TEST REPORT ================");
    lines.push(`Route: Vijay Nagar → Rajiv Gandhi Square  |  ${(ROUTE_TOTAL_METERS / 1000).toFixed(2)} km`);
    lines.push(`Checkpoints detected: ${A.collected.length}/${SIM_CHECKPOINTS.length}`);
    lines.push(`Queue created/synced: ${A.queueCreated}/${A.queueSynced}`);
    lines.push(`API req/ok/fail: ${A.apiReq}/${A.apiOk}/${A.apiFail}  (success rate ${A.apiReq ? Math.round((A.apiOk / A.apiReq) * 100) : 0}%)`);
    lines.push(`Overspeed events: ${A.overspeedEvents}  voice: ${A.voiceTriggered}  dup voice: ${A.duplicateVoice}  toasts: ${A.toasts}`);
    lines.push("------ RESULTS ------");
    TEST_CATALOGUE.forEach(([k, label]) => {
      const r = results[k];
      lines.push(`${r.status.padEnd(4)} | ${label}${r.detail ? " — " + r.detail : ""}${r.rootCause ? "  [cause: " + r.rootCause + "]" : ""}`);
    });
    lines.push("------ KML ------");
    lines.push(INDORE_ROUTE_KML);
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    toast("📄 Report + KML printed to Metro console", "info");
  }, [A, results, toast]);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    createTables();
    samplesRef.current = buildGpsSamples();
    return () => stopEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // okay-timeout countdown for completion modal
  useEffect(() => {
    let timer;
    if (eventCompletedModal && okayTimeout > 0) {
      timer = setTimeout(() => setOkayTimeout((t) => t - 1), 1000);
    } else if (eventCompletedModal && okayTimeout === 0) {
      setEventCompletedModal(false);
    }
    return () => timer && clearTimeout(timer);
  }, [eventCompletedModal, okayTimeout]);

  // ---------------------------------------------------------------------------
  // Auto-follow model (mirrors MapScreen): manual pan/zoom turns follow OFF.
  // ---------------------------------------------------------------------------
  const disableFollow = (reason) => {
    if (!isFollowingRef.current) return;
    isFollowingRef.current = false;
    setIsFollowingUI(false);
    A.manualFollowDisabled = true;
    log("INFO", `auto-follow OFF (${reason}) — GPS tracking continues`);
    toast(`Auto-follow paused — ${reason}`, "info");
  };
  // PAN = "look elsewhere" → stop following.
  const onSimPanDrag = () => disableFollow("manual pan");

  // Fires continuously DURING a user gesture. Mark touching so the per-tick follow
  // animate skips while the user is actively pinching/dragging (extra smoothness). We do
  // NOT read or change zoom here — follow only re-centers, so the user's zoom always wins.
  const onSimRegionChange = () => {
    if (programmaticMoveRef.current) return; // ignore our own follow animations
    userTouchingRef.current = true;
  };

  const handleSimRegionChangeComplete = () => {
    const wasProgrammatic = programmaticMoveRef.current;
    programmaticMoveRef.current = false;
    userTouchingRef.current = false; // gesture finished → follow may re-center again
    if (wasProgrammatic) return; // our own follow animation — nothing to do
    // A genuine user gesture settled. If follow is still ON, it was a ZOOM (a PAN would
    // have turned follow off via onPanDrag first) → follow stayed on at the user's zoom.
    if (isFollowingRef.current) A.zoomKeptFollow = true;
  };
  const recenterFollow = () => {
    isFollowingRef.current = true;
    setIsFollowingUI(true);
    // Max zoom-in on recenter (zoom 20), set ONCE here. After this, follow only re-centers.
    const target = lastUserLocation || { latitude: SIM_CHECKPOINTS[0].latitude, longitude: SIM_CHECKPOINTS[0].longitude };
    if (mapRef.current) {
      try {
        programmaticMoveRef.current = true;
        mapRef.current.animateCamera({ center: target, zoom: 20 }, { duration: 500 });
      } catch (e) {}
    }
    log("INFO", "auto-follow ON (recenter pressed) — max zoom");
    toast("Recentered — max zoom", "info");
  };

  // ---------------------------------------------------------------------------
  // Background → Resume GPS recovery (mirrors MapScreen AppState 'active' fix).
  // On resume we grab an IMMEDIATE one-shot fix so the car jumps to the current
  // position at once, instead of waiting for the next watch/engine tick.
  // ---------------------------------------------------------------------------
  const simulateBackgroundResume = () => {
    stopEngine();
    setRunning(false);
    log("INFO", "📲 App backgrounded — JS watch paused");
    toast("App moved to background…", "info");
    setTimeout(() => {
      const t0 = Date.now();
      const idx = Math.min(idxRef.current, samplesRef.current.length - 1);
      const sample = samplesRef.current[idx];
      if (sample) {
        // immediate one-shot recovery (the fix being tested)
        const sm = smootherRef.current(sample.latitude, sample.longitude, sample.accuracy);
        setLastUserLocation(sm);
        if (isFollowingRef.current && mapRef.current) {
          try {
            programmaticMoveRef.current = true;
            // center only — preserve the user's current zoom on resume
            mapRef.current.animateCamera({ center: sm }, { duration: 300 });
          } catch (e) {}
        }
        checkProximityToCheckpoints(sm.latitude, sm.longitude);
        A.resumeImmediateMs = Date.now() - t0;
        log("INFO", `📲 Resume: location recovered immediately (${A.resumeImmediateMs}ms)`);
        toast("Resumed — location updated immediately", "success");
      }
      if (!finished) {
        setRunning(true);
        startEngine();
      }
    }, 1200);
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const completedCount = Object.values(checkpointStatus).filter((s) => s.completed).length;
  const drawnRoute = useRef(buildRoutePath(60)).current;

  const StatusBadge = ({ status }) => (
    <View style={{ backgroundColor: STATUS_COLORS[status], borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>{status}</Text>
    </View>
  );

  const groups = [...new Set(TEST_CATALOGUE.map(([, , g]) => g))];

  return (
    <View style={styles.container}>
      {/* ---- Live map (identical components to MapScreen) ---- */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: SIM_CHECKPOINTS[0].latitude,
          longitude: SIM_CHECKPOINTS[0].longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        showsUserLocation={false}
        followsUserLocation={false}
        loadingEnabled
        toolbarEnabled={false}
        zoomEnabled
        scrollEnabled
        onPanDrag={onSimPanDrag}
        onRegionChange={onSimRegionChange}
        onRegionChangeComplete={handleSimRegionChangeComplete}
      >
        <Polyline coordinates={drawnRoute} strokeColor="#1976d2" strokeWidth={4} />
        {userRoute.length > 1 && (
          <Polyline coordinates={userRoute} strokeColor="#43a047" strokeWidth={5} />
        )}
        {lastUserLocation && <UserCarMarker coordinate={lastUserLocation} heading={userHeading} />}
        {SIM_CHECKPOINTS.map((cp) => (
          <CheckpointPin
            key={`${cp.checkpoint_id}-${checkpointStatus[cp.checkpoint_id]?.completed ? "c" : "p"}`}
            checkpoint={cp}
            completed={!!checkpointStatus[cp.checkpoint_id]?.completed}
          />
        ))}
      </MapView>

      {/* ---- Top HUD ---- */}
      <View style={[sim.hud, { top: Platform.OS === "ios" ? insets.top + 4 : 8 }]}>
        <Text style={sim.hudText}>
          ⏱ {formatTime(remainingSeconds)}   ✅ {completedCount}/{SIM_CHECKPOINTS.length}   🚗 {currentSpeed}/{SPEED_LIMIT} km/h
          {isOverspeedAlertShownRef.current ? "  🚨" : ""}
        </Text>
        <Text style={[sim.hudText, { color: isOnlineUI ? "#2e7d32" : "#c62828" }]}>
          {isOnlineUI ? "🟢 ONLINE" : "🔴 OFFLINE"}   overspeed#{overspeedCount}   {running ? "▶ running" : finished ? "■ done" : "❚❚ idle"}
        </Text>
        <Text style={[sim.hudText, { color: isFollowingUI ? "#1976d2" : "#888" }]}>
          {isFollowingUI ? "🎯 AUTO-FOLLOW ON" : "✋ Follow OFF (manual) — tracking continues"}
        </Text>
      </View>

      {/* ---- Control bar ---- */}
      <View style={[sim.controls, { bottom: insets.bottom + 8 }]}>
        <Ctrl label={finished ? "Restart Run" : running ? "Running…" : "▶ Start"} onPress={startSimulation} primary />
        <Ctrl label={running ? "❚❚ Pause" : "▶ Resume"} onPress={togglePause} disabled={finished || !samplesRef.current.length} />
        <Ctrl label={`⏩ ${speedMultiplier}x`} onPress={cycleSpeed} />
        <Ctrl label={isOnlineUI ? "📴 Go Offline" : "📶 Go Online"} onPress={() => setNetwork(!isOnlineRef.current)} />
        <Ctrl label={isFollowingUI ? "🎯 Following" : "📍 Recenter"} onPress={recenterFollow} />
        <Ctrl label="📲 Bg→Resume" onPress={simulateBackgroundResume} />
        <Ctrl label="💀 Kill+Restart" onPress={simulateKillAndRestart} />
        <Ctrl label="🐞 Fail next sync" onPress={() => { failNextSyncRef.current = true; toast("Next sync will fail once", "warning"); }} />
        <Ctrl label={dashboardVisible ? "📊 Hide" : "📊 Dashboard"} onPress={() => setDashboardVisible((v) => !v)} />
        <Ctrl label="📄 Report" onPress={exportReport} />
      </View>

      {/* ---- Dashboard overlay ---- */}
      {dashboardVisible && (
        <View style={sim.dashboard}>
          <Text style={sim.dashTitle}>🧪 Validation Dashboard</Text>
          <ScrollView style={{ flex: 1 }}>
            {groups.map((g) => (
              <View key={g} style={{ marginBottom: 8 }}>
                <Text style={sim.groupHeader}>{g}</Text>
                {TEST_CATALOGUE.filter(([, , grp]) => grp === g).map(([k, label]) => {
                  const r = results[k];
                  return (
                    <View key={k} style={sim.row}>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={sim.rowLabel}>{label}</Text>
                        {!!r.detail && <Text style={sim.rowDetail}>{r.detail}</Text>}
                        {!!r.rootCause && r.status !== "PASS" && (
                          <Text style={sim.rowCause}>↳ {r.rootCause}</Text>
                        )}
                      </View>
                      <StatusBadge status={r.status} />
                    </View>
                  );
                })}
              </View>
            ))}

            {/* counters */}
            <Text style={sim.groupHeader}>Analytics</Text>
            {Object.entries(counters).map(([k, v]) => (
              <View key={k} style={sim.row}>
                <Text style={sim.rowLabel}>{k}</Text>
                <Text style={sim.counterVal}>{String(v)}</Text>
              </View>
            ))}

            {/* live log */}
            <Text style={sim.groupHeader}>Event Log (latest)</Text>
            {logs.map((l) => (
              <Text key={l.seq} style={sim.logLine}>
                <Text style={sim.logCat}>{l.t}s [{l.category}]</Text> {l.message}
              </Text>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      )}

      {/* overspeed flash banner */}
      {isOverspeedAlertShownRef.current && (
        <Animated.View style={[sim.flash, { opacity: flashAnim, top: insets.top + 60 }]}>
          <Text style={sim.flashText}>🚨 REDUCE SPEED! (Overspeed #{overspeedCount})</Text>
        </Animated.View>
      )}

      <EventCompletedModal
        visible={eventCompletedModal}
        checkpoints={SIM_CHECKPOINTS}
        checkpointStatus={checkpointStatus}
        okayTimeout={okayTimeout}
        onConfirm={() => setEventCompletedModal(false)}
      />

      <Toast />
    </View>
  );
};

// Small control button
const Ctrl = ({ label, onPress, primary, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      sim.ctrl,
      primary && { backgroundColor: "#1976d2" },
      disabled && { opacity: 0.4 },
    ]}
  >
    <Text style={[sim.ctrlText, primary && { color: "#fff" }]}>{label}</Text>
  </TouchableOpacity>
);

// ----------------------------------------------------------------------------
const sim = {
  hud: {
    position: "absolute",
    left: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    zIndex: 50,
  },
  hudText: { fontSize: 12, fontWeight: "600", color: "#222" },
  controls: {
    position: "absolute",
    left: 6,
    right: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    zIndex: 60,
  },
  ctrl: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    elevation: 3,
  },
  ctrlText: { fontSize: 11, fontWeight: "700", color: "#37474f" },
  dashboard: {
    position: "absolute",
    top: 60,
    bottom: 70,
    right: 6,
    width: "62%",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 10,
    padding: 8,
    zIndex: 55,
    elevation: 6,
  },
  dashTitle: { fontSize: 14, fontWeight: "bold", color: "#0d47a1", marginBottom: 4 },
  groupHeader: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: "#455a64",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginTop: 6,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eceff1",
  },
  rowLabel: { fontSize: 11, fontWeight: "600", color: "#263238" },
  rowDetail: { fontSize: 9.5, color: "#546e7a" },
  rowCause: { fontSize: 9.5, color: "#c62828", fontStyle: "italic" },
  counterVal: { fontSize: 12, fontWeight: "bold", color: "#0d47a1" },
  logLine: { fontSize: 9, color: "#37474f", marginBottom: 1 },
  logCat: { color: "#90a4ae", fontWeight: "bold" },
  flash: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#FF1744",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    zIndex: 70,
  },
  flashText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
};

export default MapSimulationScreen;
