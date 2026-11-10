import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../theme";

interface Props {
  /** 정확도(0~100) 시계열, 오래된 순 */
  values: number[];
  height?: number;
}

const PAD = 10;

/** 정확도 추이 꺾은선 그래프 (발표자료 시안의 "정확도 그래프") */
export function AccuracyChart({ values, height = 140 }: Props) {
  const [width, setWidth] = useState(0);

  if (values.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>발표를 2회 이상 하면 추이가 보여요</Text>
      </View>
    );
  }

  const stepX = (width - PAD * 2) / (values.length - 1);
  const toY = (v: number) => PAD + (1 - v / 100) * (height - PAD * 2);
  const pts = values.map((v, i) => ({ x: PAD + i * stepX, y: toY(v) }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]!.x},${height} L${pts[0]!.x},${height} Z`;
  const last = pts[pts.length - 1]!;

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brand} stopOpacity={0.18} />
              <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#fill)" />
          <Path
            d={line}
            stroke={colors.brandDark}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={last.x} cy={last.y} r={5} fill={colors.brand} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { justifyContent: "center", alignItems: "center" },
  emptyText: { color: colors.subtle, fontSize: 13 },
});
