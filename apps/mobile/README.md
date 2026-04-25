# Mobile Client

Expo-based Android/iOS companion for the ChatGPT Code orchestrator.

## Current State

- The app now connects to the real orchestrator HTTP API.
- It can refresh orchestrator status, list sessions, open a session, send a prompt to an existing session, inspect approvals, inspect watchers, inspect goals, view MCP marketplace entries, mark MCP favorites, create device pairing codes, and control tasks and fleet agents through the orchestrator routes.
- Session background start, pause, and resume are wired to the orchestrator session-registry routes.
- The core agent logic still lives in the orchestrator and runtime packages. The phone app remains a remote client.

## Android Build Path

1. Install Android Studio, the Android SDK, and a compatible JDK for Expo SDK 54 / React Native 0.81.
2. From `apps/mobile`, run `npm install`.
3. Run `npm run prebuild:android` to generate the native Android project.
4. Run `npm run apk:debug` to build and install a debug APK on a connected device or emulator.

## Release APK / AAB

- `npm run apk:release` is provided as the next step, but release signing is not configured in-repo.
- To ship a release APK or AAB, you still need:
  - an Android keystore
  - signing configuration in the generated Android project
  - any FCM credentials required for notifications if you enable them

## Honest Gaps

- There is no committed `android/` directory yet because Expo prebuild has not been run and verified in this repository.
- Push notifications are not wired yet.
- The MCP install/update flows and full marketplace management UX are still partial on mobile; the server endpoints exist, but the phone UI currently exposes browse/favorite/status more than full admin workflows.
- A committed `android/` directory still does not exist until `npm run prebuild:android` is executed successfully in this repository.
