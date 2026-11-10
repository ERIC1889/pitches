import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { TickColor } from "@pitches/shared";
import { tickColors } from "../theme";

const ORDER: TickColor[] = ["green", "yellow", "red"];

interface Props {
  color: TickColor;
  /** 녹음 중이면 천천히 숨쉬듯 커졌다 작아진다 */
  active?: boolean;
  size?: number;
}

export function PitchesCircle({ color, active = false, size = 200 }: Props) {
  const colorAnim = useRef(new Animated.Value(ORDER.indexOf(color))).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: ORDER.indexOf(color),
      duration: 300,
      useNativeDriver: false, // 색상 보간은 네이티브 드라이버 미지원
    }).start();
  }, [color, colorAnim]);

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [active, scale]);

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ORDER.map((c) => tickColors[c]),
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View
          style={[
            styles.circle,
            { width: size, height: size, borderRadius: size / 2, backgroundColor },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  circle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
});
