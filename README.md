# Bansuri Tuner

A real-time tuner and practice scorer for bansuri (Indian bamboo flute), built on
just-intonation swara theory rather than equal temperament. Cross-platform
(iOS + Android) from one React Native / Expo codebase.

## Stack

- **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript)
- **react-native-pitchy** — native (C++/TurboModule) real-time pitch detection,
  YIN algorithm. Benchmarked at 100% raw pitch accuracy on flute in the
  library's own test suite, which is why it was chosen over a JS-only
  pitch detector.
- **react-native-svg** — the radial swara dial (see "Design notes" below)
- **expo-sqlite** — on-device session history storage
- **@react-navigation** — Calibration → Tuner → History flow
- **@expo-google-fonts** — Instrument Serif (display), Karla (body), Space Mono (data)

## Running it

```bash
npm install
npx expo start
```

This app uses native modules (`react-native-pitchy`, `expo-sqlite`, mic access),
so it will **not** run inside Expo Go. You need a development build. See below.

## Building for your phone (no Mac required)

This project is set up for [EAS Build](https://docs.expo.dev/build/introduction/),
Expo's cloud build service — it compiles both the iOS and Android binaries on
Expo's servers, so you don't need Xcode or Android Studio installed locally.

```bash
npm install -g eas-cli
eas login          # free Expo account
eas build --profile development --platform android   # or ios, or both
```

For iOS specifically: EAS will ask you to log into your Apple Developer account
during the build (needed for code signing) — you still don't need a Mac, but
you do need an active Apple Developer Program membership ($99/yr) to install
a build on a physical iPhone or submit to the App Store. Android has no
equivalent cost for local/internal testing.

Once the build finishes, EAS gives you a link/QR code to install directly on
your device.

Build profiles are in `eas.json`:
- `development` — includes the dev client, for iterating with live reload
- `preview` — a shareable internal build (e.g. for the founder to test)
- `production` — store-ready build

## Before shipping

- Replace the placeholder icon/splash assets in `/assets` — these are still
  the default Expo template graphics.
- `app.json` uses placeholder bundle identifiers
  (`com.sakshi.bansurituner`) — change if you want something else.

## Design decisions (and why)

**Just intonation, not equal temperament.** Swara ratios in `src/theory/swaras.ts`
follow the standard 12-swar just-intonation table (5-limit ratios from Sa),
not a 12-tone-equal-temperament chromatic scale. This is what "in tune" means
in Hindustani practice. One genuinely debatable entry: Tivra Ma uses 45/32,
the more common of a couple of conventions in circulation — flagged in code.

**Sa is not fixed.** `src/theory/calibration.ts` treats a bansuri's "key" as a
manufacturing estimate (referenced to standard A440 equal temperament, since
that's a physical construction spec, not a scale-degree claim), while the
actual scoring always uses the player's live-calibrated or selected Sa. The
calibration screen defaults toward "play your Sa and let the app detect it"
since real flutes vary somewhat from their nominal key.

**Three separate sub-scores, not one blended number.** Pitch accuracy,
stability, and breath consistency are scored and displayed independently
(`src/scoring/`). A single composite score can't tell a player *what* to fix;
separate bars can. Weighting between them was an open question — this sidesteps
it rather than guessing at weights.

**Stability scoring is scoped to genuinely sustained notes.** The segmenter in
`src/scoring/sessionScorer.ts` only scores a note once it's been held
continuously for ≥400ms, and excludes the first 120ms (attack/settle) from the
stability and breath calculations. This is deliberate: meend (glides) and
andolan (intentional oscillation) are real ornamentation technique in this
tradition, not "wobble" — the segmenter's job is to avoid mis-scoring them as
instability.

**Breath consistency is an honest proxy, not a real sensor.** There's no
airflow/pressure sensor here — `scoreBreathConsistency` scores how flat the
volume (dB) envelope stayed during a held note, which tends to sag or shake
when breath support runs out. Worth knowing this is an amplitude-based stand-in
if it comes up.

**Storage schema is generic, everything else isn't.** `src/types/index.ts` and
the SQLite schema use an `instrument` field and a generic scale-degree `label`
rather than bansuri-only naming, since this is meant to grow into a
multi-instrument practice tool later (the "iTabla for bansuri" direction).
The audio pipeline, theory tables, and scoring curves are bansuri/swara-specific
for this round, since generalizing those now would be speculative work against
requirements that don't exist yet.

## Microphone lifecycle (read this if touching `usePitchDetector.ts`)

The current, final behavior, since it evolved across several rounds of
real-device debugging and isn't obvious from reading any single commit:

- The mic is started **once**, the first time any screen calls `start()`
  (in practice, the moment the Calibration screen first gets focus).
- It is **never explicitly stopped** during normal use — not on navigation,
  not on ending a practice session, not on backgrounding the app. `stop()`
  still exists and works, but nothing calls it anymore except the
  final component-unmount cleanup, which barely matters in practice.
- `start()` and `stop()` are both idempotent (guarded by a ref, not just
  `isListening` state, to avoid stale-closure issues) — calling `start()`
  while already listening, or `stop()` while not listening, is a safe no-op.
- "Ending a session" only means the app stops *scoring* incoming audio
  (gated by `sessionStarted` in `TunerScreen`'s ingest effect) — the mic
  itself keeps running underneath.
- Actual state updates from the native listener are throttled to a ~20/sec
  ceiling (`MIN_EMIT_INTERVAL_MS`), independent of how often the native
  side fires, to prevent a burst of native events from cascading through
  downstream effects fast enough to trip React's update-depth safety check.

Why: real-device testing repeatedly showed that any genuine stop-then-start
cycle of the native mic engine left it "running" (no errors, listener still
fires) but producing dead/near-silent audio data afterward — confidence
readings stuck at 0 regardless of input. Minimizing how often the native
engine is actually told to stop resolved every failure mode that was
actually tested. See "Known limitations" for what wasn't tested.

## Known limitations / next steps

**Most important — read before considering this done:**
- **Never tested against a real bansuri.** Every round of testing during
  development used a whistle, voice, or a recording played through a
  speaker — never the actual target instrument. Those proxies were the
  right way to debug the pitch-detection pipeline itself, but bansuri tone
  is breathier and more harmonically complex than a clean whistle, and the
  confidence/volume thresholds in `usePitchDetector.ts` were tuned against
  proxy sounds. Test with a real flute before relying on this.
- **iOS has never been run or tested.** All development and debugging
  happened on a single Android device. There is no evidence this works on
  iPhone at all yet, only that the code is written against
  cross-platform APIs (Expo, `react-native-pitchy`, `expo-audio`).
- **The mic-restart issue was worked around, not root-caused.** During
  development, the native mic engine (`react-native-pitchy`) was found to
  not reliably resume after being explicitly stopped and restarted — the
  fix was to stop calling `Pitchy.stop()` during normal use entirely (mic
  now runs continuously once started; see the removed AppState-pause note
  above). This resolved every failure mode actually tested, but the
  underlying native cause was never confirmed, so an untested scenario
  (a phone call interrupting audio, another app taking the microphone,
  a very long background period) could conceivably still trigger it.

**Other known gaps:**
- Bundle identifiers and app icons are still placeholder Expo template
  assets — swap before a real store submission.
- The swara dial shows all 12 semitone positions (chromatic); a raga-aware
  mode that only lights up the swaras in a selected raga would be a natural
  next feature.
- No raga selection yet — Tivra Ma and Komal notes are always
  available/scored, regardless of whether they belong to the raga being
  practiced.
- Reference tone plays through the speaker, not headphones-only — if the mic
  picks it up mid-session, it's deliberately excluded from scoring (see
  `isTonePlaying` guard in `TunerScreen.tsx`), but using headphones avoids
  any ambiguity in the live dial display.

## Comparison pass against Pano Tuner (general chromatic tuner) and Shruti Tuner

Researched both directly to check what we were missing. Five additions came
out of that and are now in this build:

1. **Saptak (register) indicator** — `theory/swaras.ts`'s `saptakName()`.
   The octave data already existed (`nearestSwara`'s `octave` field) but
   wasn't surfaced in the UI. Now shown next to the swara name (Mandra /
   Madhya / Taar).
2. **~~AppState-driven pause~~ — added, then removed.** Originally stopped mic
   capture on background/lock, matching Pano Tuner's behavior. Removed after
   real-device testing showed the underlying native mic engine
   (`react-native-pitchy`) doesn't reliably resume after being stopped and
   restarted — see "Known limitations" below. The mic now runs continuously
   for the app's lifetime once first started, rather than stopping on
   background/foreground transitions. This is a reliability tradeoff, not
   the originally intended design.
3. **Adjustable in-tune tolerance** — `storage/settingsStore.ts`, persisted
   via `expo-sqlite/kv-store`. Deliberately scoped to only affect the
   visual/haptic "in tune" cutoff, not the underlying continuous pitch score,
   so session history stays comparable across tolerance settings.
4. **Reference tone playback** — `audio/toneSynth.ts` + `useReferenceTone.ts`.
   Synthesizes a sine-wave WAV on the fly (can't bundle audio files since Sa
   varies per player) and plays it via `expo-audio`'s imperative
   `createAudioPlayer`. Arguably matters more here than for a generic tuner,
   given Hindustani practice is fundamentally aural.
5. **Live pitch-trace graph** — `components/PitchTraceGraph.tsx`. Shows the
   last ~3.5 seconds of cents-deviation as a line, so wobble is visible while
   it's happening rather than only as a stability score afterward.

**Considered and deliberately not done: switching to a 22-shruti system**
(as Shruti Tuner does, based on Dr. Vidyadhar Oke's research) instead of the
12-swara table. Reasoning: which of the 22 micro-pitches is "correct" for a
given swara depends on the raga and even melodic direction — implementing
this properly requires a raga→shruti mapping this app doesn't have yet (there's
no raga selection at all). Hard-coding 22 fixed ratios without that context
would present one contested theorist's numbers as universal truth, which is
less correct than the current 12-swara table, not more. If raga-aware practice
mode gets built later, that's the natural point to revisit this.

**Considered and deliberately not done: fast-passage / taan tracking.** A professional
player's fast concert-style runs (multiple notes per second) aren't scored by
this app — `MIN_HOLD_MS = 400` in `scoring/sessionScorer.ts` discards anything
held for less than 400ms, which most notes in a fast taan won't clear. This
isn't an oversight: the three sub-scores (Pitch, Stability, Breath) all
require a note to be sustained long enough to actually measure those things,
and supporting fast passages properly would mean a different segmentation
strategy (onset-detection based, not duration-based), a different display
(a note sequence, not a single scored attempt), different scoring entirely
(closer to sequence/rhythm accuracy), and possibly a smaller pitch-analysis
buffer with its own accuracy trade-offs on lower notes. That's a distinct
feature — closer to a melody-transcription tool than a tuner — not a
threshold tweak. No mainstream tuner app does this either, for the same
reason a guitarist doesn't shred a solo to check if a string is in tune.

## Hardening pass

A round of auditing for the same failure mode found and fixed once already
(an unhandled promise rejection from `Pitchy.stop()` — see git history/chat
log): any place an async storage or audio call wasn't wrapped in try/catch.
Fixed:
- `TunerScreen`'s `beginSession`/`endSessionAndLeave` now catch failures,
  surface an inline error, and guard against double-taps creating duplicate
  sessions or double-running cleanup.
- `HistoryScreen`'s delete handler now catches failures instead of silently
  leaving a "deleted" session still in the list.
- `usePitchDetector`'s `ensureInit` now guards `Pitchy.init()`.
- `useReferenceTone` now cancels a previous tone's pending cleanup timer
  when a new tone starts — without this, rapidly tapping two different notes
  on the dial could double-remove an already-replaced native player (a
  crash risk) and briefly show the wrong "is playing" state.
- Mic-permission-denied now shows an actionable "Open Settings" button
  (`Linking.openSettings()`) instead of a dead-end error message, on both
  the Calibration and Tuner screens.
- Tapping a note on the dial now gives brief visible feedback (the tapped
  tick/label flashes), not just audio — previously a tap had no visual
  confirmation it registered at all.


