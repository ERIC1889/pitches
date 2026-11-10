import type { ExpoConfig } from "expo/config";

// @siteed/audio-studio podspec 이 iOS 16.4+ 를 요구한다. 이보다 낮으면 Expo 자동 링크에서 조용히 빠져
// 런타임에 "Cannot find native module 'AudioStudio'" 가 난다.
const IOS_DEPLOYMENT_TARGET = "16.4";

const config: ExpoConfig = {
  name: "Pitches",
  slug: "pitches",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "pitches",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    backgroundColor: "#4F46E5",
    resizeMode: "contain",
  },
  ios: {
    bundleIdentifier: "ai.pitches.app",
    supportsTablet: false,
    infoPlist: {
      NSMicrophoneUsageDescription: "발표 분석을 위해 마이크 권한이 필요합니다.",
      UIBackgroundModes: ["audio"],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "ai.pitches.app",
    permissions: ["RECORD_AUDIO", "INTERNET"],
    adaptiveIcon: {
      backgroundColor: "#4F46E5",
    },
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-secure-store",
    // Xcode 27 은 Pod 의 낮은 배포 타깃을 에러로 처리 → 앱·Pod 전체를 같은 최소 버전으로
    ["expo-build-properties", { ios: { deploymentTarget: IOS_DEPLOYMENT_TARGET } }],
    ["./plugins/withPodsDeploymentTarget", { target: IOS_DEPLOYMENT_TARGET }],
    [
      "@siteed/audio-studio",
      {
        enableBackgroundAudio: true,
        // 통화 상태·블루투스 장치 감지·알림은 안 씀 → 불필요한 권한 요청 방지
        enablePhoneStateHandling: false,
        enableDeviceDetection: false,
        enableNotifications: false,
        iosBackgroundModes: { useAudio: true },
        iosConfig: {
          microphoneUsageDescription: "발표 분석을 위해 마이크 권한이 필요합니다.",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  },
};

export default config;
