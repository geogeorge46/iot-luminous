import React from 'react';
import { useDevice } from '../context/DeviceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import {
  formatDate,
  formatRelativeTime,
  adcToPercentage,
  getRssiQuality,
  calculateLightCondition,
} from '../lib/utils';
import {
  Lightbulb,
  Sun,
  Moon,
  Wifi,
  Cpu,
  Clock,
  Sliders,
  CheckCircle2,
  Clock3,
  AlertCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const {
    device,
    settings,
    latestReading,
    pendingCommand,
    isLoading,
    isStale,
    isDemoMode,
    sendLedCommand,
    switchOperatingMode,
  } = useDevice();

  if (isLoading && !latestReading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <LoadingSkeleton className="h-6 w-1/2 mb-4" />
            <LoadingSkeleton className="h-10 w-3/4 mb-2" />
            <LoadingSkeleton className="h-4 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  // If Supabase is connected but hardware hasn't published any readings yet
  if (!isDemoMode && !latestReading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">System Overview</h2>
          <p className="text-sm text-muted-foreground">Real-time status of your ESP32 Adaptive Lighting node.</p>
        </div>
        <EmptyState
          title="Awaiting Device Telemetry"
          description="Your Supabase database is connected, but the ESP32 hardware has not uploaded its initial sensor reading yet. Flash the firmware and verify your Wi-Fi credentials."
          actionText="Try Demo Mode Instead"
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

  const rawAdc = latestReading ? latestReading.ldr_raw : 0;
  const darkThresh = settings?.dark_threshold ?? 1500;
  const lightThresh = settings?.light_threshold ?? 1800;
  const inverted = settings?.dark_polarity_inverted ?? false;
  const condition = latestReading
    ? latestReading.light_condition
    : calculateLightCondition(rawAdc, darkThresh, lightThresh, inverted);
  const brightnessPercent = adcToPercentage(rawAdc, inverted);

  const isLedOn = latestReading ? latestReading.reported_led_state : false;
  const rssiInfo = getRssiQuality(latestReading?.wifi_rssi ?? device?.wifi_rssi);

  // Determine LED reason
  const isAuto = settings?.automatic_mode ?? true;
  let stateReason = 'Default state';
  if (isAuto) {
    if (isLedOn) {
      stateReason = inverted
        ? `Auto: ADC ${rawAdc} >= Dark Threshold ${darkThresh}`
        : `Auto: ADC ${rawAdc} <= Dark Threshold ${darkThresh}`;
    } else {
      stateReason = inverted
        ? `Auto: ADC ${rawAdc} <= Light Threshold ${lightThresh}`
        : `Auto: ADC ${rawAdc} >= Light Threshold ${lightThresh}`;
    }
  } else {
    stateReason = 'Manual control override active';
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">System Overview</h2>
          <p className="text-sm text-muted-foreground">
            Real-time status of the ESP32 adaptive lighting controller and photodiode telemetry.
          </p>
        </div>

        {/* Quick Mode Toggle */}
        <div className="flex items-center space-x-2 bg-muted/60 p-1 rounded-lg border border-border self-start sm:self-auto">
          <button
            onClick={() => switchOperatingMode('auto')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              isAuto
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Automatic Mode
          </button>
          <button
            onClick={() => switchOperatingMode('manual')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              !isAuto
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Manual Mode
          </button>
        </div>
      </div>

      {/* Main 4 Metric Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: Current Light Level */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase font-medium text-muted-foreground">
              Current Light Level
            </CardTitle>
            <div
              className={`rounded-full p-1.5 ${
                condition === 'Bright'
                  ? 'bg-amber-500/10 text-amber-500'
                  : condition === 'Dim'
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'bg-indigo-500/10 text-indigo-400'
              }`}
            >
              {condition === 'Bright' ? (
                <Sun className="h-4 w-4" />
              ) : condition === 'Dim' ? (
                <Sun className="h-4 w-4 opacity-60" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                  {rawAdc}
                </span>
                <span className="text-xs text-muted-foreground ml-1">/ 4095 ADC</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  condition === 'Bright'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : condition === 'Dim'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-300'
                }`}
              >
                {condition}
              </span>
            </div>

            {/* Brightness Bar Meter */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Est. Brightness</span>
                <span className="font-semibold text-foreground">{brightnessPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    brightnessPercent > 65
                      ? 'bg-amber-400'
                      : brightnessPercent > 35
                      ? 'bg-blue-400'
                      : 'bg-indigo-600'
                  }`}
                  style={{ width: `${brightnessPercent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Dark Threshold: {darkThresh}</span>
              <span title="Configured wiring polarity">
                {inverted ? 'Inverted (Dark=High)' : 'Normal (Dark=Low)'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: Confirmed LED State */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase font-medium text-muted-foreground">
              Confirmed LED State
            </CardTitle>
            <div
              className={`rounded-full p-1.5 transition-colors ${
                isLedOn
                  ? 'bg-yellow-500/20 text-yellow-500 animate-pulse-subtle'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Lightbulb className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-3xl font-extrabold tracking-tight font-mono ${
                    isLedOn ? 'text-yellow-500 dark:text-yellow-400' : 'text-muted-foreground'
                  }`}
                >
                  {isLedOn ? 'ON' : 'OFF'}
                </span>
                {isLedOn && (
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400 animate-ping" />
                )}
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">GPIO 23</span>
            </div>

            <div className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Trigger Reason: </span>
              {stateReason}
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Last confirmed:</span>
              <span className="font-medium">{formatRelativeTime(latestReading?.recorded_at || null)}</span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: Operating Mode & Command Acknowledgment */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase font-medium text-muted-foreground">
              Operating Mode
            </CardTitle>
            <div className="rounded-full bg-primary/10 p-1.5 text-primary">
              <Sliders className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground capitalize">
                {isAuto ? 'Automatic' : 'Manual'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  isAuto
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                }`}
              >
                {isAuto ? 'Auto Logic' : 'Remote Override'}
              </span>
            </div>

            {/* Pending Command Indicator */}
            {pendingCommand ? (
              <div className="flex items-center space-x-2 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <Clock3 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>
                  Command <strong>{pendingCommand.command_type}</strong> pending acknowledgment...
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 rounded-lg bg-emerald-500/10 p-2 text-[11px] text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Node configuration in sync</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Hysteresis band:</span>
              <span className="font-mono">{darkThresh} ↔ {lightThresh}</span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: Device Health & Telemetry */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase font-medium text-muted-foreground">
              Device Health
            </CardTitle>
            <div
              className={`rounded-full p-1.5 ${
                isStale
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              <Cpu className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {isDemoMode ? 'Simulated' : isStale ? 'Offline' : 'Healthy'}
              </span>
              <div className="flex items-center space-x-1 text-xs">
                <Wifi className={`h-3.5 w-3.5 ${rssiInfo.color}`} />
                <span className="font-mono text-foreground font-semibold">
                  {latestReading?.wifi_rssi ?? device?.wifi_rssi ?? -64} dBm
                </span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Signal Quality:</span>
                <span className={`font-semibold ${rssiInfo.color}`}>{rssiInfo.label}</span>
              </div>
              <div className="flex justify-between">
                <span>Firmware:</span>
                <span className="font-mono text-foreground">{device?.firmware_version || '1.0.0'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Last Heartbeat:</span>
              <span className="font-medium">
                {latestReading ? formatRelativeTime(latestReading.recorded_at) : 'Unavailable'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Quick Action Banner (When in Manual Mode) */}
      {!isAuto && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Manual Lighting Control is Active</h4>
                <p className="text-xs text-muted-foreground">
                  The ESP32 is currently ignoring light thresholds. Use the buttons to directly override the LED.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                disabled={isLedOn || isStale}
                onClick={() => sendLedCommand(true)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                  isLedOn
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                Turn ON
              </button>
              <button
                disabled={!isLedOn || isStale}
                onClick={() => sendLedCommand(false)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                  !isLedOn
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500'
                }`}
              >
                Turn OFF
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calibration Insight & Polarity Notice */}
      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hardware Wiring & Calibration Reference</CardTitle>
              <CardDescription>
                Understanding how the voltage-divider resistor on GPIO 34 affects your lighting transitions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-border p-3 space-y-1">
              <span className="font-semibold text-foreground">Normal Polarity (Default)</span>
              <p className="text-muted-foreground leading-relaxed">
                LDR connected to 3.3V and 10kΩ pull-down to GND. Ambient light increases resistance, resulting in <strong>lower ADC</strong> readings in darkness.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 space-y-1">
              <span className="font-semibold text-foreground">Inverted Polarity</span>
              <p className="text-muted-foreground leading-relaxed">
                LDR connected to GND and 10kΩ pull-up to 3.3V. Darkness causes ADC voltage to rise toward 4095. Toggle inversion in Device Settings.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 space-y-1">
              <span className="font-semibold text-foreground">Hysteresis Buffer</span>
              <p className="text-muted-foreground leading-relaxed">
                A 300 ADC gap between turn-on ({darkThresh}) and turn-off ({lightThresh}) prevents high-frequency flickering when ambient light lingers near dusk.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
