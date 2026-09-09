import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeColors,
  LIGHT_COLORS,
  DARK_COLORS,
  ACCENT_THEMES,
  AccentTheme,
  getClayCardStyle,
  getNeumorphicButton,
  getInsetInputStyle,
} from '../constants/theme';

export type ThemeMode = 'auto' | 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  accentId: string;
  activeAccent: AccentTheme;
  setMode: (mode: ThemeMode) => Promise<void>;
  setAccent: (accentId: string) => Promise<void>;
  clayCard: any;
  neumorphicButton: (isPrimary?: boolean) => any;
  insetInput: any;
}

const THEME_STORAGE_KEY = '@apple_player_theme_mode';
const ACCENT_STORAGE_KEY = '@sonance_accent_theme_id';

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceColorScheme = useDeviceColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const [accentId, setAccentId] = useState<string>('cyan');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'auto') {
        setModeState(saved as ThemeMode);
      }
    });
    AsyncStorage.getItem(ACCENT_STORAGE_KEY).then((saved) => {
      if (saved && ACCENT_THEMES.some((a) => a.id === saved)) {
        setAccentId(saved);
      }
    });
  }, []);

  const isDark = mode === 'auto' ? deviceColorScheme !== 'light' : mode === 'dark';

  const activeAccent = useMemo(() => {
    return ACCENT_THEMES.find((a) => a.id === accentId) || ACCENT_THEMES[0];
  }, [accentId]);

  const colors: ThemeColors = useMemo(() => {
    const base = isDark ? { ...DARK_COLORS } : { ...LIGHT_COLORS };
    return {
      ...base,
      primary: activeAccent.primary,
      primaryLight: activeAccent.primaryLight,
      primaryDark: activeAccent.primaryDark,
      accentCyan: activeAccent.glowColor,
    };
  }, [isDark, activeAccent]);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const setAccent = async (newAccentId: string) => {
    setAccentId(newAccentId);
    await AsyncStorage.setItem(ACCENT_STORAGE_KEY, newAccentId);
  };

  const clayCard = getClayCardStyle(isDark, colors);
  const neumorphicButton = (isPrimary = false) => getNeumorphicButton(isDark, colors, isPrimary);
  const insetInput = getInsetInputStyle(isDark, colors);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        colors,
        accentId,
        activeAccent,
        setMode,
        setAccent,
        clayCard,
        neumorphicButton,
        insetInput,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
