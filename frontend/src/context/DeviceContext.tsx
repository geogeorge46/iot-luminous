import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  Device,
  DeviceSettings,
  SensorReading,
  DeviceCommand,
  DeviceEvent,
  TimeRangeFilter,
  LightCondition,
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { calculateLightCondition } from '../lib/utils';

interface DeviceContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  device: Device | null;
  settings: DeviceSettings | null;
  latestReading: SensorReading | null;
  readings: SensorReading[];
  events: DeviceEvent[];
  pendingCommand: DeviceCommand | null;
  isLoading: boolean;
  isStale: boolean;
  lastCommunicationTime: string | null;
  
  // Actions
  updateSettings: (newSettings: Partial<DeviceSettings>) => Promise<boolean>;
  sendLedCommand: (desiredState: boolean) => Promise<boolean>;
  switchOperatingMode: (mode: 'auto' | 'manual') => Promise<boolean>;
  refreshData: () => Promise<void>;
  
  // Demo simulation controls
  demoAmbientLight: number;
  setDemoAmbientLight: (adc: number) => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// Initial mock device
const initialMockDevice: Device = {
  id: '00000000-0000-0000-0000-000000000001',
  device_identifier: 'ESP32-LIGHT-001',
  name: 'ESP32 Lighting Controller',
  firmware_version: '1.0.0',
  is_online: true,
  last_seen_at: new Date().toISOString(),
  wifi_rssi: -64,
  created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  updated_at: new Date().toISOString(),
};

const initialMockSettings: DeviceSettings = {
  id: '00000000-0000-0000-0000-000000000002',
  device_id: '00000000-0000-0000-0000-000000000001',
  automatic_mode: true,
  dark_threshold: 1500,
  light_threshold: 1800,
  dark_polarity_inverted: false,
  reading_interval_seconds: 5,
  device_ack_settings: {
    automatic_mode: true,
    dark_threshold: 1500,
    light_threshold: 1800,
    dark_polarity_inverted: false,
    reading_interval_seconds: 5,
  },
  settings_synced_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Generate realistic initial simulated readings
function generateInitialDemoReadings(): { readings: SensorReading[]; events: DeviceEvent[] } {
  const readings: SensorReading[] = [];
  const events: DeviceEvent[] = [];
  const now = Date.now();
  const count = 120; // 120 samples every 5 seconds (10 minutes)
  let ledState = false;

  for (let i = count; i >= 0; i--) {
    const time = new Date(now - i * 5000).toISOString();
    // Sine wave ambient light variation + noise
    const baseWave = Math.sin((count - i) / 20) * 1200 + 2000;
    const noise = (Math.random() - 0.5) * 150;
    const adc = Math.max(200, Math.min(3900, Math.round(baseWave + noise)));
    
    // Auto threshold check
    const condition = calculateLightCondition(adc, 1500, 1800, false);
    const prevLed: boolean = ledState;
    if (adc <= 1500) {
      ledState = true;
    } else if (adc >= 1800) {
      ledState = false;
    }

    readings.push({
      id: `demo-${count - i}`,
      device_id: '00000000-0000-0000-0000-000000000001',
      ldr_raw: adc,
      light_condition: condition,
      reported_led_state: ledState,
      wifi_rssi: -60 - Math.floor(Math.random() * 8),
      recorded_at: time,
    });

    if (prevLed !== ledState) {
      events.push({
        id: `event-${count - i}`,
        device_id: '00000000-0000-0000-0000-000000000001',
        event_type: 'LED_STATE_CHANGE',
        severity: 'info',
        details: {
          previous_state: prevLed,
          new_state: ledState,
          trigger_adc: adc,
        },
        created_at: time,
      });
    }
  }

  return { readings, events };
}

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // If Supabase is not configured, default to Demo mode
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('adaptive-lighting-demo-mode');
    if (saved !== null) return saved === 'true';
    return !isSupabaseConfigured;
  });

  const [device, setDevice] = useState<Device | null>(null);
  const [settings, setSettings] = useState<DeviceSettings | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [pendingCommand, setPendingCommand] = useState<DeviceCommand | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Interactive ambient slider for demo mode
  const [demoAmbientLight, setDemoAmbientLight] = useState<number>(1400);

  // References for intervals and subscriptions
  const demoIntervalRef = useRef<number | null>(null);

  // Keep demo mode setting in localStorage
  useEffect(() => {
    localStorage.setItem('adaptive-lighting-demo-mode', String(isDemoMode));
  }, [isDemoMode]);

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
  };

  // -------------------------------------------------------------
  // DEMO MODE ENGINE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isDemoMode) return;

    setIsLoading(true);
    const { readings: initialReadings, events: initialEvents } = generateInitialDemoReadings();
    setDevice(initialMockDevice);
    setSettings(initialMockSettings);
    setReadings(initialReadings);
    setEvents(initialEvents);
    setIsLoading(false);

    // Run simulation loop every 4 seconds
    demoIntervalRef.current = window.setInterval(() => {
      setSettings((currentSettings) => {
        if (!currentSettings) return currentSettings;

        setReadings((prevReadings) => {
          const lastReading = prevReadings[prevReadings.length - 1];
          // Fluctuate around user's demoAmbientLight
          const noise = (Math.random() - 0.5) * 80;
          const currentAdc = Math.max(100, Math.min(4000, Math.round(demoAmbientLight + noise)));
          
          let nextLedState = lastReading ? lastReading.reported_led_state : false;
          
          if (currentSettings.automatic_mode) {
            // Apply automatic logic with hysteresis
            if (!currentSettings.dark_polarity_inverted) {
              if (currentAdc <= currentSettings.dark_threshold) nextLedState = true;
              else if (currentAdc >= currentSettings.light_threshold) nextLedState = false;
            } else {
              if (currentAdc >= currentSettings.dark_threshold) nextLedState = true;
              else if (currentAdc <= currentSettings.light_threshold) nextLedState = false;
            }
          }

          const condition = calculateLightCondition(
            currentAdc,
            currentSettings.dark_threshold,
            currentSettings.light_threshold,
            currentSettings.dark_polarity_inverted
          );

          const newTimestamp = new Date().toISOString();
          const newReading: SensorReading = {
            id: `demo-${Date.now()}`,
            device_id: initialMockDevice.id,
            ldr_raw: currentAdc,
            light_condition: condition,
            reported_led_state: nextLedState,
            wifi_rssi: -62 - Math.floor(Math.random() * 5),
            recorded_at: newTimestamp,
          };

          // If LED state flipped, log event
          if (lastReading && lastReading.reported_led_state !== nextLedState) {
            setEvents((prev) => [
              {
                id: `event-${Date.now()}`,
                device_id: initialMockDevice.id,
                event_type: 'LED_STATE_CHANGE',
                severity: 'info',
                details: {
                  previous_state: lastReading.reported_led_state,
                  new_state: nextLedState,
                  trigger_adc: currentAdc,
                  reason: currentSettings.automatic_mode ? 'Auto Threshold' : 'Manual Override',
                },
                created_at: newTimestamp,
              },
              ...prev.slice(0, 49),
            ]);
          }

          return [...prevReadings.slice(-199), newReading];
        });

        // Update device last_seen_at
        setDevice((prev) => (prev ? { ...prev, is_online: true, last_seen_at: new Date().toISOString() } : prev));
        return currentSettings;
      });
    }, 4000);

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [isDemoMode, demoAmbientLight]);

  // -------------------------------------------------------------
  // SUPABASE REALTIME & REST ENGINE
  // -------------------------------------------------------------
  const fetchSupabaseData = useCallback(async () => {
    if (isDemoMode || !isSupabaseConfigured) return;

    try {
      setIsLoading(true);

      // 1. Fetch Primary Device
      const { data: devData } = await supabase
        .from('devices')
        .select('*')
        .eq('device_identifier', 'ESP32-LIGHT-001')
        .single();

      if (!devData) {
        setIsLoading(false);
        setDevice(null);
        return;
      }

      setDevice(devData);

      // 2. Fetch Device Settings
      const { data: settsData } = await supabase
        .from('device_settings')
        .select('*')
        .eq('device_id', devData.id)
        .single();

      if (settsData) setSettings(settsData);

      // 3. Fetch Recent Sensor Readings
      const { data: readData } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', devData.id)
        .order('recorded_at', { ascending: false })
        .limit(200);

      if (readData) {
        setReadings(readData.reverse());
      }

      // 4. Fetch Events
      const { data: evData } = await supabase
        .from('device_events')
        .select('*')
        .eq('device_id', devData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (evData) setEvents(evData);

      // 5. Fetch Pending Command
      const { data: cmdData } = await supabase
        .from('device_commands')
        .select('*')
        .eq('device_id', devData.id)
        .eq('status', 'PENDING')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (cmdData && cmdData.length > 0) {
        setPendingCommand(cmdData[0]);
      }
    } catch (err) {
      console.error('Failed to load Supabase data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode || !isSupabaseConfigured) return;

    fetchSupabaseData();

    // Setup Realtime Subscriptions
    const channel = supabase
      .channel('adaptive_lighting_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          const newReading = payload.new as SensorReading;
          setReadings((prev) => [...prev.slice(-199), newReading]);
          setDevice((prev) =>
            prev ? { ...prev, is_online: true, last_seen_at: newReading.recorded_at } : prev
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'device_settings' },
        (payload) => {
          setSettings(payload.new as DeviceSettings);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_commands' },
        (payload) => {
          const cmd = payload.new as DeviceCommand;
          if (cmd.status === 'PENDING') {
            setPendingCommand(cmd);
          } else {
            setPendingCommand((prev) => (prev?.id === cmd.id ? null : prev));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'device_events' },
        (payload) => {
          setEvents((prev) => [payload.new as DeviceEvent, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDemoMode, fetchSupabaseData]);

  // Determine freshness: offline if last communication was > 30 seconds ago
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const lastCommunicationTime = device?.last_seen_at || latestReading?.recorded_at || null;
  
  const isStale = Boolean(
    !isDemoMode &&
    (!lastCommunicationTime ||
      Date.now() - new Date(lastCommunicationTime).getTime() > 30000)
  );

  // -------------------------------------------------------------
  // ACTION DISPATCHERS
  // -------------------------------------------------------------
  const updateSettings = async (newSettings: Partial<DeviceSettings>): Promise<boolean> => {
    if (isDemoMode) {
      setSettings((prev) => {
        if (!prev) return prev;
        const merged: DeviceSettings = {
          ...prev,
          ...newSettings,
          updated_at: new Date().toISOString(),
          // In demo mode, simulate immediate ESP32 confirmation
          device_ack_settings: {
            automatic_mode: newSettings.automatic_mode ?? prev.automatic_mode,
            dark_threshold: newSettings.dark_threshold ?? prev.dark_threshold,
            light_threshold: newSettings.light_threshold ?? prev.light_threshold,
            dark_polarity_inverted: newSettings.dark_polarity_inverted ?? prev.dark_polarity_inverted,
            reading_interval_seconds: newSettings.reading_interval_seconds ?? prev.reading_interval_seconds,
          },
          settings_synced_at: new Date().toISOString(),
        };
        return merged;
      });

      setEvents((prev) => [
        {
          id: `ev-${Date.now()}`,
          device_id: initialMockDevice.id,
          event_type: 'SETTINGS_UPDATED',
          severity: 'info',
          details: newSettings,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      return true;
    }

    if (!device) return false;

    try {
      const { error } = await supabase
        .from('device_settings')
        .update({
          ...newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', device.id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to update settings:', err);
      return false;
    }
  };

  const sendLedCommand = async (desiredState: boolean): Promise<boolean> => {
    if (isDemoMode) {
      // Simulate command creation & execution
      const commandId = `cmd-${Date.now()}`;
      const cmd: DeviceCommand = {
        id: commandId,
        device_id: initialMockDevice.id,
        command_type: 'SET_LED',
        command_payload: { state: desiredState },
        status: 'PENDING',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30000).toISOString(),
      };
      setPendingCommand(cmd);

      // Simulate 800ms network round-trip acknowledgment from ESP32
      setTimeout(() => {
        setPendingCommand(null);
        setReadings((prev) => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { ...last, reported_led_state: desiredState, recorded_at: new Date().toISOString() },
          ];
        });
        setEvents((prev) => [
          {
            id: `ev-${Date.now()}`,
            device_id: initialMockDevice.id,
            event_type: 'COMMAND_EXECUTED',
            severity: 'info',
            details: {
              command: 'SET_LED',
              state: desiredState,
              status: 'ACKNOWLEDGED',
            },
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }, 800);

      return true;
    }

    if (!device) return false;

    // In live mode, verify device is not offline
    if (isStale) {
      alert('Cannot send command: Device is currently offline. Commands will expire.');
      return false;
    }

    try {
      const expiresAt = new Date(Date.now() + 30000).toISOString(); // 30s expiration
      const { data, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: device.id,
          command_type: 'SET_LED',
          command_payload: { state: desiredState },
          status: 'PENDING',
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setPendingCommand(data);
      return true;
    } catch (err) {
      console.error('Failed to dispatch LED command:', err);
      return false;
    }
  };

  const switchOperatingMode = async (mode: 'auto' | 'manual'): Promise<boolean> => {
    return await updateSettings({ automatic_mode: mode === 'auto' });
  };

  return (
    <DeviceContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        device,
        settings,
        latestReading,
        readings,
        events,
        pendingCommand,
        isLoading,
        isStale,
        lastCommunicationTime,
        updateSettings,
        sendLedCommand,
        switchOperatingMode,
        refreshData: fetchSupabaseData,
        demoAmbientLight,
        setDemoAmbientLight,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};
