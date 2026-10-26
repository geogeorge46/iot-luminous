import React, { useState, useMemo } from 'react';
import { useDevice } from '../context/DeviceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/common/Card';
import {
  formatDate,
  formatTime,
  calculateAnalytics,
  exportToCSV,
} from '../lib/utils';
import {
  Download,
  Filter,
  Calendar,
  Layers,
  Clock,
  Zap,
  TrendingDown,
  TrendingUp,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { readings, events } = useDevice();

  // Filters
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Filtered readings list
  const filteredReadings = useMemo(() => {
    if (!readings) return [];
    if (selectedEventType === 'all') return readings;
    if (selectedEventType === 'led_on') return readings.filter((r) => r.reported_led_state);
    if (selectedEventType === 'led_off') return readings.filter((r) => !r.reported_led_state);
    if (selectedEventType === 'dark') return readings.filter((r) => r.light_condition === 'Dark');
    if (selectedEventType === 'bright') return readings.filter((r) => r.light_condition === 'Bright');
    return readings;
  }, [readings, selectedEventType]);

  // Analytics computation
  const stats = useMemo(() => calculateAnalytics(readings), [readings]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredReadings.length / itemsPerPage));
  const paginatedReadings = useMemo(() => {
    const reversed = [...filteredReadings].reverse();
    const start = (currentPage - 1) * itemsPerPage;
    return reversed.slice(start, start + itemsPerPage);
  }, [filteredReadings, currentPage, itemsPerPage]);

  const handleExportCSV = () => {
    const exportData = filteredReadings.map((r) => ({
      Timestamp: formatDate(r.recorded_at),
      'Raw LDR ADC': r.ldr_raw,
      'Light Condition': r.light_condition,
      'Reported LED State': r.reported_led_state ? 'ON' : 'OFF',
      'Wi-Fi RSSI (dBm)': r.wifi_rssi ?? 'N/A',
    }));
    exportToCSV(`adaptive_lighting_telemetry_${Date.now()}`, exportData);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center space-x-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <span>Sensor History & Analytics</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Historical telemetry archives, state transition audits, and duty cycle analytics.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center space-x-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Aggregate Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase">
              Average ADC Reading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-foreground">
              {stats.avgAdc} <span className="text-xs font-sans text-muted-foreground">ADC</span>
            </div>
            <div className="mt-1 flex items-center space-x-2 text-xs text-muted-foreground">
              <span className="flex items-center text-blue-500">
                <TrendingDown className="h-3.5 w-3.5 mr-0.5" /> Min: {stats.minAdc}
              </span>
              <span>•</span>
              <span className="flex items-center text-amber-500">
                <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> Max: {stats.maxAdc}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase">
              Total LED On-Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-yellow-500">
              {stats.estimatedOnHours}h {stats.estimatedOnMinutes}m
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Estimated active illumination duration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase">
              State Transitions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-foreground">
              {stats.stateChangesCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total threshold ON/OFF transitions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase">
              Logged Telemetry Samples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-foreground">
              {stats.sampleCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Retained in rolling buffer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Limitations Disclaimer */}
      <div className="flex items-start space-x-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Duration Methodology Note:</strong> Total LED active on-time is calculated by multiplying confirmed active samples by the sampling interval (5 seconds). Intermittent device disconnects or network packet dropouts may introduce small variance in estimated totals.
        </p>
      </div>

      {/* Filter Toolbar & Data Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div>
            <CardTitle>Telemetry Records</CardTitle>
            <CardDescription>
              Page {currentPage} of {totalPages} ({filteredReadings.length} total entries matched)
            </CardDescription>
          </div>

          {/* Filter options */}
          <div className="flex items-center space-x-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={selectedEventType}
              onChange={(e) => {
                setSelectedEventType(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Conditions & States</option>
              <option value="led_on">LED State: ON Only</option>
              <option value="led_off">LED State: OFF Only</option>
              <option value="dark">Classification: Dark</option>
              <option value="bright">Classification: Bright</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">LDR Raw (ADC)</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">LED State</th>
                  <th className="py-2.5 px-3">Wi-Fi RSSI</th>
                  <th className="py-2.5 px-3">PIR Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedReadings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No matching records found for this filter.
                    </td>
                  </tr>
                ) : (
                  paginatedReadings.map((r, idx) => (
                    <tr key={r.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {formatDate(r.recorded_at)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                        {r.ldr_raw}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                            r.light_condition === 'Bright'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : r.light_condition === 'Dim'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-indigo-500/10 text-indigo-400'
                          }`}
                        >
                          {r.light_condition}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center space-x-1 font-semibold ${
                            r.reported_led_state ? 'text-yellow-500' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              r.reported_led_state ? 'bg-yellow-400' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          />
                          <span>{r.reported_led_state ? 'ON' : 'OFF'}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {r.wifi_rssi ? `${r.wifi_rssi} dBm` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Phase 2
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 mt-4 text-xs">
              <span className="text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredReadings.length)} of{' '}
                {filteredReadings.length} records
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-semibold px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
