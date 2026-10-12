# iPhone app

Isolated Capacitor iPhone package for the redesigned siddur. Bundle ID: `com.noachbergman.siddurbeitaharon`. Version 1.0.0, build 3. The website in `docs/` remains the source of the interface; native adaptations are generated into ignored `www/` and `ios/App/App/public/` directories.

The printed PDF and all prayer/calendar data are copied byte for byte. PDF.js 3.11.174 and the Hebrew fonts are bundled locally. Only native resource paths, native geolocation, installed-app UI, and service-worker registration are adapted. GPS is optional; denied location falls back to the existing manual city selection. There is no background location tracking or app analytics.

## Build

```sh
cd native
npm ci
npm run sync
node scripts/verify.mjs
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/Siddur-3.xcarchive -derivedDataPath build/DerivedData -allowProvisioningUpdates archive
```

For TestFlight, create the matching app record in the owner's App Store Connect account, then upload with:

```sh
xcodebuild -exportArchive -archivePath build/Siddur-3.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/upload-3 -allowProvisioningUpdates
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
