import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SessionSummary } from "../api/queries";
import { formatDateTime, formatDuration } from "../lib/format";
import { accuracyColor, colors } from "../theme";

const STATUS_LABEL: Record<SessionSummary["status"], string> = {
  IN_PROGRESS: "미완료",
  ANALYZING: "분석 중",
  COMPLETED: "완료",
  FAILED: "실패",
};

interface Props {
  session: SessionSummary;
  onPress: () => void;
}

export function SessionListItem({ session, onPress }: Props) {
  const { accuracy, status } = session;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View
        style={[
          styles.dot,
          { backgroundColor: accuracy != null ? accuracyColor(accuracy) : colors.border },
        ]}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {session.title}
        </Text>
        <Text style={styles.meta}>
          {formatDateTime(session.createdAt)} · {formatDuration(session.durationSec)}
        </Text>
      </View>
      {status === "COMPLETED" && accuracy != null ? (
        <Text style={styles.accuracy}>{accuracy}%</Text>
      ) : (
        <Text style={[styles.badge, status === "FAILED" && { color: colors.danger }]}>
          {STATUS_LABEL[status]}
        </Text>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  accuracy: { fontSize: 16, fontWeight: "800", color: colors.brandDark },
  badge: { fontSize: 13, color: colors.muted },
});
