import { Dimensions } from 'react-native';

// Max content width — phone screens are unaffected; iPad content centers at this width.
export const LAYOUT_WIDTH = Math.min(Dimensions.get('window').width, 500);
