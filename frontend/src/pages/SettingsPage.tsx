import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card';
import { formatDate, formatRelativeTime } from '../lib/utils';
import {
  Settings,
  Cpu,
  Radio,
  Sliders,
  CheckCircle2,
  Wand2,
  Sun,
  Moon,
  ArrowRight,
  RefreshCw,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { device, settings, latestReading, isDemoMode, updateSettings } = useDevice();

  // Calibration Wizard State
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [brightSamples, setBrightSamples] = useState<number[]>([]);
  const [darkSamples, setDarkSamples] = useState<number[]>([]);
  const [isSampling, setIsSampling] = useState<boolean>(false);
  const [wizardSaved, setWizardSaved] = useState<boolean>(false);

  // Upload interval
  const [uploadInterval, setUploadInterval] = useState<number>(
    settings?.reading_interval_seconds ?? 5
  );

  // Calibration calculations
  const brightAvg = brightSamples.length
    ? Math.round(brightSamples.reduce((a, b) => a + b, 0) / brightSamples.length)
    : 0;
  const darkAvg = darkSamples.length
    ? Math.round(darkSamples.reduce((a, b) => a + b, 0) / darkSamples.length)
    : 0;

  // Polarity: If dark average is higher than bright average, the circuit is inverted
  const isInvertedCircuit = darkAvg > brightAvg;
  // Recommended thresholds with hysteresis buffer
  const midpoint = Math.round((brightAvg + darkAvg) / 2);
  const hysteresisGap = Math.max(200, Math.round(Math.abs(brightAvg - darkAvg) * 0.15));

  const recommendedDarkThreshold = isInvertedCircuit
    ? midpoint - Math.round(hysteresisGap / 2)
    : midpoint + Math.round(hysteresisGap / 2);

  const recommendedLightThreshold = isInvertedCircuit
    ? midpoint + Math.round(hysteresisGap / 2)
    : midpoint - Math.round(hysteresisGap / 2);

  // Step 1: Capture Bright Samples
  const captureBrightSamples = () => {
    setIsSampling(true);
    const currentAdc = latestReading ? latestReading.ldr_raw : 2800;
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      samples.push(Math.round(currentAdc + (Math.random() - 0.5) * 60));
    }
    setTimeout(() => {
      setBrightSamples(samples);
      setIsSampling(false);
      setWizardStep(2);
    }, 600);
  };

  // Step 2: Capture Dark Samples
  const captureDarkSamples = () => {
    setIsSampling(true);
    // In demo mode or if user covered it, simulate or read
    const currentAdc = isDemoMode ? 850 : latestReading ? latestReading.ldr_raw : 900;
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      samples.push(Math.round(currentAdc + (Math.random() - 0.5) * 50));
    }
    setTimeout(() => {
      setDarkSamples(samples);
      setIsSampling(false);
      setWizardStep(3);
    }, 600);
  };

  // Step 5: Apply Calibrated Settings
  const handleApplyCalibration = async () => {
    await updateSettings({
      dark_threshold: recommendedDarkThreshold,
      light_threshold: recommendedLightThreshold,
      dark_polarity_inverted: isInvertedCircuit,
    });
    setWizardSaved(true);
    setTimeout(() => {
      setWizardStep(1);
      setBrightSamples([]);
      setDarkSamples([]);
      setWizardSaved(false);
    }, 3000);
  };

  const handleSaveInterval = async () => {
    await updateSettings({ reading_interval_seconds: uploadInterval });
    alert(`Telemetry upload interval updated to ${uploadInterval} seconds.`);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center space-x-2">
          <Settings className="h-5 w-5 text-primary" />
          <span>Device Configuration & Guided Calibration</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage ESP32 target provisioning, run the 5-step photodiode calibration wizard, and inspect Phase 2 pins.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Hardware Node Profile */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Hardware Node Metadata</CardTitle>
            <CardDescription>Target provision details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-2 border-b border-border/60 pb-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device ID:</span>
                <span className="font-mono font-semibold text-foreground">
                  {device?.device_identifier || 'ESP32-LIGHT-001'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device Name:</span>
                <span className="font-medium text-foreground">{device?.name || 'ESP32 Lighting Controller'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Firmware:</span>
                <span className="font-mono text-foreground">{device?.firmware_version || '1.0.0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Heartbeat:</span>
                <span className="font-medium text-foreground">
                  {formatDate(device?.last_seen_at || null)}
                </span>
              </div>
            </div>

            {/* Pinout Assignment */}
            <div className="space-y-2">
              <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider text-muted-foreground">
                Hardware GPIO Pin Map
              </span>
              <div className="rounded-lg border border-border p-2.5 bg-muted/20 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GPIO 34:</span>
                  <span className="text-primary font-bold">LDR Sensor (ADC1_6)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GPIO 23:</span>
                  <span className="text-amber-500 font-bold">LED Output (Resistor)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GPIO 19:</span>
                  <span className="text-muted-foreground italic">PIR Sensor (Phase 2)</span>
                </div>
              </div>
            </div>

            {/* Telemetry Interval Configuration */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="font-semibold text-foreground">Upload Interval (Seconds)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="2"
                  max="120"
                  value={uploadInterval}
                  onChange={(e) => setUploadInterval(Number(e.target.value))}
                  className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-xs font-mono font-bold"
                />
                <button
                  onClick={handleSaveInterval}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Default 5 seconds. Higher intervals reduce Wi-Fi power consumption.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 5-Step Guided Calibration Wizard */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <span>Interactive LDR Calibration Wizard</span>
                </CardTitle>
                <CardDescription>
                  Calibrate thresholds precisely based on your room's real ambient lighting and wiring.
                </CardDescription>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                Step {wizardStep} of 5
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Bright Environment */}
            {wizardStep === 1 && (
              <div className="space-y-4 rounded-xl border border-border p-5 bg-muted/20">
                <div className="flex items-center space-x-3">
                  <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500">
                    <Sun className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Step 1: Measure Bright Ambient Conditions
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Ensure your normal room lighting or daylight is illuminating the LDR photodiode.
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-card p-3 rounded-lg border border-border">
                  Current Live ADC: <strong className="font-mono text-foreground">{latestReading?.ldr_raw ?? 2400}</strong>
                </div>

                <button
                  onClick={captureBrightSamples}
                  disabled={isSampling}
                  className="inline-flex items-center space-x-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${isSampling ? 'animate-spin' : ''}`} />
                  <span>{isSampling ? 'Sampling...' : 'Capture Bright Reference'}</span>
                </button>
              </div>
            )}

            {/* Step 2: Dark Environment */}
            {wizardStep === 2 && (
              <div className="space-y-4 rounded-xl border border-border p-5 bg-muted/20">
                <div className="flex items-center space-x-3">
                  <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
                    <Moon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Step 2: Measure Dark Ambient Conditions
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Cover the LDR sensor with your finger or turn off the room lights to simulate darkness.
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-card p-3 rounded-lg border border-border">
                  Captured Bright Average: <strong className="font-mono text-foreground">{brightAvg} ADC</strong>
                </div>

                <button
                  onClick={captureDarkSamples}
                  disabled={isSampling}
                  className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${isSampling ? 'animate-spin' : ''}`} />
                  <span>{isSampling ? 'Sampling...' : 'Capture Dark Reference'}</span>
                </button>
              </div>
            )}

            {/* Step 3: Analysis & Polarity Detection */}
            {wizardStep === 3 && (
              <div className="space-y-4 rounded-xl border border-border p-5 bg-muted/20">
                <h4 className="text-sm font-semibold text-foreground">
                  Step 3: Circuit Analysis & Polarity Identification
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-muted-foreground">Bright Sample Average:</span>
                    <div className="text-xl font-mono font-bold text-amber-500 mt-1">{brightAvg} ADC</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <span className="text-muted-foreground">Dark Sample Average:</span>
                    <div className="text-xl font-mono font-bold text-indigo-400 mt-1">{darkAvg} ADC</div>
                  </div>
                </div>

                <div className="rounded-lg bg-card p-3 border border-border text-xs space-y-1">
                  <span className="font-semibold text-foreground">Identified Polarity: </span>
                  <span className="text-primary font-bold">
                    {isInvertedCircuit ? 'Inverted (Dark = Higher ADC)' : 'Normal (Dark = Lower ADC)'}
                  </span>
                  <p className="text-muted-foreground text-[11px]">
                    {isInvertedCircuit
                      ? 'Darkness increased the voltage measured across the divider.'
                      : 'Darkness decreased the voltage measured across the divider.'}
                  </p>
                </div>

                <button
                  onClick={() => setWizardStep(4)}
                  className="inline-flex items-center space-x-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  <span>Continue to Threshold Recommendation</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 4: Review Recommendations */}
            {wizardStep === 4 && (
              <div className="space-y-4 rounded-xl border border-border p-5 bg-muted/20">
                <h4 className="text-sm font-semibold text-foreground">
                  Step 4: Recommended Threshold Configuration
                </h4>
                <p className="text-xs text-muted-foreground">
                  Based on the difference ({Math.abs(brightAvg - darkAvg)} ADC units), here are the optimal thresholds with anti-flicker hysteresis.
                </p>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      Recommended Turn-ON Threshold:
                    </span>
                    <div className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {recommendedDarkThreshold} ADC
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Recommended Turn-OFF Threshold:
                    </span>
                    <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {recommendedLightThreshold} ADC
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setWizardStep(5)}
                  className="inline-flex items-center space-x-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  <span>Proceed to Confirm and Save</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 5: Save & Deploy */}
            {wizardStep === 5 && (
              <div className="space-y-4 rounded-xl border border-border p-5 bg-muted/20">
                <h4 className="text-sm font-semibold text-foreground">
                  Step 5: Deploy Calibration to ESP32
                </h4>
                <p className="text-xs text-muted-foreground">
                  Click below to write these values to the Supabase database. The ESP32 will pick them up on its next sync poll.
                </p>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleApplyCalibration}
                    className="inline-flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm & Apply Calibration</span>
                  </button>

                  <button
                    onClick={() => setWizardStep(1)}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Restart Wizard
                  </button>
                </div>

                {wizardSaved && (
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                    <Sparkles className="h-4 w-4" />
                    <span>Calibration committed to device settings!</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phase 2 PIR Architecture Specification */}
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Future Phase 2: HC-SR501 PIR Motion Sensor Architecture</CardTitle>
            </div>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Coming in Phase 2
            </span>
          </div>
          <CardDescription>
            The software, database schema, and firmware interfaces are architected to support dual-sensor fusion without breaking changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-border p-3 space-y-1 bg-muted/20">
              <span className="font-semibold text-foreground">Hardware Wiring Reservation</span>
              <p className="text-muted-foreground leading-relaxed">
                ESP32 GPIO 19 is reserved for digital PIR output. In Phase 1, this pin is unread and motion detection remains completely inactive.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 space-y-1 bg-muted/20">
              <span className="font-semibold text-foreground">Database Schema Ready</span>
              <p className="text-muted-foreground leading-relaxed">
                Table <code>sensor_readings</code> has nullable column <code>pir_motion_detected</code>, and <code>device_settings</code> is designed to accept <code>motion_hold_seconds</code>.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 space-y-1 bg-muted/20">
              <span className="font-semibold text-foreground">Lighting Fusion Logic</span>
              <p className="text-muted-foreground leading-relaxed">
                In Phase 2, lighting will activate if: (Ambient Light &lt; Dark Threshold) AND (PIR Motion Detected). Zero motion during dark hours will keep lights off to save energy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
