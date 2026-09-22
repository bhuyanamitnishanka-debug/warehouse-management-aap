/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Asset, WorkOrder, Technician, WorkOrderPriority, WorkOrderCategory } from '../types';
import { soundFx } from '../utils/audio';
import {
  Calendar,
  Clock,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Filter,
  Plus,
  ArrowRight,
  ShieldCheck,
  Zap,
  Gauge,
  SlidersHorizontal,
  Info,
  CheckSquare
} from 'lucide-react';

interface PreventiveMaintenanceSchedulerProps {
  assets: Asset[];
  workOrders: WorkOrder[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  technicians: Technician[];
  onSelectAssetById?: (assetId: string) => void;
}

// Service template based on asset category and runtime interval
interface ServiceTemplate {
  intervalHours: number;
  serviceTitle: string;
  category: WorkOrderCategory;
  estimatedHours: number;
  priority: WorkOrderPriority;
  defaultTechnician: string;
  steps: { text: string; completed: boolean }[];
  description: string;
}

const SERVICE_TEMPLATES_BY_CATEGORY: Record<string, ServiceTemplate> = {
  conveyor: {
    intervalHours: 500,
    serviceTitle: 'Conveyor Roller Bearing Lubrication & Belt Tension Sync',
    category: 'Mechanical',
    estimatedHours: 2.0,
    priority: 'high',
    defaultTechnician: 'Marcus Vance',
    description: 'Scheduled preventive lubrication of high-speed roller bearings and harmonic belt frequency tension calibration on primary merge sorter.',
    steps: [
      { text: 'Perform mechanical LOTO lockout on 480V drive motor switchgear', completed: false },
      { text: 'Inspect Intralox modular belts for guide-tab fatigue and debris wedging', completed: false },
      { text: 'Dispense 15g high-temp polyurea synthetic grease into roller drive bearings', completed: false },
      { text: 'Verify belt frequency tension with acoustic sonic meter (Target: 65Hz ± 3Hz)', completed: false },
      { text: 'Release LOTO and conduct 10-minute dry-run vibration sensor verification', completed: false },
    ],
  },
  amr: {
    intervalHours: 350,
    serviceTitle: 'AMR 360° Safety LiDAR & Drive Wheel Suspension Overhaul',
    category: 'Sensors/LiDAR',
    estimatedHours: 1.5,
    priority: 'medium',
    defaultTechnician: 'Sarah Chen',
    description: 'Preventive optical cleaning, LiDAR ray-casting calibration, and polyurethane drive wheel tread depth measurement.',
    steps: [
      { text: 'Navigate AMR into dedicated maintenance docking bay and engage manual e-stop', completed: false },
      { text: 'Clean optical front/rear LiDAR lenses and 3D time-of-flight camera covers', completed: false },
      { text: 'Measure drive wheel polyurethane tread depth (Minimum acceptable: >8.5mm)', completed: false },
      { text: 'Run automated static SLAM target calibration loop in test pen', completed: false },
      { text: 'Check battery cell balance and impedance across internal 48V pack', completed: false },
    ],
  },
  robotic_arm: {
    intervalHours: 400,
    serviceTitle: 'Robotic Arm Vacuum Suction End-Effector & Harmonic Drive Audit',
    category: 'Hydraulics/Pneumatics',
    estimatedHours: 1.8,
    priority: 'high',
    defaultTechnician: 'David Kim',
    description: 'Pneumatic line pressure decay test, vacuum suction cup wear replacement, and joint backlash backlash backlash tolerance audit.',
    steps: [
      { text: 'Lock robotic cell light curtains and engage teach-pendant safety interlock', completed: false },
      { text: 'Inspect vacuum silicone cups on end-effector and replace worn suction lip rings', completed: false },
      { text: 'Conduct 6-bar vacuum decay test (decay rate must not exceed 0.05 bar/min)', completed: false },
      { text: 'Check J1-J6 harmonic drive reducer gear oil levels and check magnetic drain plug', completed: false },
      { text: 'Execute zero-point calibration routine and return robot to automated production', completed: false },
    ],
  },
  dock: {
    intervalHours: 750,
    serviceTitle: 'Hydraulic Loading Dock Leveler HPU Fluid & Safety Lip Test',
    category: 'Hydraulics/Pneumatics',
    estimatedHours: 2.5,
    priority: 'medium',
    defaultTechnician: 'Elena Rostova',
    description: 'Fluid sampling on hydraulic power unit, filter core replacement, and vehicle restraint interlock trigger verification.',
    steps: [
      { text: 'Place dock safety maintenance prop bar securely under raised leveler deck', completed: false },
      { text: 'Sample hydraulic ISO 46 oil for particle contamination and viscosity breakdown', completed: false },
      { text: 'Replace 10-micron return line filter element and torque canister to 35 Nm', completed: false },
      { text: 'Inspect main lift cylinder and lip extension cylinder chrome rods for scoring', completed: false },
      { text: 'Verify trailer dock lock interlock signal communicates with warehouse WMS', completed: false },
    ],
  },
};

export const PreventiveMaintenanceScheduler: React.FC<PreventiveMaintenanceSchedulerProps> = ({
  assets,
  workOrders,
  setWorkOrders,
  technicians,
  onSelectAssetById,
}) => {
  // Configurable daily runtime burn rate (hours per day)
  const [dailyRuntimeHours, setDailyRuntimeHours] = useState<number>(18);
  const [filterStatus, setFilterStatus] = useState<'all' | 'due_soon' | 'overdue' | 'healthy'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Current simulation reference date: Sep 22, 2026
  const CURRENT_DATE = useMemo(() => new Date('2026-09-22T00:00:00'), []);

  // Compute PM status for each asset
  const assetSchedules = useMemo(() => {
    return assets.map((asset) => {
      // Get template for category
      const template =
        SERVICE_TEMPLATES_BY_CATEGORY[asset.category] || SERVICE_TEMPLATES_BY_CATEGORY['conveyor'];

      const operatingHours = asset.vitals?.operatingHours || 1200;
      const interval = template.intervalHours;

      // Hours elapsed since last PM cycle
      const hoursSinceLastService = operatingHours % interval;
      // Hours remaining until next PM trigger
      const hoursRemaining = Math.max(0, interval - hoursSinceLastService);

      // Percentage of interval consumed
      const percentElapsed = Math.min(125, Math.round((hoursSinceLastService / interval) * 100));

      // Calculate days remaining based on daily runtime burn rate
      const daysRemaining = Math.max(0, hoursRemaining / dailyRuntimeHours);

      // Calculate suggested service date
      const suggestedDate = new Date(CURRENT_DATE);
      suggestedDate.setDate(suggestedDate.getDate() + Math.round(daysRemaining));

      const suggestedDateString = suggestedDate.toISOString().split('T')[0];

      // Formatted friendly relative date text
      let relativeDueText = '';
      if (hoursRemaining <= 0 || percentElapsed >= 100) {
        relativeDueText = 'OVERDUE (Service Now)';
      } else if (daysRemaining <= 1) {
        relativeDueText = 'Tomorrow (Urgent)';
      } else if (daysRemaining <= 3) {
        relativeDueText = `In ${Math.ceil(daysRemaining)} days`;
      } else {
        relativeDueText = `In ${Math.ceil(daysRemaining)} days`;
      }

      // Determine Urgency Status
      let urgency: 'overdue' | 'due_soon' | 'upcoming' | 'healthy';
      if (hoursRemaining <= 0 || percentElapsed >= 100) {
        urgency = 'overdue';
      } else if (percentElapsed >= 85 || daysRemaining <= 3) {
        urgency = 'due_soon';
      } else if (percentElapsed >= 60) {
        urgency = 'upcoming';
      } else {
        urgency = 'healthy';
      }

      // Check if there is already an active or pending work order for this asset
      const activePendingWo = workOrders.find(
        (wo) => wo.assetId === asset.id && wo.status !== 'completed'
      );

      return {
        asset,
        template,
        operatingHours,
        interval,
        hoursSinceLastService,
        hoursRemaining,
        percentElapsed,
        daysRemaining,
        suggestedDateString,
        relativeDueText,
        urgency,
        activePendingWo,
      };
    });
  }, [assets, dailyRuntimeHours, CURRENT_DATE, workOrders]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return assetSchedules.filter((item) => {
      if (filterStatus === 'overdue' && item.urgency !== 'overdue') return false;
      if (filterStatus === 'due_soon' && item.urgency !== 'due_soon' && item.urgency !== 'overdue')
        return false;
      if (filterStatus === 'healthy' && item.urgency !== 'healthy' && item.urgency !== 'upcoming')
        return false;
      if (filterCategory !== 'all' && item.asset.category !== filterCategory) return false;
      return true;
    });
  }, [assetSchedules, filterStatus, filterCategory]);

  // Aggregated KPI Stats
  const stats = useMemo(() => {
    const total = assetSchedules.length;
    const overdueCount = assetSchedules.filter((s) => s.urgency === 'overdue').length;
    const dueSoonCount = assetSchedules.filter((s) => s.urgency === 'due_soon').length;
    const pendingGeneratedCount = assetSchedules.filter((s) => s.activePendingWo).length;
    const unassignedDueCount = assetSchedules.filter(
      (s) => (s.urgency === 'overdue' || s.urgency === 'due_soon') && !s.activePendingWo
    ).length;

    return {
      total,
      overdueCount,
      dueSoonCount,
      criticalCount: overdueCount + dueSoonCount,
      pendingGeneratedCount,
      unassignedDueCount,
    };
  }, [assetSchedules]);

  // Generate a work order for a single scheduled asset
  const handleGenerateWorkOrder = (scheduleItem: (typeof assetSchedules)[0]) => {
    soundFx.playSuccess();
    const { asset, template, suggestedDateString, urgency } = scheduleItem;

    const newPriority: WorkOrderPriority =
      urgency === 'overdue' ? 'high' : urgency === 'due_soon' ? 'medium' : 'low';

    // Find technician or fallback
    const assignedTech =
      technicians.find((t) => t.name === template.defaultTechnician)?.name ||
      technicians[0]?.name ||
      'Unassigned';

    const newWo: WorkOrder = {
      id: `WO-${Math.floor(4130 + Math.random() * 80)}`,
      title: `[PM] ${asset.code}: ${template.serviceTitle}`,
      assetId: asset.id,
      assetName: asset.name,
      assetCode: asset.code,
      priority: newPriority,
      status: 'pending',
      assignedTechnician: assignedTech,
      technicianRole: 'Preventive Reliability Specialist',
      category: template.category,
      createdDate: '2026-09-22',
      dueDate: suggestedDateString,
      estimatedHours: template.estimatedHours,
      description: `Automated Preventive Maintenance order triggered by asset runtime tracker (${scheduleItem.operatingHours} operating hours logged). ${template.description}`,
      steps: template.steps.map((s) => ({ ...s })),
    };

    setWorkOrders((prev) => [newWo, ...prev]);
    setToastMessage(`Generated Pending Work Order ${newWo.id} for ${asset.code}!`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Batch generate work orders for all due/overdue assets without active work orders
  const handleBatchGenerateDueOrders = () => {
    soundFx.playSuccess();
    const dueItems = assetSchedules.filter(
      (s) => (s.urgency === 'overdue' || s.urgency === 'due_soon') && !s.activePendingWo
    );

    if (dueItems.length === 0) {
      setToastMessage('All due preventive maintenance services already have active work orders!');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const newOrders: WorkOrder[] = dueItems.map((item, idx) => {
      const assignedTech =
        technicians.find((t) => t.name === item.template.defaultTechnician)?.name ||
        technicians[idx % technicians.length]?.name ||
        'Unassigned';

      return {
        id: `WO-${Math.floor(4140 + Math.random() * 70) + idx}`,
        title: `[PM] ${item.asset.code}: ${item.template.serviceTitle}`,
        assetId: item.asset.id,
        assetName: item.asset.name,
        assetCode: item.asset.code,
        priority: item.urgency === 'overdue' ? 'high' : 'medium',
        status: 'pending',
        assignedTechnician: assignedTech,
        technicianRole: 'Preventive Reliability Specialist',
        category: item.template.category,
        createdDate: '2026-09-22',
        dueDate: item.suggestedDateString,
        estimatedHours: item.template.estimatedHours,
        description: `Batch Automated PM Work Order triggered by asset runtime analysis (${item.operatingHours} operating hrs). ${item.template.description}`,
        steps: item.template.steps.map((s) => ({ ...s })),
      };
    });

    setWorkOrders((prev) => [...newOrders, ...prev]);
    setToastMessage(
      `Batch Generated ${newOrders.length} Pending Work Orders for due equipment!`
    );
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl p-4 md:p-6 border border-slate-800 shadow-xl space-y-5 font-mono">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Calendar className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-wider">
              PREVENTIVE MAINTENANCE SCHEDULER
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              RUNTIME DISPATCH RADAR
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Dynamically projects upcoming service dates based on cumulative operating runtime and automated work order generation.
          </p>
        </div>

        {/* Action: Batch Generate Due PM Orders */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleBatchGenerateDueOrders}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Generate Due PM Orders</span>
            {stats.unassignedDueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
                {stats.unassignedDueCount} Due
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toast Confirmation Notification */}
      {toastMessage && (
        <div className="bg-gradient-to-r from-emerald-950/90 to-cyan-950/90 border border-emerald-500/50 p-3 rounded-xl flex items-center justify-between text-emerald-200 text-xs shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-[11px] px-1.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Analytical KPI Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Monitored Assets */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>MONITORED ASSETS</span>
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{stats.total}</span>
            <span className="text-xs text-slate-400">active units</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">100% telemetry synced</p>
        </div>

        {/* Due Soon or Overdue */}
        <div
          className={`rounded-xl p-3 border shadow-inner ${
            stats.criticalCount > 0
              ? 'bg-rose-950/30 border-rose-800/80 text-rose-300'
              : 'bg-slate-950/80 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-bold">DUE SOON / OVERDUE</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{stats.criticalCount}</span>
            <span className="text-xs text-rose-400">
              ({stats.overdueCount} overdue, {stats.dueSoonCount} due)
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Operating interval threshold &ge; 85%</p>
        </div>

        {/* Pending Generated PM Tickets */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>GENERATED ORDERS</span>
            <Wrench className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-400">
              {stats.pendingGeneratedCount}
            </span>
            <span className="text-xs text-slate-400">in work order hub</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Pending technician dispatch</p>
        </div>

        {/* Runtime Burn Rate Configurator */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>RUNTIME BURN RATE</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xl font-bold text-amber-300">{dailyRuntimeHours} h/day</span>
            <select
              value={dailyRuntimeHours}
              onChange={(e) => {
                soundFx.playClick();
                setDailyRuntimeHours(Number(e.target.value));
              }}
              className="bg-slate-900 border border-slate-700 text-[11px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-400"
            >
              <option value="12">12 h/d (1-Shift)</option>
              <option value="16">16 h/d (2-Shift)</option>
              <option value="18">18 h/d (Standard)</option>
              <option value="20">20 h/d (Heavy)</option>
              <option value="24">24 h/d (Continuous)</option>
            </select>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Used to forecast service dates</p>
        </div>
      </div>

      {/* Filter and Category Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/90">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-cyan-400" />
            Urgency:
          </span>
          <button
            onClick={() => {
              soundFx.playClick();
              setFilterStatus('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All ({assetSchedules.length})
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setFilterStatus('due_soon');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'due_soon'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            Due Soon / Overdue ({stats.criticalCount})
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setFilterStatus('healthy');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              filterStatus === 'healthy'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            Healthy ({assetSchedules.length - stats.criticalCount})
          </button>
        </div>

        {/* Category Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Equipment Type:</span>
          <select
            value={filterCategory}
            onChange={(e) => {
              soundFx.playClick();
              setFilterCategory(e.target.value);
            }}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Types</option>
            <option value="conveyor">Conveyors</option>
            <option value="amr">AMR Fleet</option>
            <option value="robotic_arm">Robotic Arms</option>
            <option value="dock">Loading Docks</option>
          </select>
        </div>
      </div>

      {/* Main Asset Schedule List */}
      <div className="space-y-3">
        {filteredSchedules.map((schedule) => {
          const isExpanded = expandedAssetId === schedule.asset.id;
          const { asset, template, hoursSinceLastService, hoursRemaining, percentElapsed, suggestedDateString, relativeDueText, urgency, activePendingWo } = schedule;

          return (
            <div
              key={asset.id}
              className={`rounded-xl border transition-all ${
                urgency === 'overdue'
                  ? 'bg-rose-950/20 border-rose-800/80 hover:border-rose-700'
                  : urgency === 'due_soon'
                  ? 'bg-amber-950/20 border-amber-800/70 hover:border-amber-600'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Main Card Header Row */}
              <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left Asset Details */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      urgency === 'overdue'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : urgency === 'due_soon'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-blue-500/10 text-cyan-400 border-blue-500/20'
                    }`}
                  >
                    <Wrench className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-bold text-white text-sm tracking-wide">
                        {asset.code}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold truncate max-w-[220px]">
                        {asset.name}
                      </span>
                      {/* Urgency Badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          urgency === 'overdue'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                            : urgency === 'due_soon'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : urgency === 'upcoming'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {relativeDueText}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 truncate">
                      Routine: <strong className="text-slate-300">{template.serviceTitle}</strong>
                    </p>
                  </div>
                </div>

                {/* Center: Runtime Progress Bar & Forecast */}
                <div className="w-full md:w-64 shrink-0 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Runtime Cycle: <strong>{hoursSinceLastService}h</strong> / {schedule.interval}h
                    </span>
                    <span
                      className={`font-bold ${
                        percentElapsed >= 100
                          ? 'text-rose-400'
                          : percentElapsed >= 85
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {percentElapsed}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      style={{ width: `${Math.min(100, percentElapsed)}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        percentElapsed >= 100
                          ? 'bg-gradient-to-r from-rose-600 to-rose-500'
                          : percentElapsed >= 85
                          ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                          : 'bg-gradient-to-r from-cyan-600 to-blue-500'
                      }`}
                    />
                  </div>

                  {/* Suggested Date Forecast */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Suggested Date: <strong className="text-white">{suggestedDateString}</strong>
                    </span>
                    <span>{hoursRemaining}h left</span>
                  </div>
                </div>

                {/* Right: Work Order Dispatch Action */}
                <div className="flex items-center gap-2 shrink-0">
                  {activePendingWo ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{activePendingWo.id} (Pending)</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateWorkOrder(schedule)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ${
                        urgency === 'overdue'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                          : urgency === 'due_soon'
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Generate Work Order</span>
                    </button>
                  )}

                  {/* Expand Standard Checklist */}
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setExpandedAssetId(isExpanded ? null : asset.id);
                    }}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                    title="View Standard Operating Checklist"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable Standard Maintenance Procedure Checklist */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-900/50 space-y-3 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                    <div>
                      <strong className="text-white">Assigned Technician:</strong>{' '}
                      <span className="text-cyan-300">{template.defaultTechnician}</span> &bull;{' '}
                      <strong className="text-white">Est. Duration:</strong> {template.estimatedHours}h
                    </div>
                    {onSelectAssetById && (
                      <button
                        onClick={() => onSelectAssetById(asset.id)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1 underline"
                      >
                        Inspect Full Digital Twin Telemetry &rarr;
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                    {template.description}
                  </p>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      Standard Operating Procedure Steps (Pre-populated in generated ticket):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {template.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60"
                        >
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-snug">{step.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
