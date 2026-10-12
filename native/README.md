# iPhone app

Isolated Capacitor iPhone package for the redesigned siddur. Bundle ID: `com.noachbergman.siddurbeitaharon`. Version 1.0.0, build 2. The website in `docs/` remains the source of the interface; native adaptations are generated into ignored `www/` and `ios/App/App/public/` directories.

The printed PDF and all prayer/calendar data are copied byte for byte. PDF.js 3.11.174 and the Hebrew fonts are bundled locally. Only native resource paths, native geolocation, installed-app UI, and service-worker registration are adapted. GPS is optional; denied location falls back to the existing manual city selection. There is no background location tracking or app analytics.

## Build

```sh
cd native
npm ci
npm run sync
node scripts/verify.mjs
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/Siddur-2.xcarchive -derivedDataPath build/DerivedData -allowProvisioningUpdates archive
```

For TestFlight, create the matching app record in the owner's App Store Connect account, then upload with:

```sh
xcodebuild -exportArchive -archivePath build/Siddur-2.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/upload-2 -allowProvisioningUpdates
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
- Content verification and the Simulator build passed. Release upload status is recorded below after delivery.
