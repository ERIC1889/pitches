// 시뮬레이터 데모 캡처용 XCUITest. ios/ 는 prebuild 때 재생성되므로 필요할 때 타깃을 추가해서 쓴다.
//   GEM_HOME=$(ls -d /opt/homebrew/Cellar/cocoapods/*/libexec | head -1) /opt/homebrew/opt/ruby/bin/ruby \
//     e2e/add_uitest.rb ios/Pitches.xcodeproj "$PWD/e2e/PitchesFlowUITests.swift"
//   xcodebuild build-for-testing -workspace ios/Pitches.xcworkspace -scheme PitchesUITests -sdk iphonesimulator \
//     -destination "id=<UDID>" -derivedDataPath ios/build/dd
//   xcrun simctl io <UDID> recordVideo --codec=h264 --force demo.mp4 &
//   TEST_RUNNER_SHOT_DIR=<폴더> xcodebuild test-without-building ... -only-testing:PitchesUITests/PitchesFlowUITests/test1Live
import XCTest

final class PitchesFlowUITests: XCTestCase {
  private let env = ProcessInfo.processInfo.environment
  private var shotDir: String { env["SHOT_DIR"] ?? NSTemporaryDirectory() }

  private func shot(_ name: String) {
    let png = XCUIScreen.main.screenshot().pngRepresentation
    try? png.write(to: URL(fileURLWithPath: "\(shotDir)/\(name).png"))
  }

  private func id(_ app: XCUIApplication, _ s: String) -> XCUIElement {
    app.descendants(matching: .any)[s].firstMatch
  }

  private func label(_ app: XCUIApplication, _ s: String) -> XCUIElement {
    app.descendants(matching: .any)
      .matching(NSPredicate(format: "label CONTAINS %@", s)).firstMatch
  }

  /// 로그인 직후 뜨는 iOS "암호를 저장하겠습니까?" 창 닫기 (앱 또는 SpringBoard 소유)
  private func dismissSavePassword(_ app: XCUIApplication) {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    for _ in 0..<16 {
      for candidate in [app.buttons["지금 안 함"], springboard.buttons["지금 안 함"]]
      where candidate.exists {
        candidate.tap()
        sleep(1)
        return
      }
      sleep(1)
    }
  }

  private func launch() -> XCUIApplication {
    let app = XCUIApplication()
    app.launch()
    let server = label(app, "8081")
    if server.waitForExistence(timeout: 8) { server.tap() }
    return app
  }

  /// 로그인 → 홈 → 실시간 분석 → 종료 → 분석 대기
  func test1Live() throws {
    let app = launch()
    let email = id(app, "login-email")
    if email.waitForExistence(timeout: 60) {
      sleep(1)
      let toLogin = label(app, "이미 계정이")
      if toLogin.exists { toLogin.tap(); sleep(1) }
      shot("01-login")
      email.tap()
      email.typeText("sim@pitches.local")
      let pw = id(app, "login-password")
      pw.tap()
      pw.typeText("simulate1234")
      shot("02-login-filled")
      id(app, "login-submit").tap()
      dismissSavePassword(app)
    }
    let start = id(app, "home-start")
    XCTAssertTrue(start.waitForExistence(timeout: 40), "홈 화면 안 보임")
    sleep(3)
    shot("03-home")
    start.tap()
    let recordStart = id(app, "record-start")
    XCTAssertTrue(recordStart.waitForExistence(timeout: 15))
    sleep(1)
    shot("04-record-ready")
    recordStart.tap()
    let stop = id(app, "record-stop")
    XCTAssertTrue(stop.waitForExistence(timeout: 25), "녹음 시작 안 됨")
    for i in 1...4 {
      sleep(6)
      shot(String(format: "05-recording-%02d", i))
    }
    stop.tap()
    sleep(2)
    shot("06-after-stop")
    sleep(4)
    shot("07-after-stop-later")
  }

  /// 기록 → 저장된 보고서 → 상세 → PDF 공유
  func test2Results() throws {
    let app = launch()
    let tab = label(app, "기록")
    XCTAssertTrue(tab.waitForExistence(timeout: 60), "탭 안 보임")
    sleep(3)
    shot("10-home")
    tab.tap()
    sleep(4)
    shot("11-history")
    let row = label(app, "시뮬레이션")
    XCTAssertTrue(row.waitForExistence(timeout: 10))
    row.tap()
    let detail = id(app, "result-detail")
    XCTAssertTrue(detail.waitForExistence(timeout: 20), "결과 화면 안 보임")
    sleep(4)
    shot("12-result")
    app.swipeUp()
    sleep(2)
    shot("13-result-chart")
    detail.tap()
    sleep(3)
    shot("14-report-top")
    app.swipeUp()
    sleep(2)
    shot("15-report-voice")
    app.swipeUp()
    sleep(2)
    shot("16-report-more")
    label(app, "PDF로 저장").tap()
    sleep(7)
    shot("17-pdf-share")
  }
}
