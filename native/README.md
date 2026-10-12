# iPhone app

Isolated Capacitor iPhone package for the redesigned siddur. Bundle ID: `com.noachbergman.siddurbeitaharon`. Version 1.0.0, build 5. The website in `docs/` remains the source of the interface; native adaptations are generated into ignored `www/` and `ios/App/App/public/` directories.

The printed PDF and all prayer/calendar data are copied byte for byte. PDF.js 3.11.174 and the Hebrew fonts are bundled locally. Only native resource paths, native geolocation, installed-app UI, and service-worker registration are adapted. GPS is optional; denied location falls back to the existing manual city selection. There is no background location tracking or app analytics.

## Build

```sh
cd native
npm ci
npm run sync
node scripts/verify.mjs
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/Siddur-5.xcarchive -derivedDataPath build/DerivedData -allowProvisioningUpdates archive
```

For TestFlight, create the matching app record in the owner's App Store Connect account, then upload with:

```sh
xcodebuild -exportArchive -archivePath build/Siddur-5.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/upload-5 -allowProvisioningUpdates
```

Increment the build number before subsequent uploads. An archive or successful upload does not itself mean Apple processing or internal TestFlight availability has completed; verify those in App Store Connect. No public App Store release is part of this workflow.

## Build 1 release evidence — October 12, 2026

- Release archive and Simulator build succeeded; the final archive passed deep signature verification.
- Content verification passed: PDF/data unchanged, local fonts and PDF.js worker, no fixed-date fixture, and the `עכשיו` label removed.
- In the dedicated iPhone 17 Pro simulator on iOS 27, location denial retained the home screen, the bundled Shacharit page opened, and navigation advanced from PDF page 14 to page 15. Physical-device acceptance and GPS accuracy are not claimed.
- The first command-line upload required renewed Apple account access. The next correctly reported that the new app record was missing.
- Xcode Organizer created the Hebrew app record and uploaded version 1.0.0 (1) using **TestFlight Internal Only**. Its completion screen said “App 1.0.0 (1) uploaded”; Apple's delivery log confirmed `UPLOAD SUCCEEDED with no errors`.
- App Store Connect app ID: `6821949673`. [TestFlight page](https://appstoreconnect.apple.com/apps/6821949673/testflight).
- Processing completion and internal tester assignment remain unverified because the browser session requires sign-in. No external group, tester invitation, beta review, or public App Store release was submitted.

## Build 2 changes and validation — October 12, 2026

- The owner subsequently confirmed that build 1 works after adding internal testers.
- Home is fixed to the viewport without page scrolling or rubber-banding. A compact layout preserves the main controls. On a particularly full day or small screen, the existing daily rows move into a separate “היום ותזכורות” sheet, preserving their callbacks and access to all information.
- Buttons have a clearer glass border, reflection and restrained shadow.
- Native reading trims blank margins for display only, then fits all retained content without stretching. The original PDF remains byte-identical. The reader's “מקור” control restores the original margins; “התאמה” returns to the fitted view.
- `scripts/measure-page-margins.py` audits all 315 pages rendered at 120 DPI. Crops include every detected pixel darker than 254, padding, all highlight boxes and their side markers. Median width gain is 1.22x. Build-time SHA-256 verification prevents applying stale crops to a changed PDF. This is a pixel-boundary audit, not OCR or text replacement.
- Browser checks covered 320×568 with SE safe areas, 375×667, 393×852 and 430×932, plus a busy-day fixture with eight choices and five reminders. Home scroll positions stayed zero; the overflow sheet opened the original prayer reader correctly.
- In the dedicated iPhone 17 Pro simulator on iOS 27, home remained fixed after a scroll input, and the cropped Shacharit pages 14 and 15 rendered with their headers and folios visible. Original-margin switching was checked in the browser fixture. Physical-device acceptance remains for the testers.
- Content verification, the Simulator build, the Release archive and deep signature verification passed.
- Xcode uploaded build 2 successfully at 10:11 AM. App Store Connect then showed **Build 2 Internal — Testing**, assigned automatically to the existing `testers` group with two invites. Tester installation of build 2 remains unverified. No external beta or public release was submitted.

## Build 3: consistent reader framing - October 12, 2026

Build 2 sized each page from every detected scan mark and all highlight bounds. Stray margin specks and large highlight rectangles caused uneven magnification and positioning. Build 3 anchors the frame to the printed block instead.

- All 312 ordinary pages use the same 390 by 648 PDF-point frame and magnification, with centered text and a shared header position. The wider table on PDF page 231 and ornamental page 304 fit proportionally inside the same display rectangle. The illustrated cover remains complete.
- Source PDF rotation is respected, including the rotated media box on page 4. Rendering happens directly into the final canvas with a translation, avoiding the previous fractional crop/copy/rescale.
- The measurement script audits every excluded pixel darker than 254. Outside the frame, only isolated scanner marks up to 8 pixels wide/high and 32 pixels in area are accepted, plus the visually inspected scan-edge streak on page 314. An unexpected larger component fails generation. The original PDF and all prayer/calendar/highlight data remain byte-identical. Highlight wash over blank paper is clipped to the reading frame; it no longer dictates the zoom.
- Visual review covered contact sheets for all 315 final frames and full-size exceptions. The reported pages 16, 19 and 20, plus adjacent pages 15-21, were compared for alignment. In the iPhone simulator, pages 14-20 turn with stable framing and the original-margin toggle still works.
- Content verification checks that all ordinary frames have identical dimensions and all fitted pages share one aspect ratio. The Simulator build passed. Physical-device acceptance remains for the testers.

- Build 3 upload succeeded at 10:28 AM. A subsequent request for page animation is included in build 4 below.

## Build 4: page movement and stable reader controls - October 12, 2026

- A 520 ms cylindrical paper curl follows Hebrew reading direction. The scanned front bends into a shaded fold with a blank paper reverse; going backward lays the previous sheet back down. Only a temporary canvas leaf moves; the header and footer remain stationary. Reduce Motion disables page movement.
- Controls no longer auto-hide on edge taps or swipes, or on a timer after opening. The center tap still shows/hides controls explicitly. The centered title has a fixed allocation, separate from the action buttons.
- Labels, highlights note and saved reading position commit after the new page is painted and the movement finishes. Rendering is serialized, rapid requests retain the final destination, and closing cancels movement without allowing an old render to overwrite a reopened prayer. Swipes suppress their synthetic edge click to avoid double turns.
- Eight focused tests passed: commit timing, rapid forward navigation, reversing during movement, close/reopen during paint, close during movement, render failure/recovery, same-page resize and reduced motion. Run `node --test tests/page-turn.test.mjs` from `native`.
- A browser fixture using the production renderer paused the real paper curl at 260 ms. At 393×852 the header rectangle remained `[0, 0, 393, 54.3984375]` before, during and after the turn; the page label updated only after completion. Reverse turns and preserving hidden controls were checked. QA pause controls exist only in an ignored fixture, not the bundled app.
- Simulator build passed. The dedicated iPhone simulator displayed pages 14 and 15 with the centered header retained after the page turn. Physical-device motion performance remains for the testers.
- Final `Siddur-4-book.xcarchive` passed signature verification and matched the tested native JS/CSS and unchanged PDF byte for byte. Upload succeeded at 10:54 AM. App Store Connect subsequently confirmed **Build 4 Internal - Testing**, assigned to the existing `testers` group with two invites. Build 3 also processed successfully. No external beta or public release was submitted.

## Build 5: crown detail and bottom-corner page turn - October 12, 2026

- Removed the small cross at the top of the home gate's crown using a built-in image edit. Only its 29×36-pixel rectangle was transferred onto the original 887×1774 image: 1,040 changed pixels, with every pixel outside that rectangle verified identical. The existing app icon has a different, non-cross ornament and is unchanged. The corrected active asset is mirrored in `assets/` and `docs/assets/`.
- The paper cylinder now tilts ten degrees, anchored at the lower-left corner. The page starts lifting from the bottom, bends diagonally toward the right binding and reverses naturally on backward navigation. The presenter, cancellation handling, fixed header and original PDF remain unchanged.
- Nine tests passed, including the eight navigation/lifecycle checks and a geometry check across 101 animation positions at three iPhone widths. Early bending stays in the lower part of the page, and all sampled source polygons remain inside the original page with finite transforms.
- Browser visual checks covered the early corner lift, midpoint, reverse motion and fixed header. The header's rectangle stayed `[0, 0, 393, 54.3984375]` while the page curled. The Simulator build passed; physical-device motion performance remains for the testers.
- This update remains an internal TestFlight build. Public App Store submission was explicitly deferred by the owner; the export settings retain `testFlightInternalTestingOnly`.

- Home paper, iOS web-view background and launch background now share `#fcf8ed`, sampled from the gate paper. A short fade on the artwork's blank top/bottom edges removes the hard safe-area seams without changing the gate ornaments.

## Build 6: first-launch guide, menu and icon - October 12, 2026

- Added a 12-step hands-on introduction with a pointing hand, English and Hebrew text, Skip, and replay through the prayer menu's Help button. The initial language follows the phone's primary language (Hebrew locales use Hebrew; other languages use English). An explicit language switch persists. The tour demonstrates choosing a prayer, center-tap controls, Hebrew-direction page turns, original/fitted page size, returning home, daily additions and location choices. It restores the previous bookmark/view preference and defers the automatic location prompt until the introduction ends.
- Removed the native reader's jump-to-page button and the corresponding tutorial steps. Return home to choose a different prayer. The source website reader stays unchanged.
- Replaced the life-cycle category with “ברית, פדיון ונישואין”; healing and memorial prayers sit under “תפילות והוספות”. Every menu prayer entry is retained, including the existing disabled wedding-blessings entry whose page is absent from the source scan.
- Used the owner's exact `Sidur-Master-1254.png` artwork as the app icon, resized proportionally to 1024×1024 with no alpha. Added a fine gold outer border and inset line to the existing home-screen glass buttons.
- Eleven language/navigation/geometry tests and bundled-content checks passed. Browser walkthroughs covered both languages at 393×852 and 320×568, first-launch persistence, Help replay, Skip after changing page size, automatic English on a fresh origin, and removal of the page picker. No browser errors were recorded. The iPhone Simulator build passed and displayed the automatic English introduction. Device Hub input automation was unavailable, so the full gesture walkthrough was validated in the browser using the same production modules; physical-device acceptance remains with the testers.
- Release archive 6 passed deep signature verification and matched the tested JS/CSS, gate artwork, menu and unchanged PDF byte for byte. Distribution remains internal TestFlight only.

## App Store publication steps (not submitted)

1. Finish testing the release on a real iPhone and confirm permission to distribute this siddur edition and its artwork.
2. Prepare a new App Store-eligible archive. These beta archives use Apple's internal-only TestFlight option, which cannot be submitted for public distribution. See https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers .
3. In App Store Connect, complete the listing: name, description, keywords, category, iPhone screenshots, support URL, privacy-policy URL, age rating, pricing and availability. Add the privacy-policy link inside the app as well, and accurately answer App Privacy for the app and its SDKs. See https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy and https://developer.apple.com/app-store/review/guidelines/ .
4. Select the eligible build, answer export-compliance/content-rights questions, and provide review contact information and notes explaining offline reading, daily prayer selection, prayer times, reminders and the optional location feature.
5. Select manual release, then Add for Review and Submit for Review. After Apple approves, use Release This Version when ready. See https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app and https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option .

No public App Store submission or release has been started.

## Build 7: stable language controls - October 12, 2026

- English/Hebrew switching now keeps the language choices in a fixed left-to-right order, with equal border widths and reserved introductory text space so neither button moves horizontally or vertically. Tutorial language/navigation control rows also retain their positions while instruction text follows the selected reading direction.
- Browser measurements confirmed identical button rectangles in both languages at 393×852 (154.5×44 points each) and 320×568 (122×44 points each). The smaller screen keeps the complete introductory card visible without scrolling.
- Final `Siddur-7-final.xcarchive` passed archive/signature checks and matched the tested native assets and original PDF. The earlier `Siddur-7.xcarchive` is an unuploaded intermediate; only the final archive is used for distribution.
- Build 6 processed successfully and was confirmed Testing in the existing two-person internal testers group. Build 7 replaces it with this final placement correction. App Store submission remains deferred.

## Build 8: vertical swipes reveal reader controls - October 12, 2026

- An upward or downward one-finger swipe on the reading page reveals the fixed header/footer. This never hides already visible controls or changes the page. Center tapping remains available to hide/show controls; side taps and horizontal swipes retain Hebrew book navigation.
- Vertical gestures use a 45-point threshold and a clear directional preference. They stop before the existing page-turn handler. Drag-generated synthetic clicks are suppressed so a swipe on an edge cannot also turn a page, or a swipe in the middle immediately hide the revealed controls. Canceled/multi-touch gestures do not trigger the new reveal action. The reading stage retains vertical touch handling instead of allowing browser panning.
- The English/Hebrew guide now teaches this gesture with a vertically moving hand and demonstrates revealing the controls.
- Fourteen tests passed, including upward/downward classification, retaining horizontal turns, cancellation, multi-touch and synthetic-click suppression. Browser fixture checks dispatched touch sequences through the production handlers: up and down both restored `chrome-on` while the page stayed at 14; a horizontal sequence moved to 15 exactly once. The guide demonstration also restored the controls. Actual finger behavior on a physical iPhone remains for TestFlight acceptance.
- Archive 8 passed signature verification and matches the tested native bundle, menu and unchanged PDF. The temporary gesture-test buttons are absent from the release.
