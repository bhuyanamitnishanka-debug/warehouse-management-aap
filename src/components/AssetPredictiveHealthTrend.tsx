/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Asset } from '../types';
import { soundFx } from '../utils/audio';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Sparkles,
  Info,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  SlidersHorizontal,
} from 'lucide-react';

interface AssetPredictiveHealthTrendProps {
  assets: Asset[];
  selectedAssetId?: string;
  onSelectAsset?: (assetId: string) => void;
}

type TimeHorizon = '30d' | '90d' | '180d';

interface HistoricalHealthPoint {
  date: string;
  timestamp: number;
  actualHealth: number | null;
  predictedHealth: number | null;
  upperConfidence: number | null;
  lowerConfidence: number | null;
  vibrationRms: number;
  temperatureC: number;
  anomalyScore?: number;
  event?: string;
  isProjected?: boolean;
}

export const AssetPredictiveHealthTrend: React.FC<AssetPredictiveHealthTrendProps> = ({
  assets,
  selectedAssetId,
  onSelectAsset,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string>(
    selectedAssetId || (assets.length > 0 ? assets[0].id : '')
  );
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('90d');
  const [showConfidenceBands, setShowConfidenceBands] = useState<boolean>(true);
  const [showSecondaryMetrics, setShowSecondaryMetrics] = useState<boolean>(true);

  // Synchronize internal state if selectedAssetId prop updates
  const activeAssetId = selectedAssetId || internalSelectedId;
  const currentAsset = useMemo(() => {
    return assets.find((a) => a.id === activeAssetId) || assets[0];
  }, [assets, activeAssetId]);

  // Generate deterministic, realistic predictive maintenance historical data
  const chartData = useMemo(() => {
    if (!currentAsset) return [];

    const baseHealth = currentAsset.vitals.healthScore;
    const baseTemp = currentAsset.vitals.temperatureC;
    const baseVib = currentAsset.vitals.vibrationRms;
    const isDegraded = currentAsset.status === 'critical' || currentAsset.status === 'warning';

    const pointsCount = timeHorizon === '30d' ? 30 : timeHorizon === '90d' ? 45 : 60;
    const historyRatio = 0.72; // ~72% historical recorded, 28% projected
    const historyCount = Math.floor(pointsCount * historyRatio);
    const projectedCount = pointsCount - historyCount;

    const data: HistoricalHealthPoint[] = [];
    const today = new Date();

    // Past points
    for (let i = historyCount; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i * (timeHorizon === '30d' ? 1 : timeHorizon === '90d' ? 2 : 3));
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Calculate historical degradation curve
      // For degraded assets, show drop recently; for healthy assets, show steady high performance with slight natural fluctuations
      const progressToNow = (historyCount - i) / historyCount;
      let calculatedHealth: number;

      if (isDegraded) {
        // High earlier, sharp/steady decay leading to current degraded score
        const startHealth = 98;
        calculatedHealth = Math.round(startHealth - (startHealth - baseHealth) * Math.pow(progressToNow, 1.8) + (Math.sin(i * 1.5) * 1.2));
      } else {
        // Steady nominal variance around baseHealth (e.g., 94 - 99%)
        calculatedHealth = Math.min(100, Math.max(82, Math.round(baseHealth + Math.sin(i * 0.8) * 2.2 - (1 - progressToNow) * 1.5)));
      }

      // Correlated vibration & temperature
      const healthDeficit = (100 - calculatedHealth) / 100;
      const vib = Number((baseVib * (0.6 + healthDeficit * 0.9) + Math.cos(i) * 0.15).toFixed(2));
      const temp = Number((baseTemp * (0.85 + healthDeficit * 0.3) + Math.sin(i) * 0.4).toFixed(1));

      let event: string | undefined;
      if (i === Math.floor(historyCount * 0.65)) {
        event = 'Scheduled Lubrication';
      } else if (i === Math.floor(historyCount * 0.25) && isDegraded) {
        event = 'Bearing Resonance Anomaly';
      }

      data.push({
        date: dateLabel,
        timestamp: d.getTime(),
        actualHealth: calculatedHealth,
        predictedHealth: i === 0 ? calculatedHealth : null, // overlap point for continuity
        upperConfidence: null,
        lowerConfidence: null,
        vibrationRms: vib,
        temperatureC: temp,
        event,
        isProjected: false,
      });
    }

    // Future / Predictive Projection Points
    const lastActual = data[data.length - 1].actualHealth || baseHealth;
    for (let j = 1; j <= projectedCount; j++) {
      const d = new Date(today);
      d.setDate(today.getDate() + j * (timeHorizon === '30d' ? 1 : timeHorizon === '90d' ? 2 : 3));
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Predictive trajectory: without maintenance vs normal wear
      const decayRate = isDegraded ? 0.92 : 0.25;
      const predicted = Math.max(30, Math.round(lastActual - (j * decayRate) + Math.sin(j * 0.7) * 0.8));

      // Confidence interval widens over time into the future (fan of uncertainty)
      const uncertainty = j * (isDegraded ? 1.4 : 0.8);
      const upper = Math.min(100, Math.round(predicted + uncertainty));
      const lower = Math.max(20, Math.round(predicted - uncertainty));

      const healthDeficit = (100 - predicted) / 100;
      const vib = Number((baseVib * (0.7 + healthDeficit * 1.2)).toFixed(2));
      const temp = Number((baseTemp * (0.9 + healthDeficit * 0.4)).toFixed(1));

      data.push({
        date: dateLabel,
        timestamp: d.getTime(),
        actualHealth: null,
        predictedHealth: predicted,
        upperConfidence: upper,
        lowerConfidence: lower,
        vibrationRms: vib,
        temperatureC: temp,
        isProjected: true,
      });
    }

    return data;
  }, [currentAsset, timeHorizon]);

  // Derived predictive analytics KPIs
  const analyticsSummary = useMemo(() => {
    if (!currentAsset) return null;
    const currentScore = currentAsset.vitals.healthScore;
    const projectedEnd = chartData.length > 0 ? chartData[chartData.length - 1].predictedHealth || currentScore : currentScore;
    const delta = projectedEnd - currentScore;

    // Remaining useful life estimate based on health score trajectory
    const daysToCritical = currentScore <= 60 
      ? '3 - 5 Days' 
      : currentScore <= 75 
      ? '18 - 24 Days' 
      : '140+ Days';

    return {
      currentScore,
      projectedEnd,
      delta,
      daysToCritical,
      rulConfidence: currentScore < 70 ? 'High Risk' : 'Optimal',
      failureProbability: currentScore < 60 ? '78.4%' : currentScore < 80 ? '24.1%' : '3.2%',
    };
  }, [currentAsset, chartData]);

  const handleAssetChange = (newId: string) => {
    soundFx.playClick();
    setInternalSelectedId(newId);
    if (onSelectAsset) {
      onSelectAsset(newId);
    }
  };

  if (!currentAsset) return null;

  return (
    <div id="predictive-maintenance-trend-panel" className="bg-slate-900/90 rounded-2xl p-4 md:p-6 border border-slate-800 shadow-xl space-y-5">
      {/* Header & Asset Switcher Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-base font-bold text-white tracking-wide">
                PREDICTIVE ASSET HEALTH & DEGRADATION TREND
              </h2>
              <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                RECHARTS ML ENGINE
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Historical sensor fusion & Remaining Useful Life (RUL) algorithmic projection
            </p>
          </div>
        </div>

        {/* Controls: Asset Selector & Time Horizon */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Asset Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700/80">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <label htmlFor="predictive-asset-select" className="sr-only">Select Asset</label>
            <select
              id="predictive-asset-select"
              value={activeAssetId}
              onChange={(e) => handleAssetChange(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer"
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id} className="bg-slate-900 text-white">
                  {asset.code} &bull; {asset.name} ({asset.vitals.healthScore}%)
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Toggles */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 font-mono text-xs">
            {(['30d', '90d', '180d'] as TimeHorizon[]).map((horizon) => (
              <button
                key={horizon}
                onClick={() => {
                  soundFx.playClick();
                  setTimeHorizon(horizon);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  timeHorizon === horizon
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {horizon}
              </button>
            ))}
          </div>

          {/* Feature toggles */}
          <button
            onClick={() => setShowConfidenceBands(!showConfidenceBands)}
            className={`px-2.5 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-1.5 transition-all ${
              showConfidenceBands
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Confidence Envelope"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Confidence Band</span>
          </button>
        </div>
      </div>

      {/* Asset Snapshot & Predictive Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
            CURRENT HEALTH SCORE
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-mono font-extrabold ${
                currentAsset.vitals.healthScore >= 80
                  ? 'text-emerald-400'
                  : currentAsset.vitals.healthScore >= 65
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {currentAsset.vitals.healthScore}%
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                currentAsset.status === 'optimal'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : currentAsset.status === 'warning'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-300 animate-pulse'
              }`}
            >
              {currentAsset.status}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 block mt-1">
            ISO 10816 Class II Standard
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
            ESTIMATED RUL TO CRITICAL
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-mono font-extrabold text-cyan-400">
              {analyticsSummary?.daysToCritical}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 block mt-1">
            Failure Probability: <strong className="text-white">{analyticsSummary?.failureProbability}</strong>
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
            SENSOR HARMONICS
          </span>
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-200">
            <span>Vib: <span className="text-amber-400">{currentAsset.vitals.vibrationRms} mm/s</span></span>
            <span>Temp: <span className="text-rose-400">{currentAsset.vitals.temperatureC.toFixed(1)}°C</span></span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 block mt-1">
            Operating: {currentAsset.vitals.operatingHours} hrs
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
            PREDICTED DRIFT ({timeHorizon})
          </span>
          <div className="flex items-center gap-1.5">
            {analyticsSummary && analyticsSummary.delta < 0 ? (
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            )}
            <span
              className={`text-xl font-mono font-extrabold ${
                analyticsSummary && analyticsSummary.delta < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {analyticsSummary ? `${analyticsSummary.delta > 0 ? '+' : ''}${analyticsSummary.delta}%` : '0%'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 block mt-1">
            Trajectory without repair
          </span>
        </div>
      </div>

      {/* Main Recharts Area & Predictive Degradation Curve */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/90 relative">
        {/* Chart Legend / Guidance Note */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs font-mono">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
              <span className="text-slate-300 font-semibold">Recorded Telemetry</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-purple-400 inline-block" />
              <span className="text-purple-300 font-semibold">Predictive AI Forecast</span>
            </div>
            {showConfidenceBands && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/40 inline-block" />
                <span className="text-slate-400">95% Confidence Interval</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-rose-500 inline-block" /> Threshold Alert (&lt;65%)
            </span>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <defs>
                {/* Gradient for Actual Recorded Health */}
                <linearGradient id="actualHealthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>

                {/* Gradient for Projected Health */}
                <linearGradient id="projectedHealthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>

                {/* Gradient for Upper/Lower Confidence Envelope */}
                <linearGradient id="confidenceBandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
              />

              <YAxis
                domain={[20, 100]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                unit="%"
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as HistoricalHealthPoint;
                    const isProj = data.isProjected;
                    return (
                      <div className="bg-slate-950/95 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs font-mono space-y-1.5 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-white">{label}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              isProj
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {isProj ? 'Projected ML Forecast' : 'Recorded Telemetry'}
                          </span>
                        </div>

                        {data.actualHealth !== null && (
                          <div className="flex justify-between gap-4 text-cyan-300 font-bold">
                            <span>Health Score:</span>
                            <span>{data.actualHealth}%</span>
                          </div>
                        )}

                        {data.predictedHealth !== null && (
                          <div className="flex justify-between gap-4 text-purple-300 font-bold">
                            <span>Projected Health:</span>
                            <span>{data.predictedHealth}%</span>
                          </div>
                        )}

                        {showConfidenceBands && data.upperConfidence !== null && (
                          <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
                            <span>95% Confidence:</span>
                            <span>{data.lowerConfidence}% - {data.upperConfidence}%</span>
                          </div>
                        )}

                        <div className="pt-1 border-t border-slate-800/80 flex justify-between gap-4 text-[11px] text-slate-400">
                          <span>Vibration RMS:</span>
                          <span className="text-amber-400 font-semibold">{data.vibrationRms} mm/s</span>
                        </div>

                        <div className="flex justify-between gap-4 text-[11px] text-slate-400">
                          <span>Temperature:</span>
                          <span className="text-rose-400 font-semibold">{data.temperatureC}°C</span>
                        </div>

                        {data.event && (
                          <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-amber-300 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Log: {data.event}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Critical Alert Threshold Line (65% Critical boundary) */}
              <ReferenceLine
                y={65}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Critical Service Interlock Threshold (65%)',
                  fill: '#f87171',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  position: 'insideBottomRight',
                }}
              />

              {/* Warning Threshold Line (80%) */}
              <ReferenceLine
                y={80}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                strokeWidth={1}
                label={{
                  value: 'Advisory Threshold (80%)',
                  fill: '#fbbf24',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  position: 'insideTopRight',
                }}
              />

              {/* Upper Confidence Band Area */}
              {showConfidenceBands && (
                <Area
                  type="monotone"
                  dataKey="upperConfidence"
                  stroke="none"
                  fill="url(#confidenceBandGrad)"
                  isAnimationActive={false}
                />
              )}

              {/* Lower Confidence Band Area */}
              {showConfidenceBands && (
                <Area
                  type="monotone"
                  dataKey="lowerConfidence"
                  stroke="none"
                  fill="#020617" // blends out base to reveal band between upper & lower
                  isAnimationActive={false}
                />
              )}

              {/* Actual Recorded Health Score Curve */}
              <Area
                type="monotone"
                dataKey="actualHealth"
                stroke="#06b6d4"
                strokeWidth={2.5}
                fill="url(#actualHealthGrad)"
                dot={{ r: 2.5, fill: '#06b6d4', stroke: '#083344', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#22d3ee', stroke: '#ffffff', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Projected / Forecast Line */}
              <Line
                type="monotone"
                dataKey="predictedHealth"
                stroke="#a855f7"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ r: 2, fill: '#c084fc' }}
                activeDot={{ r: 6, fill: '#e9d5ff', stroke: '#7e22ce', strokeWidth: 2 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Informative Footer & Recommended Actions */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Health score synthesizes vibration RMS spectral density, bearing stator temperature, and cycle wear.
            </span>
          </div>

          <div className="flex items-center gap-2 font-semibold">
            {currentAsset.vitals.healthScore < 80 ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Action: Dispatch Preventive PM Overhaul
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Asset within optimal operating parameters
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
