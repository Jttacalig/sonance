import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export type AudioDeviceType = 'airpods' | 'headphones' | 'bluetooth' | 'speaker' | 'wired';

export interface AudioDeviceInfo {
  id: string;
  name: string;
  type: AudioDeviceType;
  quality: string;
  isSpatialAudioAvailable?: boolean;
  batteryLevel?: number;
}

interface AudioRouteContextType {
  currentDevice: AudioDeviceInfo;
  activeHudDevice: AudioDeviceInfo | null;
  isHudVisible: boolean;
  triggerHud: (device: Partial<AudioDeviceInfo> & { name: string; type: AudioDeviceType }) => void;
  hideHud: () => void;
  switchDevice: (device: AudioDeviceInfo) => void;
}

const DEFAULT_SPEAKER: AudioDeviceInfo = {
  id: 'speaker',
  name: 'iPhone Speaker',
  type: 'speaker',
  quality: 'Stereo • 48 kHz',
  isSpatialAudioAvailable: false,
};

const AudioRouteContext = createContext<AudioRouteContextType | null>(null);

export const AudioRouteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDevice, setCurrentDevice] = useState<AudioDeviceInfo>(DEFAULT_SPEAKER);
  const [activeHudDevice, setActiveHudDevice] = useState<AudioDeviceInfo | null>(null);
  const [isHudVisible, setIsHudVisible] = useState<boolean>(false);

  const triggerHud = useCallback((device: Partial<AudioDeviceInfo> & { name: string; type: AudioDeviceType }) => {
    const fullDevice: AudioDeviceInfo = {
      id: device.id || `dev_${Date.now()}`,
      name: device.name,
      type: device.type,
      quality: device.quality || (device.type === 'speaker' ? 'Stereo • 48 kHz' : 'Lossless • 24-bit / 48 kHz'),
      isSpatialAudioAvailable: device.isSpatialAudioAvailable ?? (device.type === 'airpods' || device.type === 'headphones'),
      batteryLevel: device.batteryLevel,
    };

    setCurrentDevice(fullDevice);
    setActiveHudDevice(fullDevice);
    setIsHudVisible(true);

    if (Haptics.notificationAsync) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  const hideHud = useCallback(() => {
    setIsHudVisible(false);
  }, []);

  const switchDevice = useCallback((device: AudioDeviceInfo) => {
    setCurrentDevice(device);
    triggerHud(device);
  }, [triggerHud]);

  return (
    <AudioRouteContext.Provider
      value={{
        currentDevice,
        activeHudDevice,
        isHudVisible,
        triggerHud,
        hideHud,
        switchDevice,
      }}
    >
      {children}
    </AudioRouteContext.Provider>
  );
};

export const useAudioRoute = () => {
  const context = useContext(AudioRouteContext);
  if (!context) {
    throw new Error('useAudioRoute must be used within an AudioRouteProvider');
  }
  return context;
};
