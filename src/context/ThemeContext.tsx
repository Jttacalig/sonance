import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeColors,
  LIGHT_COLORS,
  DARK_COLORS,
  getClayCardStyle,
  getNeumorphicButton,
  getInsetInputStyle,
} from '../constants/theme';

export type ThemeMode = 'auto' | 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  clayCard: any;
  neumorphicButton: (isPrimary?: boolean) => any;
  insetInput: any;
}

const THEME_STORAGE_KEY = '@apple_player_theme_mode';

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceColorScheme = useDeviceColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'auto') {
        setModeState(saved as ThemeMode);
      }
    });
  }, []);

  const isDark = mode === 'auto' ? deviceColorScheme !== 'light' : mode === 'dark';
  const colors: ThemeColors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
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
        setMode,
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
