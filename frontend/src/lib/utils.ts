import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LightCondition, SensorReading, DeviceEvent } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Determine light condition based on ADC reading, thresholds, and wiring polarity.
 * Standard wiring (LDR to VCC, Resistor to GND): higher light = higher voltage/ADC. Darkness = lower ADC.
 * Inverted wiring (LDR to GND, Resistor to VCC): higher light = lower voltage/ADC. Darkness = higher ADC.
 */
export function calculateLightCondition(
  adc: number,
  darkThreshold: number,
  lightThreshold: number,
  inverted: boolean = false
): LightCondition {
  if (!inverted) {
    // Normal: lower ADC = darker
    if (adc <= darkThreshold) return 'Dark';
    if (adc >= lightThreshold) return 'Bright';
    return 'Dim';
  } else {
    // Inverted: higher ADC = darker
    if (adc >= darkThreshold) return 'Dark';
    if (adc <= lightThreshold) return 'Bright';
    return 'Dim';
  }
}

/**
 * Convert ADC (0 - 4095) to estimated Brightness Percentage (0% - 100%)
 * Calibrated against standard 12-bit range
 */
export function adcToPercentage(adc: number, inverted: boolean = false): number {
  const clamped = Math.max(0, Math.min(4095, adc));
  if (inverted) {
    // Higher ADC means darker -> percentage brightness decreases
    return Math.round(((4095 - clamped) / 4095) * 100);
  }
  // Standard: higher ADC means brighter
  return Math.round((clamped / 4095) * 100);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTime(dateString: string | null): string {
  if (!dateString) return '--:--:--';
  const d = new Date(dateString);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const now = new Date().getTime();
  const past = new Date(dateString).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getRssiQuality(rssi: number | null | undefined): {
  label: string;
  percent: number;
  color: string;
} {
  if (rssi === null || rssi === undefined) {
    return { label: 'Unknown', percent: 0, color: 'text-muted-foreground' };
  }
  if (rssi >= -60) return { label: 'Excellent', percent: 100, color: 'text-emerald-500' };
  if (rssi >= -70) return { label: 'Good', percent: 75, color: 'text-emerald-400' };
  if (rssi >= -80) return { label: 'Fair', percent: 50, color: 'text-amber-500' };
  return { label: 'Weak', percent: 25, color: 'text-rose-500' };
}

/**
 * Calculates analytics from recorded sensor readings and events
 */
export function calculateAnalytics(readings: SensorReading[]) {
  if (!readings || readings.length === 0) {
    return {
      avgAdc: 0,
      minAdc: 0,
      maxAdc: 0,
      stateChangesCount: 0,
      estimatedOnHours: 0,
      estimatedOnMinutes: 0,
      sampleCount: 0,
    };
  }

  let totalAdc = 0;
  let minAdc = 4095;
  let maxAdc = 0;
  let stateChanges = 0;
  let onSamplesCount = 0;

  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    totalAdc += r.ldr_raw;
    if (r.ldr_raw < minAdc) minAdc = r.ldr_raw;
    if (r.ldr_raw > maxAdc) maxAdc = r.ldr_raw;

    if (r.reported_led_state) {
      onSamplesCount++;
    }

    if (i > 0 && readings[i].reported_led_state !== readings[i - 1].reported_led_state) {
      stateChanges++;
    }
  }

  // Assuming regular sampling interval (e.g. 5 seconds per reading)
  const approxSecondsOn = onSamplesCount * 5;
  const hours = Math.floor(approxSecondsOn / 3600);
  const minutes = Math.floor((approxSecondsOn % 3600) / 60);

  return {
    avgAdc: Math.round(totalAdc / readings.length),
    minAdc,
    maxAdc,
    stateChangesCount: stateChanges,
    estimatedOnHours: hours,
    estimatedOnMinutes: minutes,
    sampleCount: readings.length,
  };
}

/**
 * Export data to CSV file
 */
export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const val = row[header];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return `${val}`;
        })
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
