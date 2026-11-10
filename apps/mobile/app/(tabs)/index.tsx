import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useSessions } from "../../src/api/queries";
import { SessionListItem } from "../../src/components/SessionListItem";
import { useAuthStore } from "../../src/store/auth";
import { colors } from "../../src/theme";

const RECENT_COUNT = 3;

export default function HomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data: sessions = [], isLoading } = useSessions();
  const recent = sessions.filter((s) => s.status === "COMPLETED").slice(0, RECENT_COUNT);

  const confirmSignOut = () =>
    Alert.alert("로그아웃", "로그아웃할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await signOut();
          qc.clear();
          router.replace("/(auth)/login");
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Pitches.ai</Text>
          <Text style={styles.hello}>안녕하세요, {user?.name ?? "사용자"}님</Text>
        </View>
        <TouchableOpacity onPress={confirmSignOut} hitSlop={12}>
          <Ionicons name="log-out-outline" size={24} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ gap: 16 }}>
        <View style={styles.heroBox}>
          <Text style={styles.heroTitle}>
            버튼을 누르고{"\n"}스피치를 시작하세요
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push("/session/record")}
            testID="home-start"
          >
            <Text style={styles.startBtnText}>발표 시작</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => router.push("/(tabs)/history")}
          >
            <Text style={styles.sectionTitle}>최근 생성한 보고서</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
          </TouchableOpacity>
          {recent.length === 0 ? (
            <Text style={styles.empty}>
              {isLoading ? "불러오는 중..." : "아직 기록이 없습니다."}
            </Text>
          ) : (
            recent.map((s) => (
              <SessionListItem
                key={s.id}
                session={s}
                onPress={() => router.push(`/session/${s.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 12,
    marginBottom: 24,
  },
  brand: { fontSize: 24, fontWeight: "800", color: colors.brand },
  hello: { fontSize: 14, color: colors.muted, marginTop: 4 },
  heroBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
  },
  heroTitle: { fontSize: 22, fontWeight: "700", lineHeight: 30, color: colors.text },
  startBtn: {
    backgroundColor: colors.brand,
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  empty: { color: colors.subtle, fontSize: 14, marginTop: 12 },
});
