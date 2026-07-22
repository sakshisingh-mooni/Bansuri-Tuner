import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText, G } from 'react-native-svg';
import { SWARAS, type SwaraId } from '../theory/swaras';
import { colors, typography } from '../theme/tokens';

const AnimatedG = Animated.createAnimatedComponent(G);

const SIZE = 300;
const CENTER = SIZE / 2;
const OUTER_R = 122;
const TICK_R_OUTER = 122;
const TICK_R_INNER_SA = 98;
const TICK_R_INNER = 108;
const LABEL_R = 84;
const PRESS_FEEDBACK_MS = 220;
const NEEDLE_LEN = 96;

function angleForCents(cents: number): number {
  // 0 cents (Sa) points straight up; sweeps clockwise through the octave.
  return (cents / 1200) * 360 - 90;
}

function polar(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

interface SwaraDialProps {
  centsFromSa: number | null;
  nearestSwaraId: SwaraId | null;
  deviationCents: number | null;
  isListening: boolean;
  /** In-tune threshold in cents — user-adjustable (see settingsStore), not hardcoded. */
  toleranceCents: number;
  /** Tap any swara tick/label to hear its reference tone. */
  onSwaraPress?: (swaraId: SwaraId) => void;
}

export function SwaraDial({
  centsFromSa,
  nearestSwaraId,
  deviationCents,
  isListening,
  toleranceCents,
  onSwaraPress,
}: SwaraDialProps) {
  // Rotation is expressed as degrees clockwise from "up" (SVG's `rotation`
  // prop convention), which for our needle geometry works out to a clean
  // (cents / 1200) * 360 — Sa at 0 cents draws with zero rotation.
  const needleRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (centsFromSa === null) return;
    const target = (centsFromSa / 1200) * 360;
    Animated.timing(needleRotation, {
      toValue: target,
      duration: 90,
      // react-native-svg's `rotation` is a component prop, not a
      // style.transform — the native driver only fast-paths style
      // transforms/opacity, so this animation runs on the JS thread.
      useNativeDriver: false,
    }).start();
  }, [centsFromSa, needleRotation]);

  const inTune =
    isListening && deviationCents !== null && Math.abs(deviationCents) <= toleranceCents;
  const needleColor = !isListening || centsFromSa === null ? colors.tan : inTune ? colors.patina : colors.copper;

  // Tapping a note only produces sound with no visual confirmation it
  // registered — this briefly highlights the tapped tick/label so the tap
  // itself is visibly acknowledged, independent of whether the person is
  // paying attention to (or can even hear well) the audio feedback.
  const [pressedSwaraId, setPressedSwaraId] = useState<SwaraId | null>(null);
  const pressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSwaraPress = (id: SwaraId) => {
    if (pressTimeout.current) clearTimeout(pressTimeout.current);
    setPressedSwaraId(id);
    pressTimeout.current = setTimeout(() => setPressedSwaraId(null), PRESS_FEEDBACK_MS);
    onSwaraPress?.(id);
  };

  useEffect(() => {
    return () => {
      if (pressTimeout.current) clearTimeout(pressTimeout.current);
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={CENTER} cy={CENTER} r={OUTER_R} stroke={colors.hairline} strokeWidth={1} fill="none" />

        {SWARAS.map((s) => {
          const angle = angleForCents(s.cents);
          const isSa = s.id === 'S';
          const isActive = nearestSwaraId === s.id && isListening;
          const isPressed = pressedSwaraId === s.id;
          const innerR = isSa ? TICK_R_INNER_SA : TICK_R_INNER;
          const outer = polar(TICK_R_OUTER, angle);
          const inner = polar(innerR, angle);
          const label = polar(LABEL_R, angle);

          return (
            <G key={s.id}>
              <Line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={isPressed ? colors.ivory : isActive ? colors.bamboo : isSa ? colors.bambooMuted : colors.hairline}
                strokeWidth={isPressed ? 3 : isSa ? 2.5 : 1.5}
              />
              <SvgText
                x={label.x}
                y={label.y}
                fill={isPressed ? colors.ivory : isActive ? colors.bamboo : isSa ? colors.tan : colors.tan}
                fontSize={isPressed ? (isSa ? 17 : 14) : isSa ? 15 : 12}
                fontFamily={isSa ? typography.dataBold : typography.data}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {s.short}
              </SvgText>
              {onSwaraPress ? (
                <Circle
                  cx={label.x}
                  cy={label.y}
                  r={18}
                  fill={isPressed ? colors.bamboo : 'transparent'}
                  opacity={isPressed ? 0.18 : 1}
                  onPress={() => handleSwaraPress(s.id)}
                />
              ) : null}
            </G>
          );
        })}

        {/* Needle: thin tapering reed shape, drawn pointing straight up
            (toward Sa's tick at rotation 0), then rotated clockwise by
            the animated cents-based angle. */}
        <AnimatedG originX={CENTER} originY={CENTER} rotation={needleRotation as unknown as number}>
          <Path
            d={`M ${CENTER - 3} ${CENTER} L ${CENTER - 0.8} ${CENTER - NEEDLE_LEN} L ${CENTER + 0.8} ${CENTER - NEEDLE_LEN} L ${CENTER + 3} ${CENTER} Z`}
            fill={needleColor}
          />
        </AnimatedG>

        <Circle cx={CENTER} cy={CENTER} r={7} fill={colors.ink} stroke={needleColor} strokeWidth={2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
