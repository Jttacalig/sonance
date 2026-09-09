import React, { createContext, useContext, useState, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { EqualizerPreset, PlayerBackgroundTheme, PlayerBackgroundType } from '../types/music';
import { BUILT_IN_EQ_PRESETS } from '../constants/equalizer';
import { storageService, WALLPAPER_DIR } from '../services/storageService';

interface CustomizationContextType {
  activePresetId: string;
  activePreset: EqualizerPreset;
  bands: [number, number, number, number, number];
  presets: EqualizerPreset[];
  playerTheme: PlayerBackgroundTheme;
  isEqEnabled: boolean;
  setIsEqEnabled: (enabled: boolean) => void;
  selectPreset: (presetId: string) => Promise<void>;
  updateBandGain: (index: number, gain: number) => void;
  resetEqToFlat: () => Promise<void>;
  updatePlayerTheme: (partialTheme: Partial<PlayerBackgroundTheme>) => Promise<void>;
  pickCustomWallpaper: (autoSave?: boolean) => Promise<string | null>;
  setThemeType: (type: PlayerBackgroundType, presetId?: string) => Promise<void>;
}

const CustomizationContext = createContext<CustomizationContextType | null>(null);

const DEFAULT_THEME: PlayerBackgroundTheme = {
  type: 'artwork_aura',
  presetId: 'neon_liquid',
  blurIntensity: 65,
  dimness: 0.25,
};

export const CustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePresetId, setActivePresetId] = useState<string>('flat');
  const [bands, setBands] = useState<[number, number, number, number, number]>([0, 0, 0, 0, 0]);
  const [presets, setPresets] = useState<EqualizerPreset[]>(BUILT_IN_EQ_PRESETS);
  const [playerTheme, setPlayerThemeState] = useState<PlayerBackgroundTheme>(DEFAULT_THEME);
  const [isEqEnabled, setIsEqEnabled] = useState<boolean>(true);

  // Load saved customization settings
  useEffect(() => {
    async function loadCustomizations() {
      try {
        const settings = await storageService.getSettings();
        if (settings.playerBackgroundTheme) {
          setPlayerThemeState({
            ...DEFAULT_THEME,
            ...settings.playerBackgroundTheme,
          });
        }
        if (settings.activeEqPresetId) {
          setActivePresetId(settings.activeEqPresetId);
          const found = BUILT_IN_EQ_PRESETS.find(p => p.id === settings.activeEqPresetId);
          if (found) {
            setBands([...found.bands]);
          } else if (settings.customEqBands) {
            setBands(settings.customEqBands);
          }
        }
      } catch (error) {
        console.warn('Error loading customizations:', error);
      }
    }
    loadCustomizations();
  }, []);

  const activePreset =
    presets.find(p => p.id === activePresetId) || {
      id: 'custom',
      name: 'Custom',
      bands: bands,
      isCustom: true,
    };

  const selectPreset = async (presetId: string) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setActivePresetId(preset.id);
      setBands([...preset.bands]);
      await storageService.updateSettings({
        activeEqPresetId: preset.id,
        customEqBands: [...preset.bands],
      });
    }
  };

  const updateBandGain = (index: number, gain: number) => {
    const clampedGain = Math.round(Math.max(-12, Math.min(12, gain)));
    setBands(prev => {
      const next: [number, number, number, number, number] = [...prev];
      next[index] = clampedGain;
      return next;
    });
    setActivePresetId('custom');
    storageService.updateSettings({
      activeEqPresetId: 'custom',
      customEqBands: bands,
    }).catch(() => {});
  };

  const resetEqToFlat = async () => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setActivePresetId('flat');
    setBands([0, 0, 0, 0, 0]);
    await storageService.updateSettings({
      activeEqPresetId: 'flat',
      customEqBands: [0, 0, 0, 0, 0],
    });
  };

  const updatePlayerTheme = async (partialTheme: Partial<PlayerBackgroundTheme>) => {
    const updated = {
      ...playerTheme,
      ...partialTheme,
    };
    setPlayerThemeState(updated);
    await storageService.updateSettings({
      playerBackgroundTheme: updated,
    });
  };

  const setThemeType = async (type: PlayerBackgroundType, presetId?: string) => {
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await updatePlayerTheme({
      type,
      ...(presetId ? { presetId } : {}),
    });
  };

  const pickCustomWallpaper = async (autoSave: boolean = false): Promise<string | null> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = `wallpaper_${Date.now()}_${asset.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const destination = `${WALLPAPER_DIR}${filename}`;

        await FileSystem.copyAsync({
          from: asset.uri,
          to: destination,
        });

        if (autoSave) {
          await updatePlayerTheme({
            type: 'custom',
            customImageUri: destination,
          });
        }

        if (Haptics.impactAsync) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }

        return destination;
      }
      return null;
    } catch (error) {
      console.error('Error picking custom wallpaper:', error);
      throw error;
    }
  };

  return (
    <CustomizationContext.Provider
      value={{
        activePresetId,
        activePreset,
        bands,
        presets,
        playerTheme,
        isEqEnabled,
        setIsEqEnabled,
        selectPreset,
        updateBandGain,
        resetEqToFlat,
        updatePlayerTheme,
        pickCustomWallpaper,
        setThemeType,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization must be used within a CustomizationProvider');
  }
  return context;
};
