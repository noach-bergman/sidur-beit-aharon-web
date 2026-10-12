# iPhone app

Isolated Capacitor iPhone package for the redesigned siddur. Bundle ID: `com.noachbergman.siddurbeitaharon`. Version 1.0.0, build 1. The website in `docs/` remains the source of the interface; native adaptations are generated into ignored `www/` and `ios/App/App/public/` directories.

The printed PDF and all prayer/calendar data are copied byte for byte. PDF.js 3.11.174 and the Hebrew fonts are bundled locally. Only native resource paths, native geolocation, installed-app UI, and service-worker registration are adapted. GPS is optional; denied location falls back to the existing manual city selection. There is no background location tracking or app analytics.

## Build

```sh
cd native
npm ci
npm run sync
node scripts/verify.mjs
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/Siddur-1.xcarchive -derivedDataPath build/DerivedData -allowProvisioningUpdates archive
```

For TestFlight, create the matching app record in the owner's App Store Connect account, then upload with:

```sh
xcodebuild -exportArchive -archivePath build/Siddur-1.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/upload -allowProvisioningUpdates
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
