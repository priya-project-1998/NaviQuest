# NaviQuest — Store Release Checklist (branch `pk--fixes`)

> Yeh file go-live ke saare steps document karti hai. Client approve kar de to
> isi file ke hisaab se proceed karna hai. App pehle se **dono stores par live** hai,
> isliye yeh ek **update submission** hai (naya app nahi).

---

## 1. Is branch me kya change hua (summary)

**MapScreen functional fixes (stale-closure bug class):**
- Timer ab live count-down karta hai (`timerReady` flag) — 15-min warning & time-over completion bhi isi par depend karte the, ab chalte hain.
- START gate / checkpoint detection (`checkpointStatusRef`) — pehle gate kabhi khulta hi nahi tha.
- Overspeed: API speed-limit (`speedLimitRef`), per-segment count + reset at checkpoint, aur re-entry par spurious count nahi (dip ke baad turant +1 nahi).
- Voice completed-count + offline-sync/DB-restore bhi ref-synced.

**Cross-platform / store-relevant changes:**
- iOS background location enable: `Info.plist` me `UIBackgroundModes: location` + watch options me `allowsBackgroundLocationUpdates / pausesLocationUpdatesAutomatically:false / showsBackgroundLocationIndicator`.
- Time-over (timer=0) ab `event_end.mp3` bajata hai (dono platform), pehle sirf vibration tha.
- Console logs removed + comments one-line.
- MapSimulationScreen test harness + extracted shared modules.

**Commits (pushed to `origin/pk--fixes`):**
- `1dd68e8` MapScreen stale-closure fixes + sim harness
- `05d2cfe` console/comment cleanup
- `b15b60c` iOS background location + time-over sound

---

## 2. ⚠️ Submit karne se PEHLE jo code changes karne hain (mai karunga jab bolo)

### A. iOS — location purpose strings background-justify karna (App Store pass karane ke liye ZARURI)
`ios/NaviQuest/Info.plist` me dono strings update karni hain. Suggested text:

- **NSLocationWhenInUseUsageDescription:**
  > "NaviQuest tracks your location during a live rally/event — including while the app is in the background or the screen is off — to record your route, detect checkpoints, and monitor speed. Location is used only during an active event."

- **NSLocationAlwaysAndWhenInUseUsageDescription:** (same text as above)

### B. Android — `FOREGROUND_SERVICE` permission ka decision (ek choose karna hai)
Manifest me `FOREGROUND_SERVICE` declared hai par koi foreground service actually use nahi hota.
- **Option 1 (simple):** unused `FOREGROUND_SERVICE` permission hata do → "unnecessary permission" flag se bacho. (Background tracking screen-on/keep-awake tak rahegi — jo abhi bhi practically waisa hi hai.)
- **Option 2 (reliable bg):** proper foreground service add karo (`android:foregroundServiceType="location"` + `FOREGROUND_SERVICE_LOCATION` permission, Android 14+) taaki screen-off par bhi tracking reliable chale. (Zyada kaam, par real bg tracking.)

> **Decision chahiye:** Option 1 ya 2?

### C. Version / build number bump (dono platform)
- Android: `android/app/build.gradle` me `versionCode` +1, `versionName` update.
- iOS: Xcode me `CFBundleVersion` (build) +1, `CFBundleShortVersionString` update.

---

## 3. 🍏 App Store (iOS) — review checklist

| Item | Status / Action |
|---|---|
| Background location capability (UIBackgroundModes:location) | ✅ added — **high-scrutiny** (Guideline 5.1.5 / 2.5.4) |
| Purpose strings justify background use | ⬜ **Action A** (abhi generic hai → reject risk) |
| `showsBackgroundLocationIndicator` (blue bar) | ✅ true set |
| App Review notes me rally/bg use-case explain | ⬜ submit ke waqt likhna |
| Demo video / screenshots of live-event tracking | ⬜ prepare karna (Apple maang sakta hai) |
| Sounds (SoundModule.swift) + mp3s bundled | ✅ already working |
| Build + archive + upload (Xcode / Transporter) | ⬜ |

**Reject hone ka main reason ho sakta hai:** purpose string me background justify na hona → **Action A zaruri**.

---

## 4. 🤖 Play Store (Android) — review checklist

| Item | Status / Action |
|---|---|
| Is branch ne nayi permission add ki? | ❌ Nahi (bg flags no-op, time-over sound = no perm) → is branch ka review impact ~none |
| `ACCESS_BACKGROUND_LOCATION` declaration (form + demo video) | ✅ already approved (app live hai) — bas confirm kar lena ki abhi bhi match karta hai |
| `FOREGROUND_SERVICE` unused permission | ⬜ **Action B** (hatao ya service add karo) |
| targetSdk 36 (Android 14+) compliance | ⬜ Action B se related |
| `POST_NOTIFICATIONS` (Android 13+) | ✅ declared |
| Signed AAB/APK + versionCode bump | ⬜ Action C |

---

## 5. Build & Submit steps (jab approve ho jaye)

### iOS
1. Action A (purpose strings) apply karo.
2. Action C (build number bump).
3. `cd ios && pod install` (zarurat ho to).
4. Xcode: Product → Archive → Distribute App → App Store Connect → Upload.
5. App Store Connect: build select, App Review notes + demo, submit for review.

### Android
1. Action B (foreground service decision) apply karo.
2. Action C (versionCode/versionName bump).
3. Release APK/AAB build: `cd android && ./gradlew bundleRelease` (AAB for Play Store) ya `assembleRelease` (APK).
   - Signing: `my-release-key.jks` (creds in `android/gradle.properties`).
4. Play Console: Production → naya release → AAB upload → review → rollout.

---

## 6. Testing reminders (submit se pehle)
- iOS device par background location verify (app background/screen-off par tracking + sounds + blue bar).
- Dono platform par ek real event/drive par MapScreen full flow (START → checkpoints → overspeed → finish) test — emulator GPS se full route verify nahi ho paya tha.
- Release build smoke test: app Login screen par sahi khulti hai (no temp routing).

---

## 7. Mujhe (Claude) ko jab proceed karna ho to — exact actions
Jab yeh file do, mai yeh karunga (jo aap confirm karo):
1. **Action A** — iOS purpose strings update (background justify).
2. **Action B** — `FOREGROUND_SERVICE` ka chuna hua option (hatao / service add).
3. **Action C** — version/build bump (dono platform).
4. Android release AAB/APK build.
5. Changes commit + push.
6. (iOS archive/upload aap Xcode se karenge — mai code-side ready kar dunga.)
