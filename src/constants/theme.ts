export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceElevated: string;
  surfaceInset: string;
  card: string;
  
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accentCyan: string;
  accentGreen: string;
  accentOrange: string;
  
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  
  border: string;
  borderLight: string;
  borderHighlight: string;
  divider: string;
  glassOverlay: string;
  glassBorder: string;
  modalOverlay: string;
  
  success: string;
  error: string;
  warning: string;
  info: string;
}

export const LIGHT_COLORS: ThemeColors = {
  background: '#EAF0F8',
  backgroundSecondary: '#F2F6FC',
  backgroundTertiary: '#E1E8F2',
  surface: '#F4F7FC',
  surfaceElevated: '#FFFFFF',
  surfaceInset: '#DFE6F1',
  card: '#F6F9FD',
  
  primary: '#FF2E55',
  primaryLight: '#FF5C7A',
  primaryDark: '#D4183E',
  secondary: '#7928CA',
  accentCyan: '#00B4D8',
  accentGreen: '#00C853',
  accentOrange: '#FF6D00',
  
  textPrimary: '#151C2C',
  textSecondary: '#54657E',
  textMuted: '#8A99AD',
  textDim: '#A8B6C7',
  
  border: 'rgba(255, 255, 255, 0.9)',
  borderLight: 'rgba(200, 212, 228, 0.6)',
  borderHighlight: '#FFFFFF',
  divider: '#DDE5F0',
  glassOverlay: 'rgba(240, 245, 252, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.8)',
  modalOverlay: 'rgba(15, 23, 42, 0.55)',
  
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export const DARK_COLORS: ThemeColors = {
  background: '#0B0F17',
  backgroundSecondary: '#111722',
  backgroundTertiary: '#17202F',
  surface: '#141C2B',
  surfaceElevated: '#1C273C',
  surfaceInset: '#0E141F',
  card: '#161F30',
  
  primary: '#FF335C',
  primaryLight: '#FF5C7E',
  primaryDark: '#D91E44',
  secondary: '#8B5CF6',
  accentCyan: '#00F2FE',
  accentGreen: '#00E676',
  accentOrange: '#FF9100',
  
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDim: '#475569',
  
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.04)',
  borderHighlight: 'rgba(255, 255, 255, 0.15)',
  divider: '#1E293B',
  glassOverlay: 'rgba(15, 23, 36, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  modalOverlay: 'rgba(0, 0, 0, 0.85)',
  
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

// Fallback legacy constant
export const COLORS = DARK_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  clay: 24,
  full: 9999,
};

export const getClayCardStyle = (isDark: boolean, colors: ThemeColors) => ({
  backgroundColor: colors.surface,
  borderRadius: RADIUS.clay,
  borderWidth: 1.5,
  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)',
  shadowColor: isDark ? '#000' : '#8CA0BA',
  shadowOffset: { width: 0, height: isDark ? 6 : 8 },
  shadowOpacity: isDark ? 0.45 : 0.28,
  shadowRadius: isDark ? 10 : 12,
  elevation: 6,
});

export const getNeumorphicButton = (isDark: boolean, colors: ThemeColors, isPrimary = false) => ({
  backgroundColor: isPrimary ? colors.primary : colors.surfaceElevated,
  borderRadius: RADIUS.full,
  borderWidth: 1.5,
  borderColor: isPrimary
    ? 'rgba(255, 255, 255, 0.35)'
    : isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : '#FFFFFF',
  shadowColor: isPrimary ? colors.primary : isDark ? '#000' : '#94A6C0',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: isPrimary ? 0.45 : isDark ? 0.35 : 0.25,
  shadowRadius: 8,
  elevation: 5,
});

export const getInsetInputStyle = (isDark: boolean, colors: ThemeColors) => ({
  backgroundColor: colors.surfaceInset,
  borderRadius: RADIUS.lg,
  borderWidth: 1.2,
  borderColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(180, 195, 215, 0.4)',
});

export const getLiquidGlassCardStyle = (isDark: boolean, colors: ThemeColors, glowColor?: string) => ({
  backgroundColor: isDark ? 'rgba(10, 18, 28, 0.45)' : 'rgba(255, 255, 255, 0.65)',
  borderRadius: RADIUS.clay,
  borderWidth: 1.2,
  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.95)',
  shadowColor: glowColor || (isDark ? '#00F2FE' : '#8CA0BA'),
  shadowOffset: { width: 0, height: isDark ? 6 : 8 },
  shadowOpacity: isDark ? 0.35 : 0.22,
  shadowRadius: isDark ? 16 : 12,
  elevation: 7,
});

export const getLiquidGlassPillStyle = (isDark: boolean, colors: ThemeColors, isHighlighted = false) => ({
  backgroundColor: isHighlighted
    ? isDark
      ? 'rgba(0, 242, 254, 0.16)'
      : 'rgba(0, 180, 216, 0.12)'
    : isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(255, 255, 255, 0.8)',
  borderRadius: RADIUS.full,
  borderWidth: 1.2,
  borderColor: isHighlighted
    ? isDark
      ? 'rgba(0, 242, 254, 0.45)'
      : 'rgba(0, 180, 216, 0.35)'
    : isDark
    ? 'rgba(255, 255, 255, 0.2)'
    : 'rgba(255, 255, 255, 0.95)',
  shadowColor: isHighlighted ? (isDark ? '#00F2FE' : '#00B4D8') : (isDark ? '#000' : '#8CA0BA'),
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: isHighlighted ? 0.4 : 0.2,
  shadowRadius: 6,
  elevation: 3,
});

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  glow: (color: string = DARK_COLORS.primary) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  }),
};
