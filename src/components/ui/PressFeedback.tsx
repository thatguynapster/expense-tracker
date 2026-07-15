import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, palette } from '@/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** What the background returns to when released. Rows sit on `surface`, so transparent reads as "no highlight". */
  baseColor?: string;
  /** Pressed background; colored surfaces (e.g. the FAB) pass their own color to get scale-only feedback. */
  pressedColor?: string;
  children?: React.ReactNode;
}

/**
 * Restyle spec §3.1 / §5 press state, shared by every tappable surface:
 * background → surfaceRaised and scale → pressScale over motion.fast.
 * With reduce-motion on, the background still switches (a visible press state
 * is an accessibility requirement, §8) but instantly and without the scale.
 */
export function PressFeedback({
  style,
  baseColor = 'transparent',
  pressedColor = palette.surfaceRaised,
  children,
  ...props
}: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pressed.value, [0, 1], [baseColor, pressedColor]),
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, reduceMotion ? 1 : motion.pressScale]) },
    ],
  }));

  const duration = reduceMotion ? 0 : motion.fast;

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: .value assignment is the documented API, not a React state mutation.
        pressed.value = withTiming(1, { duration });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: .value assignment is the documented API, not a React state mutation.
        pressed.value = withTiming(0, { duration });
        props.onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
