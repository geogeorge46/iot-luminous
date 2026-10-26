// TypeScript Type Definitions for Adaptive Lighting System

export type LightCondition = 'Bright' | 'Dim' | 'Dark';

export type DeviceMode = 'auto' | 'manual';

export type CommandType = 'SET_LED' | 'SET_MODE' | 'SET_SETTINGS' | 'REBOOT';

export type CommandStatus = 'PENDING' | 'ACKNOWLEDGED' | 'FAILED' | 'EXPIRED';

export interface Device {
  id: string;
  device_identifier: string;
  name: string;
  firmware_version: string;
  is_online: boolean;
  last_seen_at: string | null;
  wifi_rssi: number | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceSettings {
  id: string;
  device_id: string;
  automatic_mode: boolean;
  dark_threshold: number; // 0 - 4095
  light_threshold: number; // 0 - 4095
  dark_polarity_inverted: boolean; // false: lower ADC = darker, true: higher ADC = darker
  reading_interval_seconds: number;
  device_ack_settings?: {
    automatic_mode: boolean;
    dark_threshold: number;
    light_threshold: number;
    dark_polarity_inverted: boolean;
    reading_interval_seconds: number;
  } | null;
  settings_synced_at: string | null;
  updated_at: string;
}

export interface SensorReading {
  id: number | string;
  device_id: string;
  ldr_raw: number; // 0 - 4095
  light_condition: LightCondition;
  reported_led_state: boolean;
  wifi_rssi?: number | null;
  pir_motion_detected?: boolean | null; // Phase 2 stub
  recorded_at: string;
}

export interface DeviceCommand {
  id: string;
  device_id: string;
  command_type: CommandType;
  command_payload: Record<string, any>;
  status: CommandStatus;
  created_at: string;
  expires_at: string;
  acknowledged_at?: string | null;
  error_message?: string | null;
}

export interface DeviceEvent {
  id: number | string;
  device_id: string;
  event_type: 'LED_STATE_CHANGE' | 'MODE_CHANGE' | 'SETTINGS_UPDATED' | 'DEVICE_ONLINE' | 'DEVICE_OFFLINE' | 'COMMAND_EXECUTED' | string;
  severity: 'info' | 'warning' | 'error';
  details: Record<string, any>;
  created_at: string;
}

export type TimeRangeFilter = '15m' | '1h' | '24h' | '7d';

export interface CalibrationStepData {
  brightSamples: number[];
  darkSamples: number[];
  brightAvg: number;
  darkAvg: number;
  invertedPolarity: boolean;
  recommendedDarkThreshold: number;
  recommendedLightThreshold: number;
}
