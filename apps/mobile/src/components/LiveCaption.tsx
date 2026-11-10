import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { splitCaptionTokens } from "@pitches/shared";
import { colors } from "../theme";

interface Props {
  /** 지금 말하고 있는 한 문장 */
  sentence: string;
}

/** 실시간 자막. 문장이 바뀔 때마다 페이드인, 간투사(음·어)는 노란색으로 강조 */
export function LiveCaption({ sentence }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!sentence) return;
    opacity.setValue(0.2);
    Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [sentence, opacity]);

  return (
    <Animated.View style={[styles.box, { opacity }]} testID="live-caption">
      <Text style={styles.label}>실시간 자막</Text>
      {sentence ? (
        <Text style={styles.sentence} numberOfLines={3}>
          {splitCaptionTokens(sentence).map((t, i) =>
            t.filler ? (
              <Text key={i} style={styles.filler}>
                {t.text}
              </Text>
            ) : (
              t.text
            )
          )}
        </Text>
      ) : (
        <Text style={styles.placeholder}>말하면 여기에 한 문장씩 자막이 나와요</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 92,
    justifyContent: "center",
  },
  label: { fontSize: 12, fontWeight: "700", color: colors.subtle, marginBottom: 6 },
  sentence: { fontSize: 19, lineHeight: 27, fontWeight: "600", color: colors.text },
  filler: { backgroundColor: "#FEF3C7", color: "#B45309" },
  placeholder: { fontSize: 15, color: colors.subtle },
});
