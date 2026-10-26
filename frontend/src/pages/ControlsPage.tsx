import React, { useState, useEffect } from 'react';
import { useDevice } from '../context/DeviceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card';
import { formatDate, formatRelativeTime } from '../lib/utils';
import {
  Sliders,
  Power,
  Zap,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  RotateCcw,
  Save,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';

export const ControlsPage: React.FC = () => {
  const {
    settings,
    latestReading,
    pendingCommand,
    isStale,
    isDemoMode,
    updateSettings,
    sendLedCommand,
    switchOperatingMode,
  } = useDevice();

  // Local draft settings state
  const [automaticMode, setAutomaticMode] = useState<boolean>(true);
  const [darkThreshold, setDarkThreshold] = useState<number>(1500);
  const [lightThreshold, setLightThreshold] = useState<number>(1800);
  const [darkPolarityInverted, setDarkPolarityInverted] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync draft settings whenever loaded from context
  useEffect(() => {
    if (settings) {
      setAutomaticMode(settings.automatic_mode);
      setDarkThreshold(settings.dark_threshold);
      setLightThreshold(settings.light_threshold);
      setDarkPolarityInverted(settings.dark_polarity_inverted);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    // Validate inputs
    if (darkThreshold < 0 || darkThreshold > 4095 || lightThreshold < 0 || lightThreshold > 4095) {
      alert('Threshold values must be between 0 and 4095.');
      return;
    }

    setSaveStatus('saving');
    const success = await updateSettings({
      automatic_mode: automaticMode,
      dark_threshold: darkThreshold,
      light_threshold: lightThreshold,
      dark_polarity_inverted: darkPolarityInverted,
    });

    if (success) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
    }
  };

  const isLedOn = latestReading ? latestReading.reported_led_state : false;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center space-x-2">
          <Sliders className="h-5 w-5 text-primary" />
          <span>Adaptive Lighting Controls</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Tune automatic photodiode thresholds, configure hysteresis boundaries, or override manual state.
        </p>
      </div>

      {/* Offline Hardware Notice if applicable */}
      {isStale && !isDemoMode && (
        <div className="flex items-start space-x-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold">Device is Offline</h4>
            <p>
              Remote commands and threshold updates cannot be delivered until the ESP32 reconnects to Wi-Fi and checks in with Supabase. Commands have a 30-second time-to-live to prevent stale execution.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SECTION 1: Automatic Mode Configuration */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Automatic Lighting Parameters</CardTitle>
                <CardDescription>
                  Hardware evaluates ambient light and triggers the LED autonomously.
                </CardDescription>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  automaticMode
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {automaticMode ? 'Active Mode' : 'Disabled'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Automatic Mode Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3.5 bg-muted/20">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">Enable Autonomous Mode</span>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, ESP32 turns LED on/off based on calibrated thresholds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutomaticMode(!automaticMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  automaticMode ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    automaticMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Turn ON Threshold (Dark Threshold) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-foreground flex items-center space-x-1">
                  <span>Turn-ON Threshold (Darkness Trigger)</span>
                  <span className="text-[11px] text-muted-foreground">(ADC 0-4095)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="4095"
                  value={darkThreshold}
                  onChange={(e) => setDarkThreshold(Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-card px-2 py-1 text-right font-mono font-bold text-xs"
                />
              </div>
              <input
                type="range"
                min="0"
                max="4095"
                step="25"
                value={darkThreshold}
                onChange={(e) => setDarkThreshold(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-muted accent-primary cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground">
                LED will turn ON when ambient reading crosses {darkThreshold}.
              </p>
            </div>

            {/* Turn OFF Threshold (Light Threshold / Hysteresis) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-foreground flex items-center space-x-1">
                  <span>Turn-OFF Threshold (Hysteresis Guard)</span>
                  <span className="text-[11px] text-muted-foreground">(ADC 0-4095)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="4095"
                  value={lightThreshold}
                  onChange={(e) => setLightThreshold(Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-card px-2 py-1 text-right font-mono font-bold text-xs"
                />
              </div>
              <input
                type="range"
                min="0"
                max="4095"
                step="25"
                value={lightThreshold}
                onChange={(e) => setLightThreshold(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-muted accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground">
                LED will turn OFF when reading reaches {lightThreshold}. (Deadband: {Math.abs(lightThreshold - darkThreshold)} ADC).
              </p>
            </div>

            {/* Polarity Inversion Selector */}
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Sensor Wiring Polarity</span>
                <button
                  type="button"
                  onClick={() => setDarkPolarityInverted(!darkPolarityInverted)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold border transition-colors ${
                    darkPolarityInverted
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-card text-foreground border-border'
                  }`}
                >
                  {darkPolarityInverted ? 'Inverted (Dark = High ADC)' : 'Normal (Dark = Low ADC)'}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Flip if your LDR is wired to VCC vs GND in the voltage divider.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={handleSaveSettings}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center space-x-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saveStatus === 'saving' ? 'Saving...' : 'Deploy Settings to Device'}</span>
              </button>

              {saveStatus === 'saved' && (
                <span className="flex items-center space-x-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Saved successfully</span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Manual Control & Remote Override */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Manual Remote Actuation</CardTitle>
                <CardDescription>
                  Directly toggle the GPIO 23 LED actuator. Overrides automatic threshold logic.
                </CardDescription>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  !automaticMode
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {!automaticMode ? 'Manual Active' : 'Auto Locked'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Mode switch requirement callout */}
            {automaticMode && (
              <div className="flex items-start space-x-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <span className="font-semibold">Automatic Mode is currently engaged.</span>
                  <p>
                    To execute manual commands without autonomous threshold reversion, switch to Manual Mode first.
                  </p>
                  <button
                    onClick={() => switchOperatingMode('manual')}
                    className="mt-1 rounded bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-700"
                  >
                    Switch to Manual Mode Now
                  </button>
                </div>
              </div>
            )}

            {/* Actuator State Visualization */}
            <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-border bg-muted/20">
              <div
                className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${
                  isLedOn
                    ? 'bg-yellow-500/20 text-yellow-500 shadow-xl shadow-yellow-500/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Lightbulb className={`h-12 w-12 ${isLedOn ? 'animate-pulse-subtle' : ''}`} />
                {isLedOn && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span>
                  </span>
                )}
              </div>

              <div className="mt-4 text-center">
                <span className="text-xl font-bold font-mono tracking-tight text-foreground">
                  LED Status: {isLedOn ? 'ACTIVE (ON)' : 'INACTIVE (OFF)'}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confirmed by hardware telemetry
                </p>
              </div>
            </div>

            {/* Remote Command Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                disabled={isLedOn || isStale}
                onClick={() => sendLedCommand(true)}
                className={`flex items-center justify-center space-x-2 rounded-xl py-3 text-xs font-bold transition-all shadow-sm ${
                  isLedOn
                    ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                    : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-98'
                }`}
              >
                <Power className="h-4 w-4" />
                <span>Turn LED ON</span>
              </button>

              <button
                disabled={!isLedOn || isStale}
                onClick={() => sendLedCommand(false)}
                className={`flex items-center justify-center space-x-2 rounded-xl py-3 text-xs font-bold transition-all shadow-sm ${
                  !isLedOn
                    ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                    : 'bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-98'
                }`}
              >
                <Power className="h-4 w-4" />
                <span>Turn LED OFF</span>
              </button>
            </div>

            {/* Pending Command Status */}
            {pendingCommand && (
              <div className="flex items-center space-x-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <Clock3 className="h-4 w-4 shrink-0 animate-spin" />
                <div>
                  <span className="font-semibold">Command Dispatched: </span>
                  <span>
                    Awaiting confirmation from ESP32. (Expires: {formatRelativeTime(pendingCommand.expires_at)})
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
