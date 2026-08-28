import React from 'react';
import {
  type ScrollViewProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {
  smoothHorizontalScrollProps,
  smoothVerticalScrollProps,
} from '@/theme/scroll';

export type SmoothScrollViewProps = ScrollViewProps & {
  /** Default true — adds bottom padding for tab bar / safe area */
  contentPaddingBottom?: number;
};

export const SmoothScrollView = React.forwardRef<ScrollView, SmoothScrollViewProps>(
  (
    {
      children,
      contentContainerStyle,
      horizontal,
      contentPaddingBottom = 24,
      style,
      ...props
    },
    ref,
  ) => {
    const scrollProps = horizontal
      ? smoothHorizontalScrollProps
      : smoothVerticalScrollProps;

    const containerStyle: StyleProp<ViewStyle> = [
      contentContainerStyle,
      !horizontal && contentPaddingBottom > 0
        ? { paddingBottom: contentPaddingBottom }
        : undefined,
    ];

    return (
      <ScrollView
        ref={ref}
        horizontal={horizontal}
        style={[horizontal ? styles.scrollHorizontal : styles.scroll, style]}
        contentContainerStyle={containerStyle}
        {...scrollProps}
        {...props}>
        {children}
      </ScrollView>
    );
  },
);

SmoothScrollView.displayName = 'SmoothScrollView';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // flex: 1 only makes sense for the vertical (full-screen) case above — a
  // horizontal chip strip is normally nested inside a card/section that
  // sizes to its content, not a flex container, so flex: 1 there collapses
  // the scroller to zero height (nothing to "grow" into). Let it size to
  // its content instead.
  scrollHorizontal: {
    flexGrow: 0,
  },
});
