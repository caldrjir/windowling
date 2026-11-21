# VOIDBORN on phones and in the app stores

VOIDBORN is meant to ship as a mobile app (Google Play, App Store) as well as on the web. This
page records what the mobile analysis found, what VOIDBORN 1.6.0 changed, and what is still left
before a store release.

## Analysis (1.5.0)

Every screen was screenshotted on phone profiles (iPhone SE 320×568, iPhone 14 Pro 393×660 and
734×343 landscape, Pixel 7 412×839 and 863×360 landscape, a 360×640 Android) and an iPad Mini,
with touch emulation. Touch input itself worked: a floating stick anywhere on the play field and
a DASH button. The layout and system behaviour did not:

| Problem                                                                                           | Where              |
| ------------------------------------------------------------------------------------------------- | ------------------ |
| Achievement toasts piled up at the bottom right and covered the DASH button and level-up cards    | run, all phones    |
| The boss bar sat on top of the weapon slots; the timer collided with the HUD chips                | run, portrait      |
| Only two of three level-up cards fit; the chest's Continue button was off screen                  | landscape          |
| Overlays taller than the screen were cut off at the top (centred grid), so pause needed scrolling | pause, game over   |
| Launch was at the very end of a long hangar page                                                  | hangar, all phones |
| Big banners (`white-space: nowrap`) ran off the screen                                            | wave, boss, legend |
| The logo was cut on 360 px; the title asked to "press any key"                                    | title, menu        |
| The language switch floated over the profile panel                                                | menu               |
| No safe areas: notch / Dynamic Island / home indicator covered the HUD and screens                | everywhere         |
| Android Back (and the browser's back) left the game, even in the middle of a run                  | everywhere         |
| Tapping the title also pressed the menu button under the finger (on iPad: Game Center, leaving)   | title              |
| A window that opened under a held finger (level-up, chest) could take the tap on release          | run                |
| No haptics, the screen dimmed during a run, 120 Hz phones rendered 120 frames a second            | run                |
| Settings showed the keyboard table on phones; small pause button; no manifest or app icons        | settings, run, PWA |

## What 1.6.0 changed

- **`js/platform.js`** (new): touch / app detection (`body.touch`, `body.app` from Capacitor,
  `display-mode: standalone|fullscreen`, iOS `navigator.standalone` or `?app=1`), safe-area insets
  in px for the canvas, vibration (`Platform.vibrate`, setting _Vibrace_), Screen Wake Lock during
  a run, and the Back button: while the game is not on its main menu it keeps one extra history
  entry, so Back closes the window / goes to the menu / pauses the run instead of leaving.
- **Safe areas**: `--sat/--sar/--sab/--sal` from `env(safe-area-inset-*)` (`viewport-fit=cover`)
  pad the screens, overlays, HUD, toasts and the DASH button; off-screen arrows keep out of them.
  _Debug → Výřez displeje_ simulates an iPhone notch and home indicator in both orientations.
- **Phone layout** (`max-width: 760px`, `max-height: 500px`): toasts at the top right (in a run
  below the counters, title only, at most two), wrapping banners, the timer on its own row in
  portrait with the HUD below it and the boss bar on top (the HUD moves down while a boss lives),
  the boss bar at the bottom centre in landscape, a two-column menu in landscape, compact
  level-up / chest / pause windows, sticky Launch bar and sticky window buttons.
- **Controls**: the DASH button shows its recharge as a ring (`--re`) and dims when empty; it can
  move to the left (_Úskok vlevo_); a 46 px pause button; touch help instead of keys in Settings;
  _Šetřit baterii_ caps the game at 60 fps on fast displays.
- **Taps**: the title reacts to `click` (not `pointerdown`), and overlay buttons ignore a click
  whose press began before the window opened.
- **Install**: `manifest.webmanifest` (fullscreen, any orientation) and icons rendered from the
  ship sprite (`icons/`: 192, 512, maskable 512, apple-touch 180). The site is behind a password,
  so the manifest is requested with credentials. In app mode the menu hides the Game Center link.
- E2E: `VOIDBORN on a phone: …` in `apps/web/e2e/app.test.ts` (mobile project).

## Before a store release

**Packaging.** Use **Capacitor** for both stores: the game is static files, so it can ship
inside the app and run offline (`capacitor://localhost` / `https://localhost`), and `platform.js`
already detects `window.Capacitor`. A Trusted Web Activity (Android only) would load the live
site instead, which needs `/.well-known/assetlinks.json` and a way past the site password; Apple
rejects thin web wrappers (guideline 4.2), so iOS needs the bundled build anyway.

**Shared files.** The game loads `../sync.js`, `../music.js` and `../presence.js`; the app build
has to copy them next to the game. Fonts come from Google Fonts: bundle them for offline use and
update the CSP accordingly on the web.

**Accounts and cloud saves.** In the app the origin is not windowling.com, so `sync.js` needs an
absolute API base, CORS for the app origin and token (not cookie) auth. Google blocks OAuth in
embedded WebViews (`disallowed_useragent`): sign in with the native Google SDK (Capacitor plugin)
and exchange the ID token on the server (Better Auth supports Google ID-token sign-in). The App
Store also requires Sign in with Apple when another social login is offered (guideline 4.8) and
account deletion inside the app (5.1.1(v)).

**Native polish.** Splash screen and adaptive icons (generate from `icons/icon-512.png`), status
bar hidden (fullscreen), `@capacitor/haptics` instead of `navigator.vibrate` on iOS (Safari has no
vibration), keep-awake plugin, pause on `appStateChange` (the game already pauses on
`visibilitychange` and `blur`), Android back via `App.addListener('backButton')` calling the same
`handleBack`.

**Performance.** Test on a low-end Android phone: canvas rasterization is the bottleneck (see the
VOIDBORN rendering rules in `CLAUDE.md`); _Auto_ quality and the 60 fps cap are there.

**Store listing.** Privacy policy URL (local saves, optional Google account, cloud saves, no ads
or tracking), Play data-safety form and age rating, App Store privacy labels, phone and tablet
screenshots in both orientations, `versionName` = `GAME_VERSION`, increasing build numbers.
