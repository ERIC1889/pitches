// Xcode 27 부터 Pod 의 낮은 배포 타깃이 빌드 에러가 된다.
//  - SDWebImage·RNSVG 리소스 번들: iOS 9.0/12.4 → "지원 범위 밖" 에러
//  - expo-router 등: podspec 은 15.1 인데 iOS 16 API 를 가용성 검사 없이 사용 → Swift 컴파일 에러
// prebuild 마다 Podfile 이 새로 만들어지므로, post_install 에서 모든 Pod 타깃의 최소 버전을 앱과 맞춘다.
const { withPodfile } = require("expo/config-plugins");

const BEGIN = "# @pitches/pods-deployment-target begin";
const END = "# @pitches/pods-deployment-target end";

module.exports = function withPodsDeploymentTarget(config, { target }) {
  return withPodfile(config, (cfg) => {
    const block = `    ${BEGIN}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |bc|
        if bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${target}
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${target}'
        end
      end
    end
    ${END}
`;
    // 이전 prebuild 가 넣은 블록(구버전 마커 포함)을 지우고 현재 target 으로 다시 넣는다
    const cleaned = cfg.modResults.contents
      .replace(/ {4}# @pitches\/pods-deployment-target begin[\s\S]*?# @pitches\/pods-deployment-target end\n/, "")
      .replace(/ {4}# @pitches\/pods-deployment-target\n[\s\S]*?\n {4}end\n/, "");
    cfg.modResults.contents = cleaned.replace(
      /post_install do \|installer\|\n/,
      (m) => m + block
    );
    return cfg;
  });
};
