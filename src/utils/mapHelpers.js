// Pure, framework-agnostic helpers used by MapScreen.
// Kept stateless so they're trivial to test and can be reused on both iOS and Android.

// ----- Geo math -----

// Convert degrees to radians (used by the great-circle formulas below).
const deg2rad = (deg) => deg * (Math.PI / 180);

// Convert radians to degrees (used when we read back a bearing as a compass angle).
const rad2deg = (rad) => rad * (180 / Math.PI);

// Earth radius in meters — used by both distance and bearing helpers.
const EARTH_RADIUS_METERS = 6371000;

// Haversine distance between two GPS coordinates, in meters.
// Used to decide checkpoint proximity and to gate GPS-smoothing snapping.
export const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

// Initial-bearing (compass heading 0-360) from point 1 to point 2.
// Falls back to this when device GPS doesn't report a valid heading (stationary, indoor, etc.).
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = deg2rad(lon2 - lon1);
  const lat1Rad = deg2rad(lat1);
  const lat2Rad = deg2rad(lat2);
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  // Normalize the atan2 output (-180..180) to a compass-style 0..360.
  return (rad2deg(Math.atan2(y, x)) + 360) % 360;
};

// Build a MapView region that comfortably contains every supplied point.
// Returns a sensible empty-state region if `points` is empty so the map never receives NaN.
export const getBoundingRegion = (points) => {
  if (!points || !points.length) {
    return { latitude: 0, longitude: 0, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }
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
    // 1.5x multiplier adds a small visible buffer around the outermost checkpoints.
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
  };
};

// ----- Marker color rules -----

// Map a checkpoint's `checkpoint_point` (and name as fallback) to its marker hex color.
// The numeric points are the rally-side convention; the name fallback covers events where
// the API returns 0/empty point but the type is encoded in the checkpoint name.
export const getMarkerColorByPoint = (checkpointPoint, checkpointName = '') => {
  const point = parseInt(checkpointPoint, 10);
  const name = (checkpointName || '').trim().toUpperCase();

  if (point === 1000) return '#4CAF50';   // Green - START
  if (point === 2000) return '#F44336';   // Red - FINISH
  if (point === 3000) return '#FFEB3B';   // Yellow - Regular checkpoint
  if (point === 5000) return '#9C27B0';   // Purple - Mandatory checkpoint

  // Fallback for missing/zero `checkpoint_point`: use the name to decide START/FINISH.
  if (point === 0 || isNaN(point)) {
    if (name.startsWith('START')) return '#4CAF50';
    if (name.startsWith('FINISH')) return '#F44336';
    return '#000000'; // Unknown — render black so it's visually noticed.
  }
  return '#000000';
};

// ----- Time formatting -----

// Format a seconds count as HH:MM:SS (zero-padded). Used for the remaining-time HUD.
export const formatTime = (secs) => {
  const safe = Math.max(0, Math.floor(secs || 0));
  const h = String(Math.floor(safe / 3600)).padStart(2, '0');
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// ----- GPS smoothing factory -----

// Creates an exponential-moving-average smoother for raw GPS fixes.
// Returns a function that takes the latest fix and emits a smoothed coordinate.
//
// Why a factory?  The smoother needs per-component state (last smoothed point) but
// the math is identical across screens. Each consumer calls `createGpsSmoother(...)`
// once and gets its own isolated smoother.
//
// Options:
//   smoothingFactor   default exponential weight given to the new reading (0..1).
//                     Lower = smoother track but slower to react to real movement.
//   minAccuracy       readings with reported accuracy worse than this (meters)
//                     are dropped — keeps wild indoor/tunnel fixes off the map.
export const createGpsSmoother = ({ smoothingFactor = 0.3, minAccuracy = 30 } = {}) => {
  // Last accepted smoothed point — shared across calls via closure.
  let smoothed = null;

  return (newLat, newLng, accuracy) => {
    // Drop low-confidence fixes (e.g. accuracy 50m+). Returning the last good point
    // means the car stops jittering instead of teleporting to a bad reading.
    if (accuracy && accuracy > minAccuracy) {
      return smoothed || { latitude: newLat, longitude: newLng };
    }
    // First fix — seed the smoother with the raw value, no blending possible yet.
    if (!smoothed) {
      smoothed = { latitude: newLat, longitude: newLng };
      return smoothed;
    }

    // Distance from the previous smoothed point — used to detect big jumps.
    const distanceFromSmoothed = getDistanceFromLatLonInMeters(
      smoothed.latitude,
      smoothed.longitude,
      newLat,
      newLng
    );

    // Tune the blend factor per fix:
    //  - Big jump (>50m): trust history more (0.05) so we don't snap on a flyer.
    //  - High-confidence fix (<10m accuracy): trust the new reading more (0.6).
    //  - Decent fix (<20m accuracy): in between (0.45).
    //  - Otherwise: use the configured default.
    let factor = smoothingFactor;
    let factorReason = 'default';
    if (distanceFromSmoothed > 50) { factor = 0.1; factorReason = 'BIG-JUMP(>50m)'; }
    else if (accuracy && accuracy < 15) { factor = 0.45; factorReason = 'HIGH-ACCURACY(<15m)'; }
    else if (accuracy && accuracy > 25) { factor = 0.1; factorReason = 'POOR-ACCURACY(>25m)'; }

    // 🛠️ DEBUG — log when smoother applies heavy correction (off-road diagnosis)
    if (distanceFromSmoothed > 20 || factor === 0.1) {
      console.log(`[SMOOTHER] dist:${Math.round(distanceFromSmoothed)}m factor:${factor} reason:${factorReason} acc:${Math.round(accuracy||0)}m`);
    }

    // Standard EMA blend in lat/lng space — fine at the small distances we care about.
    smoothed = {
      latitude: smoothed.latitude + factor * (newLat - smoothed.latitude),
      longitude: smoothed.longitude + factor * (newLng - smoothed.longitude),
    };
    return smoothed;
  };
};
