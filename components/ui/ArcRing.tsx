import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface ArcRingProps {
  percent: number;
  size: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function ArcRing({ percent, size, strokeWidth = 10, color, trackColor, label, sublabel }: ArcRingProps) {
  const colors = useThemeColors();
  const ringColor = color ?? colors.primary;
  const track = trackColor ?? colors.primaryMuted;
  const cx = size / 2;
  const r = (size - strokeWidth) / 2;
  const clampedPct = Math.min(Math.max(percent, 0), 99.99);
  const endAngle = (clampedPct / 100) * 360;

  const d = percent >= 100
    ? `M ${cx} ${strokeWidth / 2} A ${r} ${r} 0 1 1 ${cx - 0.01} ${strokeWidth / 2}`
    : describeArc(cx, cx, r, 0, endAngle);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(clampedPct, { stiffness: 280, damping: 28 });
  }, [clampedPct]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={cx} cy={cx} r={r}
          stroke={track} strokeWidth={strokeWidth}
          fill="none" strokeLinecap="round"
        />
        {percent > 0 && (
          <Path
            d={d}
            stroke={ringColor} strokeWidth={strokeWidth}
            fill="none" strokeLinecap="round"
          />
        )}
      </Svg>
      {label !== undefined && (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 13 }}>{label}</Text>
          {sublabel !== undefined && (
            <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 10 }}>{sublabel}</Text>
          )}
        </View>
      )}
    </View>
  );
}
