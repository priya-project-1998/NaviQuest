// ============================================================================
// MapSimulationScreen.data.js
// ----------------------------------------------------------------------------
// Realistic Indore simulation dataset for MapSimulationScreen.
//
// Contents:
//   1. ROUTE_WAYPOINTS   — hand-placed road waypoints (Vijay Nagar → Rajiv Gandhi
//                          Square) tracing real Indore road segments so the drawn
//                          path curves like a vehicle on actual roads, not a
//                          straight line between two dots.
//   2. SIM_CHECKPOINTS   — 13 checkpoints (id / lat / lng / checkpointName /
//                          expectedArrivalTime / radius) placed ON real route
//                          coordinates, plus the production checkpoint shape
//                          (checkpoint_id / checkpoint_point / accuracy / …) so
//                          they feed the real MapScreen logic unchanged.
//   3. buildRoutePath()  — densifies the waypoints into a smooth polyline.
//   4. buildGpsSamples() — the mock GPS simulation path: one fix per simulated
//                          second with speed (incl. deliberate overspeed zones),
//                          heading (some intentionally missing to test heading
//                          recovery), accuracy (incl. one bad spike to test the
//                          GPS smoother / spike filter).
//   5. INDORE_ROUTE_KML  — KML document string for the whole route + checkpoints.
//
// Distances/times are derived with the SAME haversine helper the app uses, so
// the "expectedArrivalTime" figures match what the live screen will compute.
// ============================================================================

import { getDistanceFromLatLonInMeters, calculateBearing } from "../utils/mapHelpers";

// Target driving profile for the whole run.
export const SIM_PROFILE = {
  targetDistanceKm: 27, // 25–30 KM corridor
  targetDurationMin: 60, // 1 hour
  avgSpeedKmh: 50, // expected cruising average
  speedLimitKmh: 60, // overspeed threshold the event enforces
};

// ----------------------------------------------------------------------------
// 1. ROUTE_WAYPOINTS
// ----------------------------------------------------------------------------
// Ordered list of road points. Coordinates approximate real Indore geography and
// follow these segments in order:
//   Vijay Nagar → MR-10 → Super Corridor → Airport Road → Bypass Road →
//   Ring Road → Rajiv Gandhi Square.
// `anchor` marks a named landmark; un-anchored points are bends that keep the
// polyline hugging the road instead of cutting straight across.
export const ROUTE_WAYPOINTS = [
  { latitude: 22.75330, longitude: 75.89370, anchor: "Vijay Nagar Square" },
  { latitude: 22.75240, longitude: 75.88720 },
  { latitude: 22.75180, longitude: 75.88050, anchor: "MR-10 Road" },
  { latitude: 22.75090, longitude: 75.87340 },
  { latitude: 22.74980, longitude: 75.86560 },
  { latitude: 22.75060, longitude: 75.85740 },
  { latitude: 22.75280, longitude: 75.85010, anchor: "Super Corridor Jn" },
  { latitude: 22.75760, longitude: 75.84200 },
  { latitude: 22.76140, longitude: 75.83380, anchor: "Super Corridor IT Park" },
  { latitude: 22.75820, longitude: 75.82560 },
  { latitude: 22.75180, longitude: 75.81980 },
  { latitude: 22.74360, longitude: 75.81520, anchor: "Super Corridor South" },
  { latitude: 22.73480, longitude: 75.81120 },
  { latitude: 22.72780, longitude: 75.80540, anchor: "Airport Road" },
  { latitude: 22.72190, longitude: 75.81260 },
  { latitude: 22.71640, longitude: 75.82180 },
  { latitude: 22.71080, longitude: 75.83080, anchor: "Airport Road East" },
  { latitude: 22.70380, longitude: 75.83920 },
  { latitude: 22.69640, longitude: 75.84620, anchor: "Bypass Road" },
  { latitude: 22.69020, longitude: 75.85480 },
  { latitude: 22.68580, longitude: 75.86420 },
  { latitude: 22.68340, longitude: 75.87380, anchor: "Ring Road" },
  { latitude: 22.68260, longitude: 75.88340 },
  { latitude: 22.68420, longitude: 75.89220 },
  { latitude: 22.68920, longitude: 75.89860, anchor: "Ring Road East" },
  // Gentle SW arc down to the finish (monotonic lat/lng — no sharp reversal, so
  // the GPS smoother tracks the curve tightly instead of cutting a hard corner).
  { latitude: 22.68360, longitude: 75.89740 },
  { latitude: 22.67760, longitude: 75.89430 },
  { latitude: 22.67120, longitude: 75.89010, anchor: "Rajiv Gandhi Square" },
];

// ----------------------------------------------------------------------------
// helper: cumulative distance (meters) along the raw waypoint list
// ----------------------------------------------------------------------------
const cumulativeDistances = (points) => {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const d = getDistanceFromLatLonInMeters(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
    cum.push(cum[i - 1] + d);
  }
  return cum;
};

export const ROUTE_TOTAL_METERS = (() => {
  const cum = cumulativeDistances(ROUTE_WAYPOINTS);
  return cum[cum.length - 1];
})();

// ----------------------------------------------------------------------------
// 2. SIM_CHECKPOINTS
// ----------------------------------------------------------------------------
// Each checkpoint sits exactly on a ROUTE_WAYPOINTS coordinate (so the vehicle
// is guaranteed to pass through its radius). We expose BOTH:
//   • the user-facing spec shape (id, checkpointName, expectedArrivalTime, radius)
//   • the production shape MapScreen consumes (checkpoint_id, checkpoint_point,
//     accuracy, sequence_number, description, latitude, longitude …)
//
// checkpoint_point convention (from getMarkerColorByPoint):
//   1000 START · 2000 FINISH · 3000 regular · 5000 mandatory
const CHECKPOINT_SPECS = [
  { wp: 0, name: "START", point: 1000, radius: 50 },
  { wp: 2, name: "MR-10 Gate", point: 3000, radius: 45 },
  { wp: 6, name: "Super Corridor Jn", point: 3000, radius: 45 },
  { wp: 8, name: "IT Park Checkpoint", point: 5000, radius: 50 }, // mandatory
  { wp: 11, name: "Super Corridor South", point: 3000, radius: 45 },
  { wp: 13, name: "Airport Road Gate", point: 3000, radius: 50 },
  { wp: 16, name: "Airport Road East", point: 3000, radius: 45 },
  { wp: 18, name: "Bypass Road Gate", point: 5000, radius: 50 }, // mandatory
  { wp: 21, name: "Ring Road North", point: 3000, radius: 45 },
  { wp: 23, name: "Ring Road Mid", point: 3000, radius: 45 },
  { wp: 24, name: "Ring Road East", point: 3000, radius: 45 },
  { wp: 26, name: "Pre-Finish Loop", point: 3000, radius: 45 },
  { wp: 27, name: "FINISH", point: 2000, radius: 50 },
];

export const SIM_CHECKPOINTS = (() => {
  const cum = cumulativeDistances(ROUTE_WAYPOINTS);
  const avgSpeedMs = (SIM_PROFILE.avgSpeedKmh * 1000) / 3600;
  return CHECKPOINT_SPECS.map((spec, i) => {
    const wpt = ROUTE_WAYPOINTS[spec.wp];
    const metersFromStart = cum[spec.wp];
    const etaSec = Math.round(metersFromStart / avgSpeedMs);
    const etaH = String(Math.floor(etaSec / 3600)).padStart(2, "0");
    const etaM = String(Math.floor((etaSec % 3600) / 60)).padStart(2, "0");
    const etaS = String(etaSec % 60).padStart(2, "0");
    return {
      // ----- spec shape (what the simulator report shows) -----
      id: `CP${String(i + 1).padStart(2, "0")}`,
      latitude: wpt.latitude,
      longitude: wpt.longitude,
      checkpointName: spec.name,
      expectedArrivalTime: `${etaH}:${etaM}:${etaS}`,
      radius: spec.radius,
      distanceFromStartM: Math.round(metersFromStart),
      // ----- production shape (what MapScreen logic consumes) -----
      checkpoint_id: `SIM-CP-${i + 1}`,
      checkpoint_name: spec.name,
      checkpoint_point: String(spec.point),
      sequence_number: String(i + 1),
      description: String(spec.point),
      accuracy: spec.radius, // MapScreen reads cp.accuracy as the detection radius
    };
  });
})();

// ----------------------------------------------------------------------------
// 3. buildRoutePath() — densified polyline for drawing + the GPS source curve
// ----------------------------------------------------------------------------
// Linear-interpolate between each waypoint pair so a fix lands roughly every
// `stepMeters`. This keeps the polyline (and the car movement) following the
// road bends defined by the waypoints rather than teleporting between them.
export const buildRoutePath = (stepMeters = 40) => {
  const path = [];
  for (let i = 1; i < ROUTE_WAYPOINTS.length; i++) {
    const a = ROUTE_WAYPOINTS[i - 1];
    const b = ROUTE_WAYPOINTS[i];
    const segMeters = getDistanceFromLatLonInMeters(
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude
    );
    const steps = Math.max(1, Math.round(segMeters / stepMeters));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      path.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      });
    }
  }
  // Always include the final destination exactly.
  path.push({
    latitude: ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].latitude,
    longitude: ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].longitude,
  });
  return path;
};

// ----------------------------------------------------------------------------
// 4. buildGpsSamples() — the mock GPS simulation path (one fix / simulated sec)
// ----------------------------------------------------------------------------
// Walks the route at a realistic speed profile and emits a GPS fix every
// simulated second. Deliberately injects edge cases the dashboard checks for:
//   • OVERSPEED ZONES   speed climbs above the limit on highway-like stretches
//                       (Super Corridor, Bypass) and is held > 5 s so the
//                       overspeed COUNTER (5-second re-trigger) is exercised.
//   • MISSING HEADING   some fixes report heading=null → tests bearing fallback
//                       / "heading recovery when GPS heading missing".
//   • ACCURACY SPIKE    one fix reports a wild jump + bad accuracy → tests the
//                       GPS smoother / false-speed-spike filter.
// Returned sample shape mirrors react-native-geolocation-service position.coords:
//   { latitude, longitude, speed (m/s), heading (deg|null), accuracy (m), tSec }
export const buildGpsSamples = () => {
  // Speed zones expressed as fractions of the route [from, to, kmh].
  // Overspeed (>60) deliberately placed on Super Corridor & Bypass straights.
  const speedZones = [
    [0.0, 0.04, 18], // leaving START slowly
    [0.04, 0.18, 48], // MR-10 city
    [0.18, 0.34, 72], // Super Corridor — OVERSPEED
    [0.34, 0.46, 40], // approaching airport, slowing
    [0.46, 0.6, 52], // Airport Road
    [0.6, 0.74, 70], // Bypass Road — OVERSPEED
    [0.74, 0.9, 50], // Ring Road
    [0.9, 0.97, 30], // Ring Road East, slowing
    [0.97, 1.01, 15], // arriving FINISH
  ];
  const speedKmhAt = (frac) => {
    for (const [from, to, kmh] of speedZones) {
      if (frac >= from && frac < to) return kmh;
    }
    return SIM_PROFILE.avgSpeedKmh;
  };

  // Which waypoint indices are checkpoints (checkpoints sit exactly on waypoints).
  // Real driving slows + dwells at a checkpoint, so we emit several fixes AT the
  // exact coordinate. This lets the EMA GPS smoother converge inside the radius
  // (instead of cutting the corner) — including the FINISH vertex, which the
  // smoother would otherwise never reach because it always lags one step behind.
  const checkpointWaypointIdx = new Set();
  SIM_CHECKPOINTS.forEach((cp) => {
    ROUTE_WAYPOINTS.forEach((w, i) => {
      if (Math.abs(w.latitude - cp.latitude) < 1e-9 && Math.abs(w.longitude - cp.longitude) < 1e-9) {
        checkpointWaypointIdx.add(i);
      }
    });
  });

  // 1) Build the raw GPS vertex list: densify each waypoint segment at ~12 m and
  //    inject DWELL fixes when arriving at a checkpoint waypoint.
  const STEP = 12;
  const DWELL_FIXES = 8;
  const cum = cumulativeDistances(ROUTE_WAYPOINTS);
  const totalM = cum[cum.length - 1];
  const raw = []; // { latitude, longitude, distM (along route), dwell, slow }

  // seed with START vertex (+ dwell so START reliably registers)
  raw.push({ latitude: ROUTE_WAYPOINTS[0].latitude, longitude: ROUTE_WAYPOINTS[0].longitude, distM: 0, dwell: true, slow: true });
  for (let d = 0; d < DWELL_FIXES; d++) {
    raw.push({ latitude: ROUTE_WAYPOINTS[0].latitude, longitude: ROUTE_WAYPOINTS[0].longitude, distM: 0, dwell: true, slow: true });
  }

  for (let i = 1; i < ROUTE_WAYPOINTS.length; i++) {
    const a = ROUTE_WAYPOINTS[i - 1];
    const b = ROUTE_WAYPOINTS[i];
    const segM = getDistanceFromLatLonInMeters(a.latitude, a.longitude, b.latitude, b.longitude);
    const steps = Math.max(1, Math.round(segM / STEP));
    // intermediate points (exclude s=0 which is the previous vertex already added)
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      raw.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
        distM: cum[i - 1] + segM * t,
      });
    }
    const isCp = checkpointWaypointIdx.has(i);
    // the waypoint vertex itself
    raw.push({ latitude: b.latitude, longitude: b.longitude, distM: cum[i], slow: isCp });
    // dwell at checkpoints so the smoother settles onto the exact coordinate
    if (isCp) {
      for (let d = 0; d < DWELL_FIXES; d++) {
        raw.push({ latitude: b.latitude, longitude: b.longitude, distM: cum[i], dwell: true, slow: true });
      }
    }
  }

  // 2) Convert raw vertices → GPS samples with speed / heading / accuracy.
  const samples = [];
  const n = raw.length;
  let lastHeading = 0;
  for (let i = 0; i < n; i++) {
    const pt = raw[i];
    const next = raw[Math.min(i + 1, n - 1)];
    const frac = totalM ? pt.distM / totalM : 0;

    // speed: zone speed, but crawl through checkpoint dwell/slow points
    let kmh = speedKmhAt(frac);
    if (pt.slow) kmh = Math.min(kmh, 14);
    if (pt.dwell) kmh = 6;
    const speedMs = (kmh * 1000) / 3600;

    // heading: bearing to next moving point; hold last heading while stationary
    let heading;
    const moved = getDistanceFromLatLonInMeters(pt.latitude, pt.longitude, next.latitude, next.longitude);
    if (moved > 0.5) {
      heading = calculateBearing(pt.latitude, pt.longitude, next.latitude, next.longitude);
      lastHeading = heading;
    } else {
      heading = lastHeading;
    }
    // periodically drop heading to exercise the bearing-fallback / recovery path
    if (i % 17 === 0 && i > 0 && !pt.dwell) heading = null;

    // Keep accuracy good (<10 m → smoother blend factor 0.4) so the EMA lag stays
    // ~18 m and never crosses the 50 m threshold that would flip the smoother into
    // its runaway "anti-flyer" mode (factor 0.05) while the car is moving. A brief
    // mildly-degraded patch (15 m → factor 0.25) still exercises a non-ideal blend.
    let accuracy = 6 + (i % 4); // 6–9 m
    if (frac > 0.5 && frac < 0.508) accuracy = 15; // short mildly-degraded GPS patch

    samples.push({
      latitude: pt.latitude,
      longitude: pt.longitude,
      speed: speedMs,
      heading,
      accuracy,
      tSec: i,
      isOverspeedZone: kmh > SIM_PROFILE.speedLimitKmh,
    });
  }

  // 3) Inject ONE false GPS spike on a straight stretch BETWEEN checkpoints: a
  //    single fix that teleports ~80 m off-road with bad accuracy (60 m > the
  //    smoother's 30 m minAccuracy) and an absurd speed. The smoother must DROP
  //    it (accuracy gate) and the speed filter must reject the 180 km/h reading,
  //    so it should not move the car or false-trigger any checkpoint.
  // place on a clean straight stretch (Bypass) away from the degraded-accuracy patch
  let spikeIndex = Math.floor(n * 0.7);
  while (spikeIndex < n - 1 && (raw[spikeIndex].dwell || raw[spikeIndex].slow)) spikeIndex++;
  if (samples[spikeIndex]) {
    samples[spikeIndex] = {
      ...samples[spikeIndex],
      latitude: samples[spikeIndex].latitude + 0.0007,
      longitude: samples[spikeIndex].longitude + 0.0007,
      speed: (180 * 1000) / 3600,
      accuracy: 60,
      isSpike: true,
    };
  }

  return samples;
};

// ----------------------------------------------------------------------------
// 5. INDORE_ROUTE_KML — KML document for the full route + checkpoints
// ----------------------------------------------------------------------------
export const buildRouteKml = () => {
  const path = buildRoutePath(40);
  const coordStr = path
    .map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)},0`)
    .join(" ");

  const placemarks = SIM_CHECKPOINTS.map(
    (cp) => `
    <Placemark>
      <name>${cp.checkpointName}</name>
      <description>id=${cp.id} | ETA=${cp.expectedArrivalTime} | radius=${cp.radius}m | point=${cp.checkpoint_point}</description>
      <Point>
        <coordinates>${cp.longitude.toFixed(6)},${cp.latitude.toFixed(6)},0</coordinates>
      </Point>
    </Placemark>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>NaviQuest Indore Simulation Route</name>
    <description>Vijay Nagar to Rajiv Gandhi Square via MR-10, Super Corridor, Airport Road, Bypass Road and Ring Road. Approx ${(ROUTE_TOTAL_METERS / 1000).toFixed(2)} km.</description>
    <Style id="routeLine">
      <LineStyle><color>ff1976d2</color><width>5</width></LineStyle>
    </Style>
    <Placemark>
      <name>Route</name>
      <styleUrl>#routeLine</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordStr}</coordinates>
      </LineString>
    </Placemark>${placemarks}
  </Document>
</kml>`;
};

export const INDORE_ROUTE_KML = buildRouteKml();
