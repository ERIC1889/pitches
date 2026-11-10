import { useEffect, useState } from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  EMOTION_LABEL_KO,
  TICK_THRESHOLDS,
  type FeedbackTick,
} from "@pitches/shared";
import { LiveCaption } from "../../src/components/LiveCaption";
import { PitchesCircle } from "../../src/components/PitchesCircle";
import { useLiveSession } from "../../src/hooks/useLiveSession";
import { formatClock } from "../../src/lib/format";
import { colors, tickColors } from "../../src/theme";

const MAX_TIPS = 2;

export default function RecordScreen() {
  const router = useRouter();
  // fullScreenModal 안의 SafeAreaView 는 상단 여백을 0 으로 잡을 때가 있어 루트에서 잰 값을 쓴다
  const insets = useSafeAreaInsets();
  const { status, color, tip, error, lastTick, elapsedMs, caption, start, stop } =
    useLiveSession();
  const [tips, setTips] = useState<string[]>([]);

  const isIdle = status === "idle" || status === "ended" || status === "error";
  const isRecording = status === "recording";
  const isBusy = status === "starting" || status === "stopping";

  // 발표 중 나온 개선 팁을 최근 순으로 중복 없이 모아 하단 카드에 보여준다
  useEffect(() => {
    const t = lastTick?.tip;
    if (!t) return;
    setTips((prev) => [t, ...prev.filter((p) => p !== t)].slice(0, MAX_TIPS));
  }, [lastTick]);

  const handleStart = async () => {
    setTips([]);
    await start({ title: `발표 ${new Date().toLocaleString("ko-KR")}` });
  };

  const handleStop = async () => {
    const sessionId = await stop();
    if (sessionId) router.replace(`/session/${sessionId}`);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>
          <Text style={styles.brand}>Pitches.ai </Text>실시간 분석
        </Text>
        <TouchableOpacity onPress={() => router.back()} disabled={isRecording || isBusy}>
          <Ionicons
            name="close"
            size={24}
            color={isRecording || isBusy ? colors.border : colors.muted}
          />
        </TouchableOpacity>
      </View>

      <PitchesCircle color={color} active={isRecording} size={isRecording ? 170 : 200} />

      <Text style={styles.headline}>{tip}</Text>
      {(isRecording || isBusy) && <Text style={styles.clock}>{formatClock(elapsedMs)}</Text>}
      {isRecording && lastTick && (
        <View style={styles.metricRow}>
          <Ionicons name="speedometer-outline" size={18} color={tickColors[lastTick.color]} />
          <Text style={styles.metricText}>{describeTick(lastTick)}</Text>
        </View>
      )}
      {isRecording && <LiveCaption sentence={caption} />}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flex: 1 }} />

      {isIdle && (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleStart} testID="record-start">
          <Text style={styles.btnText}>발표 시작</Text>
        </TouchableOpacity>
      )}
      {isRecording && (
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: tickColors[color] }]}
          onPress={handleStop}
          testID="record-stop"
        >
          <Text style={styles.btnText}>발표 종료</Text>
        </TouchableOpacity>
      )}
      {isBusy && (
        <View style={[styles.primaryBtn, { backgroundColor: colors.subtle }]}>
          <Text style={styles.btnText}>
            {status === "starting" ? "연결 중..." : "분석 요청 중..."}
          </Text>
        </View>
      )}

      {isRecording && (
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>발표 개선 Tip</Text>
          {tips.length === 0 ? (
            <Text style={styles.tipItem}>아직 지적할 점이 없어요. 이대로 계속하세요!</Text>
          ) : (
            tips.map((t) => (
              <View key={t} style={styles.tipRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.muted} />
                <Text style={styles.tipItem}>{t}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

/** 직전 5초 구간의 수치를 한 줄로 요약 */
function describeTick(t: FeedbackTick): string {
  if (t.silent) return "목소리가 잘 들리지 않아요";
  const parts: string[] = [];
  if (t.speedWpm > 0) parts.push(`속도 ${Math.round(t.speedWpm)}자/분`);
  parts.push(t.volumeDb < TICK_THRESHOLDS.VOLUME_MIN_DB ? "음량 작음" : "음량 적정");
  parts.push(`간투사 ${t.fillerCnt}회`);
  if (t.emotion) parts.push(`감정 ${EMOTION_LABEL_KO[t.emotion]}`);
  return parts.join(" · ");
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerText: { fontSize: 15, color: colors.muted },
  brand: { fontWeight: "800", color: colors.text },
  headline: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    color: colors.text,
    lineHeight: 30,
  },
  clock: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8 },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  metricText: { fontSize: 13, color: colors.muted },
  error: { fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 12 },
  primaryBtn: {
    backgroundColor: colors.brand,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  tipCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: 8,
  },
  tipTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipItem: { fontSize: 13, color: colors.muted, flexShrink: 1 },
});
