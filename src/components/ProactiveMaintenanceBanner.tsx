/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Asset, WorkOrder, PredictiveInsight } from '../types';
import { soundFx } from '../utils/audio';
import { 
  AlertTriangle, 
  Thermometer, 
  Activity, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Wrench, 
  ChevronRight, 
  ChevronLeft, 
  BellRing, 
  ShieldAlert, 
  RotateCcw, 
  Flame, 
  Gauge, 
  SlidersHorizontal,
  Layers
} from 'lucide-react';

interface ProactiveMaintenanceBannerProps {
  assets: Asset[];
  workOrders: WorkOrder[];
  onSelectAssetById: (assetId: string) => void;
  onCreateWorkOrder: (wo: Partial<WorkOrder>) => void;
  onSimulatePredictiveAnomaly?: (assetId: string, anomalyType: 'thermal' | 'vibration' | 'normalize') => void;
}

export const ProactiveMaintenanceBanner: React.FC<ProactiveMaintenanceBannerProps> = ({
  assets,
  workOrders,
  onSelectAssetById,
  onCreateWorkOrder,
  onSimulatePredictiveAnomaly,
}) => {
  const [activeInsightIndex, setActiveInsightIndex] = useState<number>(0);
  const [acknowledgedInsightIds, setAcknowledgedInsightIds] = useState<Set<string>>(new Set());

  // Predictive Insight Engine: Analyzes asset vitals in real time
  const insights: PredictiveInsight[] = useMemo(() => {
    const detected: PredictiveInsight[] = [];

    assets.forEach((asset) => {
      const v = asset.vitals;
      const isStillOperational = asset.status !== 'critical' && 
        (asset.category !== 'amr' || (asset as any).state !== 'stopped');
      
      const isHealthDeclining = v.healthScore < 85 && v.healthScore >= 55;
      const isTempElevated = v.temperatureC > 56;
      const isVibElevated = v.vibrationRms > 3.8;

      // Condition: healthScore is declining or vitals show thermal/vibration stress, BUT machine is still operational
      if (isStillOperational && (isHealthDeclining || isTempElevated || isVibElevated)) {
        let title = '';
        let triggerCause = '';
        let impactAnalysis = '';
        let recommendedAction = '';
        let rulHours = 48;
        let anomalyType = 'thermal';

        if (asset.category === 'conveyor') {
          title = `Thermal Creep & Drive Bearing Degradation on ${asset.code}`;
          triggerCause = `Drive roller stator temperature has trended up to ${v.temperatureC.toFixed(1)}°C (${((v.temperatureC / v.temperatureMax) * 100).toFixed(0)}% of limit) with vibration at ${v.vibrationRms} mm/s. Roller speed remains active at 48 m/min, but healthScore has declined to ${v.healthScore}%.`;
          impactAnalysis = `Predictive telemetry estimates bearing lubrication film breakdown. Continued continuous parcel throughput will cause thermal runaway and force an emergency E-Stop interlock within ~38 operating hours.`;
          recommendedAction = `Perform proactive ultrasonic bearing grease replenishment and laser drive belt alignment during off-peak buffer window.`;
          rulHours = 38;
          anomalyType = 'thermal';
        } else if (asset.category === 'robotic_arm') {
          title = `Axis 3 Harmonic Drive Backlash & Thermal Friction on ${asset.code}`;
          triggerCause = `Joint temperature elevated to ${v.temperatureC.toFixed(1)}°C with micro-vibration harmonic peaks. Arm continues automated pick-and-place cycles, but healthScore has degraded to ${v.healthScore}%.`;
          impactAnalysis = `Harmonic gear friction will degrade repeatability tolerances (+0.4mm drift) and lead to vacuum suction grip dropouts within 45 operating hours.`;
          recommendedAction = `Inspect joint seals, retorque structural fasteners, and run automated servo backlash calibration.`;
          rulHours = 45;
          anomalyType = 'vibration';
        } else if (asset.category === 'amr') {
          title = `Inverter Motor Current Ripple & Battery Thermal Rise on ${asset.code}`;
          triggerCause = `Traction motor temperature running warm at ${v.temperatureC.toFixed(1)}°C under payload while maintaining transit routing. HealthScore declined to ${v.healthScore}%.`;
          impactAnalysis = `Brushless motor winding impedance imbalance. Without preventative inspection, high current spikes will trigger wheel drive controller fault during active transport.`;
          recommendedAction = `Reroute unit to Maintenance Bay 02 for motor driver diagnostic scan and wheel caster bearing inspection.`;
          rulHours = 52;
          anomalyType = 'thermal';
        } else {
          title = `Proactive Maintenance Advisory on ${asset.code}`;
          triggerCause = `HealthScore has decreased to ${v.healthScore}% with operating temperature at ${v.temperatureC.toFixed(1)}°C. Machine is currently operational.`;
          impactAnalysis = `Sensor telemetry detects progressive mechanical wear before complete interlock.`;
          recommendedAction = `Schedule preventive maintenance overhaul before degradation reaches critical threshold.`;
          rulHours = 60;
        }

        detected.push({
          id: `insight-${asset.id}`,
          assetId: asset.id,
          assetName: asset.name,
          assetCode: asset.code,
          severity: v.healthScore < 70 ? 'warning' : 'advisory',
          title,
          triggerCause,
          telemetrySummary: {
            healthScore: v.healthScore,
            healthTrend: 'declining',
            currentTemp: v.temperatureC,
            maxTemp: v.temperatureMax,
            tempRatePerHour: 2.4,
            vibrationRms: v.vibrationRms,
            vibrationMax: v.vibrationMax,
            operationalState: 'Operational (Active Throughput)',
          },
          impactAnalysis,
          estimatedRulHours: rulHours,
          recommendedAction,
          suggestedWorkOrder: {
            title: `PROACTIVE PM: ${title}`,
            priority: v.healthScore < 75 ? 'high' : 'medium',
            category: asset.category === 'robotic_arm' ? 'Mechanical' : asset.category === 'conveyor' ? 'Mechanical' : 'Sensors/LiDAR',
            description: `${triggerCause} ${impactAnalysis} Recommended: ${recommendedAction}`,
            estimatedHours: 2.0,
            steps: [
              { text: `Verify machine electrical isolation and lock-out tag-out (LOTO)`, completed: false },
              { text: `Check stator temperature sensor calibration & thermal paste contact`, completed: false },
              { text: `Perform ultrasonic vibration harmonic scan on drive bearings`, completed: false },
              { text: `Apply ISO VG 220 synthetic bearing lubricant`, completed: false },
              { text: `Conduct 15-minute operational test and verify healthScore recovery >90%`, completed: false },
            ],
          },
          detectedAt: 'Real-time telemetry stream',
          acknowledged: acknowledgedInsightIds.has(`insight-${asset.id}`),
        });
      }
    });

    return detected;
  }, [assets, acknowledgedInsightIds]);

  // Safe index bounds
  const currentInsight = insights.length > 0 ? insights[Math.min(activeInsightIndex, insights.length - 1)] : null;

  // Check if a work order has already been dispatched for this asset
  const existingDispatchedOrder = useMemo(() => {
    if (!currentInsight) return null;
    return workOrders.find(
      (wo) =>
        wo.assetId === currentInsight.assetId &&
        (wo.title.toLowerCase().includes('proactive') || wo.title.toLowerCase().includes('preventive') || wo.title.toLowerCase().includes('pm')) &&
        wo.status !== 'completed'
    );
  }, [currentInsight, workOrders]);

  const handleDispatchProactiveOrder = () => {
    if (!currentInsight) return;
    soundFx.playSuccess();

    const suggested = currentInsight.suggestedWorkOrder;
    onCreateWorkOrder({
      id: `PM-${Math.floor(5200 + Math.random() * 80)}`,
      title: suggested.title,
      assetId: currentInsight.assetId,
      assetName: currentInsight.assetName,
      assetCode: currentInsight.assetCode,
      priority: suggested.priority,
      status: 'pending',
      assignedTechnician: 'Sarah Chen',
      technicianRole: 'Predictive Reliability Engineer',
      category: suggested.category,
      createdDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      estimatedHours: suggested.estimatedHours,
      description: suggested.description,
      steps: suggested.steps,
    });
  };

  const handleAcknowledge = () => {
    if (!currentInsight) return;
    soundFx.playClick();
    setAcknowledgedInsightIds((prev) => new Set([...prev, currentInsight.id]));
  };

  const handleNext = () => {
    soundFx.playClick();
    setActiveInsightIndex((prev) => (prev + 1) % insights.length);
  };

  const handlePrev = () => {
    soundFx.playClick();
    setActiveInsightIndex((prev) => (prev - 1 + insights.length) % insights.length);
  };

  return (
    <div className="space-y-3" id="predictive-insight-notification-container">
      {/* Simulation & Test Controls Bar */}
      <div className="bg-slate-950/80 rounded-xl px-4 py-2 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-mono font-bold text-slate-300">
            PREDICTIVE INSIGHT SIMULATOR:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (onSimulatePredictiveAnomaly) {
                soundFx.playClick();
                onSimulatePredictiveAnomaly('conv-01', 'thermal');
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/40 text-amber-300 font-mono text-[11px] font-semibold transition-all flex items-center gap-1.5 active:scale-95"
            title="Simulate thermal creep on conveyor: 64.8°C, health 76%, operational"
          >
            <Flame className="w-3 h-3 text-amber-400" />
            <span>Conveyor Thermal Creep (76%)</span>
          </button>

          <button
            onClick={() => {
              if (onSimulatePredictiveAnomaly) {
                soundFx.playClick();
                onSimulatePredictiveAnomaly('amr-02', 'vibration');
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-blue-950/40 hover:bg-blue-900/60 border border-blue-600/40 text-blue-300 font-mono text-[11px] font-semibold transition-all flex items-center gap-1.5 active:scale-95"
            title="Simulate bearing harmonic vibration on AMR-02: 4.3 mm/s, health 71%, transit"
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>AMR-02 Motor Harmonics (71%)</span>
          </button>

          <button
            onClick={() => {
              if (onSimulatePredictiveAnomaly) {
                soundFx.playClick();
                onSimulatePredictiveAnomaly('conv-01', 'normalize');
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] font-semibold transition-all flex items-center gap-1.5 active:scale-95"
            title="Normalize all asset vitals to optimal 96% health"
          >
            <RotateCcw className="w-3 h-3 text-emerald-400" />
            <span>Normalize All to Optimal</span>
          </button>
        </div>
      </div>

      {/* Main Proactive Warning Banner if Anomaly Detected */}
      {insights.length > 0 && currentInsight ? (
        <div
          id="proactive-maintenance-warning-banner"
          className="relative overflow-hidden rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-slate-900/95 to-slate-900/95 p-4 md:p-5 shadow-[0_0_30px_rgba(245,158,11,0.18)] transition-all animate-fadeIn"
        >
          {/* Top Decorative Industrial Glow Strip */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400" />

          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    PREDICTIVE INSIGHT
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold">
                    PROACTIVE MAINTENANCE ADVISORY
                  </span>
                  {currentInsight.acknowledged && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px]">
                      ACKNOWLEDGED
                    </span>
                  )}
                </div>
                <h3 className="font-mono text-sm sm:text-base font-bold text-white tracking-wide mt-1">
                  {currentInsight.title}
                </h3>
              </div>
            </div>

            {/* Multiple Insights Carousel Selector */}
            {insights.length > 1 && (
              <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 self-start sm:self-center">
                <span className="text-[11px] font-mono text-slate-400">
                  Advisory {activeInsightIndex + 1} of {insights.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrev}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Previous Advisory"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Next Advisory"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Diagnostic Cause & Telemetry Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 my-3.5">
            {/* Detailed Sensor Fusion Explanation */}
            <div className="lg:col-span-2 space-y-2">
              <p className="text-xs sm:text-sm font-sans text-slate-300 leading-relaxed">
                <strong className="text-amber-300 font-mono">Root Telemetry Anomaly:</strong> {currentInsight.triggerCause}
              </p>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs font-mono space-y-1.5">
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>PREDICTIVE ML IMPACT ANALYSIS:</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {currentInsight.impactAnalysis}
                </p>
              </div>
            </div>

            {/* Real-time Telemetry Metrics Pill Deck */}
            <div className="bg-slate-950/90 rounded-xl p-3.5 border border-slate-800 flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase">HEALTH SCORE</span>
                <span className="text-base font-mono font-extrabold text-amber-400">
                  {currentInsight.telemetrySummary.healthScore}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all"
                  style={{ width: `${currentInsight.telemetrySummary.healthScore}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 block">TEMPERATURE</span>
                  <div className="flex items-center gap-1 text-rose-400 font-bold">
                    <Thermometer className="w-3.5 h-3.5" />
                    <span>{currentInsight.telemetrySummary.currentTemp.toFixed(1)}°C</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block">VIBRATION RMS</span>
                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{currentInsight.telemetrySummary.vibrationRms} mm/s</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-400 border-t border-slate-800/80">
                <span>Est. RUL to Interlock:</span>
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{currentInsight.estimatedRulHours} Hours
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-amber-500/20">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Machine Status: <strong>{currentInsight.telemetrySummary.operationalState}</strong></span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {existingDispatchedOrder ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Proactive Ticket Active ({existingDispatchedOrder.id})</span>
                </div>
              ) : (
                <button
                  onClick={handleDispatchProactiveOrder}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95"
                >
                  <Wrench className="w-3.5 h-3.5 text-slate-950" />
                  <span>Auto-Dispatch Proactive Work Order</span>
                </button>
              )}

              <button
                onClick={() => onSelectAssetById(currentInsight.assetId)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <span>Inspect in Digital Twin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {!currentInsight.acknowledged && (
                <button
                  onClick={handleAcknowledge}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-semibold transition-all"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Nominal State Indicator Banner */
        <div className="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                PREDICTIVE VITALS NOMINAL &bull; NO PROACTIVE WARNINGS
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                  All Systems 90%+
                </span>
              </span>
              <p className="text-[11px] font-mono text-slate-400">
                Continuous IoT vibration & thermal regression models operating within standard tolerances.
              </p>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500">
            Click a preset above to simulate a predictive thermal/harmonic degradation drill.
          </div>
        </div>
      )}
    </div>
  );
};
