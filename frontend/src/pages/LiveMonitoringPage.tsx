import React, { useState, useMemo } from 'react';
import { useDevice } from '../context/DeviceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card';
import { TimeRangeFilter, SensorReading } from '../types';
import { formatTime, formatDate, formatRelativeTime, calculateLightCondition } from '../lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { Activity, Clock, Sliders, ShieldAlert, Zap, History, Info } from 'lucide-react';

export const LiveMonitoringPage: React.FC = () => {
  const { readings, settings, latestReading, events, isStale, isDemoMode } = useDevice();
  const [timeFilter, setTimeFilter] = useState<TimeRangeFilter>('15m');

  // Filter readings based on selected time window
  const filteredReadings = useMemo(() => {
    if (!readings || readings.length === 0) return [];
    const now = Date.now();
    let windowMs = 15 * 60 * 1000; // default 15m

    if (timeFilter === '1h') windowMs = 60 * 60 * 1000;
    else if (timeFilter === '24h') windowMs = 24 * 60 * 60 * 1000;
    else if (timeFilter === '7d') windowMs = 7 * 24 * 60 * 60 * 1000;

    const cutoff = now - windowMs;
    const subset = readings.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);
    return subset.length > 0 ? subset : readings.slice(-40); // ensure chart renders even if simulated timestamps differ
  }, [readings, timeFilter]);

  // Format data for Recharts
  const chartData = useMemo(() => {
    return filteredReadings.map((r) => ({
      time: formatTime(r.recorded_at),
      fullDate: formatDate(r.recorded_at),
      adc: r.ldr_raw,
      ledState: r.reported_led_state ? 4000 : 0, // for dual visualization
      isLedOn: r.reported_led_state,
      condition: r.light_condition,
    }));
  }, [filteredReadings]);

  const darkThreshold = settings?.dark_threshold ?? 1500;
  const lightThreshold = settings?.light_threshold ?? 1800;

  return (
    <div className="space-y-6">
      {/* Page Header & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center space-x-2">
            <Activity className="h-5 w-5 text-primary" />
            <span>Live Sensor Telemetry & Waveform</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Continuous 12-bit ADC photodiode stream with real-time hysteresis threshold tracking.
          </p>
        </div>

        {/* Time Filters */}
        <div className="flex items-center space-x-1 rounded-lg border border-border bg-card p-1 shadow-xs">
          {(['15m', '1h', '24h', '7d'] as TimeRangeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                timeFilter === filter
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {filter === '15m'
                ? '15 Mins'
                : filter === '1h'
                ? '1 Hour'
                : filter === '24h'
                ? '24 Hours'
                : '7 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div>
            <CardTitle>Photodiode Voltage (ADC 0-4095) vs Thresholds</CardTitle>
            <CardDescription>
              Showing {filteredReadings.length} data points. Yellow line indicates Dark Threshold; Green line indicates Light Threshold.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-4 text-xs font-medium">
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
              <span>Raw LDR ADC</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-4 bg-amber-500 inline-block border-t border-dashed" />
              <span>Turn-ON Threshold ({darkThreshold})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-4 bg-emerald-500 inline-block border-t border-dashed" />
              <span>Turn-OFF Threshold ({lightThreshold})</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[380px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ldrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground fill-muted-foreground"
                />
                <YAxis
                  domain={[0, 4095]}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground fill-muted-foreground"
                  label={{
                    value: 'Raw ADC (12-bit)',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 11,
                    fill: 'currentColor',
                    offset: 10,
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs space-y-1">
                          <p className="font-semibold text-foreground">{data.fullDate}</p>
                          <div className="flex items-center justify-between space-x-4">
                            <span className="text-muted-foreground">LDR ADC:</span>
                            <span className="font-mono font-bold text-blue-500">{data.adc}</span>
                          </div>
                          <div className="flex items-center justify-between space-x-4">
                            <span className="text-muted-foreground">Condition:</span>
                            <span className="font-semibold">{data.condition}</span>
                          </div>
                          <div className="flex items-center justify-between space-x-4">
                            <span className="text-muted-foreground">Reported LED:</span>
                            <span
                              className={`font-semibold ${
                                data.isLedOn ? 'text-amber-500' : 'text-slate-400'
                              }`}
                            >
                              {data.isLedOn ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Turn-ON Threshold reference line */}
                <ReferenceLine
                  y={darkThreshold}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Dark Threshold (${darkThreshold})`,
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />

                {/* Turn-OFF Threshold reference line */}
                <ReferenceLine
                  y={lightThreshold}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Light Threshold (${lightThreshold})`,
                    fill: '#10b981',
                    fontSize: 10,
                    position: 'insideBottomRight',
                  }}
                />

                {/* Telemetry wave area */}
                <Area
                  type="monotone"
                  dataKey="adc"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#ldrGradient)"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Real-time State & Event Timeline */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Quick Reading Overview */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Current Stream Metadata</CardTitle>
            <CardDescription>Telemetry packet details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Sample Frequency:</span>
              <span className="font-mono font-medium text-foreground">
                Every {settings?.reading_interval_seconds ?? 5}s
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">ADC Resolution:</span>
              <span className="font-mono font-medium text-foreground">12-bit (0-4095)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Active Node Protocol:</span>
              <span className="font-mono font-medium text-foreground">
                HTTPS REST / Realtime
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Sensor Pin:</span>
              <span className="font-mono font-medium text-foreground">ESP32 GPIO 34 (ADC1_CH6)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Phase 2 Motion Pin:</span>
              <span className="font-mono text-muted-foreground">GPIO 19 (Reserved)</span>
            </div>
          </CardContent>
        </Card>

        {/* Live State Event Timeline */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent State Transitions & Events</CardTitle>
                <CardDescription>Trigger log emitted by local node and server rules</CardDescription>
              </div>
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No state transition events logged yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                {events.slice(0, 8).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs"
                  >
                    <div className="flex items-start space-x-2.5">
                      <div
                        className={`mt-0.5 rounded-full p-1 ${
                          ev.event_type === 'LED_STATE_CHANGE'
                            ? 'bg-amber-500/10 text-amber-500'
                            : ev.event_type === 'COMMAND_EXECUTED'
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-blue-500/10 text-blue-500'
                        }`}
                      >
                        <Zap className="h-3 w-3" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {ev.event_type === 'LED_STATE_CHANGE'
                            ? `LED toggled ${ev.details.new_state ? 'ON' : 'OFF'}`
                            : ev.event_type === 'COMMAND_EXECUTED'
                            ? `Command: ${ev.details.command_type || ev.details.command}`
                            : ev.event_type}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {ev.details.trigger_adc !== undefined
                            ? `Triggered by LDR reading ${ev.details.trigger_adc} ADC`
                            : JSON.stringify(ev.details)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                      {formatRelativeTime(ev.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
