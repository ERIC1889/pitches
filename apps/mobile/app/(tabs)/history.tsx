import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProgress, useSessions } from "../../src/api/queries";
import { AccuracyChart } from "../../src/components/AccuracyChart";
import { SessionListItem } from "../../src/components/SessionListItem";
import { colors } from "../../src/theme";

export default function HistoryScreen() {
  const router = useRouter();
  const sessions = useSessions();
  const progress = useProgress();
  const accuracies = (progress.data ?? [])
    .map((p) => p.accuracy)
    .filter((a): a is number => a != null);

  const refresh = () => {
    void sessions.refetch();
    void progress.refetch();
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sessions.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={sessions.isRefetching} onRefresh={refresh} />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.title}>발표 기록</Text>
            {accuracies.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>정확도 추이</Text>
                <AccuracyChart values={accuracies} />
              </View>
            )}
          </>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <SessionListItem
            session={item}
            onPress={() => router.push(`/session/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          sessions.isLoading ? null : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>아직 발표 기록이 없습니다.</Text>
              <Text style={styles.emptyHint}>홈 탭에서 첫 발표를 시작해보세요.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", marginTop: 12, marginBottom: 20, color: colors.text },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    gap: 8,
  },
  chartTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  separator: { height: 1, backgroundColor: colors.border },
  emptyBox: { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.muted },
  emptyHint: { fontSize: 13, color: colors.subtle, marginTop: 8 },
});
