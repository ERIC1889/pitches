import { useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const url = mode === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        mode === "login" ? { email, password } : { email, password, name };
      const res = await apiClient.post(url, payload);
      await setAuth(res.data.token, res.data.user);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert(
        mode === "login" ? "로그인 실패" : "가입 실패",
        err.response?.data?.error ?? "알 수 없는 오류"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.title}>Pitches.ai</Text>
        <Text style={styles.subtitle}>멀티모달 AI 스피치 코칭</Text>

        {mode === "signup" && (
          <TextInput
            style={styles.input}
            placeholder="이름"
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="이메일"
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호 (8자 이상)"
          testID="login-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={submit}
          disabled={loading}
          testID="login-submit"
        >
          <Text style={styles.primaryBtnText}>
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode(mode === "login" ? "signup" : "login")}
        >
          <Text style={styles.toggleText}>
            {mode === "login"
              ? "계정이 없으신가요? 가입하기"
              : "이미 계정이 있으신가요? 로그인"}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 40, fontWeight: "800", color: "#4F46E5", marginTop: 48 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 40 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#F9FAFB",
  },
  primaryBtn: {
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  toggleText: {
    marginTop: 24,
    textAlign: "center",
    color: "#4F46E5",
    fontSize: 14,
  },
});
