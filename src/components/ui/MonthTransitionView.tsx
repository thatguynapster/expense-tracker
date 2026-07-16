import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/theme';

interface Props {
  /** Identity of the current month (e.g. "2026-07") — a change triggers the transition. */
  monthKey: string;
  /** +1 when moving to a later month, -1 when moving earlier — sets slide direction. */
  direction: 1 | -1;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * §5: month prev/next — horizontal 12px slide + fade of the list, 200ms.
 * Reduce-motion skips the animation and renders in place.
 */
export function MonthTransitionView({ monthKey, direction, style, children }: Props) {
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const prevKey = useRef(monthKey);

  useEffect(() => {
    if (prevKey.current === monthKey || reduceMotion) {
      prevKey.current = monthKey;
      return;
    }
    prevKey.current = monthKey;
    translateX.value = direction * 12;
    opacity.value = 0;
    translateX.value = withTiming(0, { duration: motion.base, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: motion.base });
  }, [monthKey, direction, reduceMotion, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>;
}
