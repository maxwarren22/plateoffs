import { Dimensions, useWindowDimensions } from 'react-native';

export const TABLET_BREAKPOINT = 768;

const { width: INITIAL_WIDTH } = Dimensions.get('window');
export const IS_TABLET = INITIAL_WIDTH >= TABLET_BREAKPOINT;

// Phone: center at 500px max. Tablet: use most of screen up to 1100px.
export const LAYOUT_WIDTH = Math.min(INITIAL_WIDTH, IS_TABLET ? 1100 : 500);

// Reactive hook — handles orientation changes.
export function useLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  return {
    screenWidth: width,
    isTablet,
    layoutWidth: Math.min(width, isTablet ? 1100 : 500),
  };
}
