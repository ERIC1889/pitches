import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  EMOTION_LABEL_KO,
  summarizeEmotions,
  type Emotion,
  type SpeechMetrics,
} from "@pitches/shared";
import {
  queryKeys,
  useProgress,
  useRetryAnalysis,
  useSession,
  type ReportDetail,
  type SessionDetail,
} from "../../src/api/queries";
import { AccuracyChart } from "../../src/components/AccuracyChart";
import { sharePdf } from "../../src/report/sharePdf";
import { formatDateTime, formatDuration } from "../../src/lib/format";
import { colors, tickColors } from "../../src/theme";

/**
 * 발표 결과 화면 (발표자료 슬라이드 6).
 *  - 요약: 스피치 정확도 · 이렇게 달라졌어요 · 정확도 그래프
 *  - 상세 분석: AI 코칭 보고서 전체 + PDF 저장
 */
export default function SessionResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session, isLoading, isError, refetch } = useSession(id);
  const [mode, setMode] = useState<"summary" | "detail">("summary");

  // 분석이 끝나면 목록·추이도 새로 받아온다
  useEffect(() => {
    if (session?.status === "COMPLETED") {
      void qc.invalidateQueries({ queryKey: queryKeys.sessions });
      void qc.invalidateQueries({ queryKey: queryKeys.progress });
    }
  }, [session?.status, qc]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          <Text style={styles.brand}>Pitches.ai </Text>
          {mode === "detail" ? "상세 분석" : "분석 결과"}
        </Text>
        <TouchableOpacity onPress={close}>
          <Ionicons name="close" size={24} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Centered>
          <ActivityIndicator color={colors.brand} />
        </Centered>
      ) : isError || !session ? (
        <Centered>
          <Text style={styles.stateTitle}>결과를 불러오지 못했어요</Text>
          <TextButton label="다시 시도" onPress={() => refetch()} />
        </Centered>
      ) : session.status === "COMPLETED" && session.report ? (
        mode === "summary" ? (
          <Summary
            session={session}
            report={session.report}
            onDetail={() => setMode("detail")}
            onClose={close}
          />
        ) : (
          <Detail
            session={session}
            report={session.report}
            onBack={() => setMode("summary")}
          />
        )
      ) : (
        <Pending session={session} />
      )}
    </SafeAreaView>
  );
}

function Summary({
  session,
  report,
  onDetail,
  onClose,
}: {
  session: SessionDetail;
  report: ReportDetail;
  onDetail: () => void;
  onClose: () => void;
}) {
  const { data: points = [] } = useProgress();
  const accuracy = report.speechMetrics.accuracy ?? report.overallScore;
  const history = points.filter((p) => p.accuracy != null);
  const idx = history.findIndex((p) => p.sessionId === session.id);
  const prev = idx > 0 ? history[idx - 1]!.accuracy! : null;
  const diff = prev != null ? accuracy - prev : null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>나의 스피치 정확도</Text>
            {diff != null && (
              <Text style={styles.badge}>
                지난 발표 대비 {diff >= 0 ? "+" : ""}
                {diff}%p
              </Text>
            )}
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.bigNumber}>{accuracy}%</Text>
            <View style={styles.gauge}>
              <View style={[styles.gaugeFill, { height: `${accuracy}%` }]} />
            </View>
          </View>
          <Text style={styles.meta}>
            종합 {report.overallScore}점 · {formatDuration(session.durationSec)} ·{" "}
            {formatDateTime(session.createdAt)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>이렇게 달라졌어요</Text>
          <EmotionPoint metrics={report.speechMetrics} />
          {report.summary.strengths[0] && (
            <Point
              icon="checkmark-circle"
              color={tickColors.green}
              text={report.summary.strengths[0]}
            />
          )}
          {report.summary.weaknesses[0] && (
            <Point
              icon="alert-circle"
              color={tickColors.yellow}
              text={report.summary.weaknesses[0]}
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>정확도 그래프</Text>
          <AccuracyChart values={history.map((p) => p.accuracy!)} />
        </View>
      </ScrollView>
      <ButtonBar
        secondary={{ label: "돌아가기", onPress: onClose }}
        primary={{ label: "상세 분석 AI", onPress: onDetail, testID: "result-detail" }}
      />
    </>
  );
}

function Detail({
  session,
  report,
  onBack,
}: {
  session: SessionDetail;
  report: ReportDetail;
  onBack: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const r = report.summary;

  const handleShare = async () => {
    setSharing(true);
    try {
      await sharePdf(report.id, session.title);
    } catch (e) {
      Alert.alert("PDF 저장 실패", e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.reportTitle}>스피치 코칭 보고서</Text>
        <View style={styles.card}>
          <Section title="1. 발표 분석 요약">
            <Body>주제: {r.summary.mainTopic}</Body>
            {r.summary.keyMessages.map((m) => (
              <Bullet key={m} text={m} />
            ))}
          </Section>
          <Section title="2. 음성 분석">
            <Labeled label="목소리 톤" text={r.voiceAnalysis.tone} />
            <Labeled label="말하기 속도" text={r.voiceAnalysis.speed} />
            <Labeled label="명료성" text={r.voiceAnalysis.clarity} />
            <Labeled label="안정성" text={r.voiceAnalysis.stability} />
            <EmotionBars metrics={report.speechMetrics} />
          </Section>
          <Section title="3. 내용 분석">
            <Labeled label="논리성" text={r.contentAnalysis.logic} />
            <Labeled label="구조" text={r.contentAnalysis.structure} />
            <Labeled label="설득력" text={r.contentAnalysis.persuasiveness} />
          </Section>
          <Section title="4. 강점">
            {r.strengths.map((s) => (
              <Bullet key={s} text={s} />
            ))}
          </Section>
          <Section title="5. 개선점">
            {r.weaknesses.map((w) => (
              <Bullet key={w} text={w} />
            ))}
          </Section>
          <Section title="6. 개선 로드맵">
            <Body bold>단기 (2주)</Body>
            {r.roadmap.shortTerm.map((s) => (
              <Bullet key={s} text={s} />
            ))}
            <Body bold>장기 (3개월+)</Body>
            {r.roadmap.longTerm.map((s) => (
              <Bullet key={s} text={s} />
            ))}
          </Section>
          <Section title="7. 발표 스크립트">
            <Body>{report.transcript}</Body>
          </Section>
        </View>
      </ScrollView>
      <ButtonBar
        secondary={{ label: "돌아가기", onPress: onBack }}
        primary={{
          label: sharing ? "준비 중..." : "PDF로 저장",
          onPress: handleShare,
          disabled: sharing,
        }}
      />
    </>
  );
}

/** 분석 중 / 실패 / 중간에 끊긴 세션 */
function Pending({ session }: { session: SessionDetail }) {
  const retry = useRetryAnalysis(session.id);

  if (session.status === "ANALYZING") {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.stateTitle}>AI가 발표를 분석하고 있어요</Text>
        <Text style={styles.meta}>보통 30초~1분 정도 걸려요</Text>
      </Centered>
    );
  }

  const handleRetry = () =>
    retry.mutate(undefined, {
      onError: () => Alert.alert("다시 분석할 수 없어요", "녹음된 음성이 없는 발표예요."),
    });

  return (
    <Centered>
      <Ionicons name="alert-circle-outline" size={40} color={colors.subtle} />
      <Text style={styles.stateTitle}>
        {session.status === "FAILED" ? "분석에 실패했어요" : "분석이 시작되지 않은 발표예요"}
      </Text>
      <TextButton label={retry.isPending ? "요청 중..." : "다시 분석하기"} onPress={handleRetry} />
    </Centered>
  );
}

/** 발표자료 시안의 "감정이 적절해요 / 감정을 더 표현하세요" */
function EmotionPoint({ metrics }: { metrics: SpeechMetrics }) {
  const s = summarizeEmotions(metrics.emotionCounts);
  if (!s) return null;
  if (s.negativeRatio >= 0.3) {
    return (
      <Point
        icon="pulse"
        color={tickColors.yellow}
        text="긴장한 구간이 많았어요. 호흡을 가다듬고 천천히 시작해보세요."
      />
    );
  }
  if (s.dominant === "NEUTRAL" && s.ratio >= 0.9) {
    return (
      <Point
        icon="pulse"
        color={tickColors.yellow}
        text="감정을 더 표현하세요. 강조할 부분에서 목소리에 힘을 실어보세요."
      />
    );
  }
  return <Point icon="pulse" color={tickColors.green} text="감정이 적절해요." />;
}

/** 5초 구간별 감정 분포 막대 */
function EmotionBars({ metrics }: { metrics: SpeechMetrics }) {
  const s = summarizeEmotions(metrics.emotionCounts);
  if (!s) return null;
  const rows = (Object.entries(metrics.emotionCounts ?? {}) as [Emotion, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  return (
    <View style={styles.emotionBox}>
      <Text style={[styles.body, { fontWeight: "700" }]}>감정 분포</Text>
      {rows.map(([emotion, n]) => {
        const pct = Math.round((n / s.total) * 100);
        return (
          <View key={emotion} style={styles.emotionRow}>
            <Text style={styles.emotionLabel}>{EMOTION_LABEL_KO[emotion]}</Text>
            <View style={styles.emotionTrack}>
              <View style={[styles.emotionFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.emotionPct}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.textBtn}>
      <Text style={styles.textBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ButtonBar({
  primary,
  secondary,
}: {
  primary: { label: string; onPress: () => void; disabled?: boolean; testID?: string };
  secondary: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.buttonBar}>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={secondary.onPress}>
        <Text style={styles.btnSecondaryText}>{secondary.label}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, primary.disabled && { opacity: 0.6 }]}
        onPress={primary.onPress}
        disabled={primary.disabled}
        testID={primary.testID}
      >
        <Text style={styles.btnPrimaryText}>{primary.label}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Point({
  icon,
  color,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
}) {
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <Text style={[styles.body, bold && { fontWeight: "700" }]}>{children}</Text>;
}

function Labeled({ label, text }: { label: string; text: string }) {
  return (
    <Text style={styles.body}>
      <Text style={{ fontWeight: "700" }}>{label}: </Text>
      {text}
    </Text>
  );
}

function Bullet({ text }: { text: string }) {
  return <Text style={styles.body}>•  {text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerText: { fontSize: 15, color: colors.muted },
  brand: { fontWeight: "800", color: colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  bigNumber: { fontSize: 56, fontWeight: "800", color: colors.brandDark },
  gauge: {
    width: 10,
    height: 72,
    borderRadius: 5,
    backgroundColor: colors.border,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  gaugeFill: { width: "100%", backgroundColor: colors.brandDark, borderRadius: 5 },
  meta: { fontSize: 12, color: colors.muted },
  point: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pointText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  reportTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
  section: { gap: 4, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 2 },
  body: { fontSize: 14, color: colors.text, lineHeight: 21 },
  emotionBox: { marginTop: 6, gap: 6 },
  emotionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  emotionLabel: { width: 64, fontSize: 13, color: colors.muted },
  emotionTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border },
  emotionFill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
  emotionPct: { width: 40, textAlign: "right", fontSize: 13, color: colors.text },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  stateTitle: { fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" },
  textBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  textBtnLabel: { fontSize: 15, fontWeight: "700", color: colors.brand },
  buttonBar: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  btnSecondary: { backgroundColor: colors.surface },
  btnSecondaryText: { fontSize: 16, fontWeight: "700", color: colors.text },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
