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

export interface AccentTheme {
  id: string;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  glowColor: string;
  lightPrimary?: string;
  lightPrimaryLight?: string;
  lightPrimaryDark?: string;
  lightGlowColor?: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: 'liquid',
    name: 'Liquid Glass',
    primary: '#FFFFFF',
    primaryLight: '#FFFFFF',
    primaryDark: '#D4D4D8',
    glowColor: 'rgba(255, 255, 255, 0.6)',
    lightPrimary: '#0F172A',
    lightPrimaryLight: '#334155',
    lightPrimaryDark: '#020617',
    lightGlowColor: 'rgba(15, 23, 42, 0.35)',
  },
  {
    id: 'cyan',
    name: 'Cyber Cyan',
    primary: '#00F2FE',
    primaryLight: '#38BDF8',
    primaryDark: '#0284C7',
    glowColor: '#00F2FE',
    lightPrimary: '#0284C7',
    lightPrimaryLight: '#0EA5E9',
    lightPrimaryDark: '#0369A1',
    lightGlowColor: 'rgba(2, 132, 199, 0.35)',
  },
  {
    id: 'rose',
    name: 'Midnight Rose',
    primary: '#FF335C',
    primaryLight: '#FF6685',
    primaryDark: '#D4183E',
    glowColor: '#FF335C',
    lightPrimary: '#E11D48',
    lightPrimaryLight: '#F43F5E',
    lightPrimaryDark: '#BE123C',
    lightGlowColor: 'rgba(225, 29, 72, 0.35)',
  },
  {
    id: 'violet',
    name: 'Electric Violet',
    primary: '#A855F7',
    primaryLight: '#C084FC',
    primaryDark: '#7E22CE',
    glowColor: '#A855F7',
    lightPrimary: '#7C3AED',
    lightPrimaryLight: '#8B5CF6',
    lightPrimaryDark: '#6D28D9',
    lightGlowColor: 'rgba(124, 58, 237, 0.35)',
  },
  {
    id: 'emerald',
    name: 'Emerald Neon',
    primary: '#10B981',
    primaryLight: '#34D399',
    primaryDark: '#059669',
    glowColor: '#10B981',
    lightPrimary: '#059669',
    lightPrimaryLight: '#10B981',
    lightPrimaryDark: '#047857',
    lightGlowColor: 'rgba(5, 150, 105, 0.35)',
  },
  {
    id: 'gold',
    name: 'Solar Gold',
    primary: '#F59E0B',
    primaryLight: '#FBBF24',
    primaryDark: '#D97706',
    glowColor: '#F59E0B',
    lightPrimary: '#D97706',
    lightPrimaryLight: '#F59E0B',
    lightPrimaryDark: '#B45309',
    lightGlowColor: 'rgba(217, 119, 6, 0.35)',
  },
];

export const LIGHT_COLORS: ThemeColors = {
  background: '#EEF3F9',
  backgroundSecondary: '#F5F8FC',
  backgroundTertiary: '#E2EAF4',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceInset: '#E2E8F0',
  card: 'rgba(255, 255, 255, 0.88)',
  
  primary: '#0F172A',
  primaryLight: '#334155',
  primaryDark: '#020617',
  secondary: '#334155',
  accentCyan: '#0284C7',
  accentGreen: '#059669',
  accentOrange: '#D97706',
  
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  
  border: 'rgba(15, 23, 42, 0.08)',
  borderLight: 'rgba(15, 23, 42, 0.05)',
  borderHighlight: 'rgba(255, 255, 255, 0.95)',
  divider: 'rgba(15, 23, 42, 0.07)',
  glassOverlay: 'rgba(255, 255, 255, 0.82)',
  glassBorder: 'rgba(15, 23, 42, 0.08)',
  modalOverlay: 'rgba(15, 23, 42, 0.60)',
  
  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
};

export const DARK_COLORS: ThemeColors = {
  background: '#06080F',
  backgroundSecondary: '#0C101C',
  backgroundTertiary: '#121828',
  surface: '#101624',
  surfaceElevated: '#161E30',
  surfaceInset: '#080C14',
  card: 'rgba(255, 255, 255, 0.06)',
  
  primary: '#FFFFFF',
  primaryLight: '#FFFFFF',
  primaryDark: '#D4D4D8',
  secondary: '#E2E8F0',
  accentCyan: '#FFFFFF',
  accentGreen: '#00E676',
  accentOrange: '#FF9100',
  
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDim: '#475569',
  
  border: 'rgba(255, 255, 255, 0.20)',
  borderLight: 'rgba(255, 255, 255, 0.10)',
  borderHighlight: 'rgba(255, 255, 255, 0.45)',
  divider: 'rgba(255, 255, 255, 0.10)',
  glassOverlay: 'rgba(255, 255, 255, 0.10)',
  glassBorder: 'rgba(255, 255, 255, 0.28)',
  modalOverlay: 'rgba(0, 0, 0, 0.70)',
  
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
  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.surface,
  borderRadius: RADIUS.clay,
  borderWidth: 1.2,
  borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.85)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: isDark ? 0.35 : 0.18,
  shadowRadius: 14,
  elevation: 6,
});

export const getNeumorphicButton = (isDark: boolean, colors: ThemeColors, isPrimary = false) => ({
  backgroundColor: isPrimary ? (isDark ? '#FFFFFF' : '#0F172A') : isDark ? 'rgba(255, 255, 255, 0.1)' : colors.surfaceElevated,
  borderRadius: RADIUS.full,
  borderWidth: 1.2,
  borderColor: isPrimary
    ? 'rgba(255, 255, 255, 0.5)'
    : isDark
    ? 'rgba(255, 255, 255, 0.2)'
    : '#FFFFFF',
  shadowColor: isPrimary ? '#000' : '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: isPrimary ? 0.35 : isDark ? 0.25 : 0.18,
  shadowRadius: 8,
  elevation: 4,
});

export const getInsetInputStyle = (isDark: boolean, colors: ThemeColors) => ({
  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : colors.surfaceInset,
  borderRadius: RADIUS.lg,
  borderWidth: 1.2,
  borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(180, 195, 215, 0.4)',
});

export const getLiquidGlassCardStyle = (isDark: boolean, colors: ThemeColors, glowColor?: string) => ({
  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.75)',
  borderRadius: RADIUS.clay,
  borderWidth: 1.2,
  borderColor: isDark ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.95)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: isDark ? 0.35 : 0.18,
  shadowRadius: 16,
  elevation: 6,
});

export const getLiquidGlassPillStyle = (isDark: boolean, colors: ThemeColors, isHighlighted = false) => ({
  backgroundColor: isHighlighted
    ? isDark
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(255, 255, 255, 0.9)'
    : isDark
    ? 'rgba(255, 255, 255, 0.09)'
    : 'rgba(255, 255, 255, 0.75)',
  borderRadius: RADIUS.full,
  borderWidth: 1.2,
  borderColor: isHighlighted
    ? isDark
      ? 'rgba(255, 255, 255, 0.40)'
      : 'rgba(0, 0, 0, 0.12)'
    : isDark
    ? 'rgba(255, 255, 255, 0.22)'
    : 'rgba(255, 255, 255, 0.95)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: isHighlighted ? 0.3 : 0.15,
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
