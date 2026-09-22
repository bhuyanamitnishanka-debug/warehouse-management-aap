/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Technician, WorkOrder, Asset } from '../types';
import { soundFx } from '../utils/audio';
import { ShiftTimelineView } from './ShiftTimelineView';
import {
  Users,
  UserCheck,
  Clock,
  Briefcase,
  Radio,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Sparkles,
  Award,
  Zap,
  RotateCcw,
  ArrowRight,
  Plus,
  Flame,
  ChevronRight,
  PhoneCall,
  Calendar,
  Layers,
  MapPin,
  HelpCircle,
  X
} from 'lucide-react';

interface LaborResourceViewProps {
  technicians: Technician[];
  setTechnicians: React.Dispatch<React.SetStateAction<Technician[]>>;
  workOrders: WorkOrder[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  assets: Asset[];
  onSelectAsset?: (assetId: string) => void;
}

export const LaborResourceView: React.FC<LaborResourceViewProps> = ({
  technicians,
  setTechnicians,
  workOrders,
  setWorkOrders,
  assets,
  onSelectAsset,
}) => {
  // Sub-tab view mode: timeline, roster, or combined
  const [activeTab, setActiveTab] = useState<'timeline' | 'roster' | 'combined'>('combined');

  // Filters and Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');

  // Interactive Modals
  const [reassignModalWo, setReassignModalWo] = useState<WorkOrder | null>(null);
  const [targetTechName, setTargetTechName] = useState<string>('');
  const [radioPingToast, setRadioPingToast] = useState<{ techName: string; channel: string } | null>(null);
  const [optimizingToast, setOptimizingToast] = useState<string | null>(null);

  // Group work orders by technician
  const workOrdersByTech = useMemo(() => {
    const map = new Map<string, WorkOrder[]>();
    technicians.forEach((t) => map.set(t.name, []));

    workOrders.forEach((wo) => {
      const existing = map.get(wo.assignedTechnician);
      if (existing) {
        existing.push(wo);
      } else {
        map.set(wo.assignedTechnician, [wo]);
      }
    });
    return map;
  }, [technicians, workOrders]);

  // Unassigned work orders
  const unassignedWorkOrders = useMemo(() => {
    return workOrders.filter(
      (wo) =>
        wo.assignedTechnician.toLowerCase() === 'unassigned' ||
        wo.assignedTechnician.toLowerCase() === 'none' ||
        !technicians.some((t) => t.name === wo.assignedTechnician)
    );
  }, [workOrders, technicians]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalTechs = technicians.length;
    const activeCount = technicians.filter((t) => t.status === 'active').length;
    const dispatchedCount = technicians.filter((t) => t.status === 'dispatched').length;
    const standbyCount = technicians.filter((t) => t.status === 'standby').length;
    const breakCount = technicians.filter((t) => t.status === 'on_break').length;

    const totalHoursLogged = technicians.reduce((sum, t) => sum + (t.shiftHoursLogged || 0), 0);
    const totalHoursCapacity = technicians.reduce((sum, t) => sum + (t.shiftMaxHours || 8), 0);
    const shiftUtilizationPct = totalHoursCapacity > 0 ? (totalHoursLogged / totalHoursCapacity) * 100 : 0;

    const activeWorkOrdersCount = workOrders.filter((wo) => wo.status !== 'completed').length;
    const completedTasksToday = technicians.reduce((sum, t) => sum + t.completedTodayCount, 0);

    const avgSafetyScore =
      technicians.length > 0
        ? technicians.reduce((sum, t) => sum + t.safetyScore, 0) / technicians.length
        : 100;

    const avgEfficiency =
      technicians.length > 0
        ? technicians.reduce((sum, t) => sum + (t.efficiencyRating || 95), 0) / technicians.length
        : 95;

    return {
      totalTechs,
      activeCount,
      dispatchedCount,
      standbyCount,
      breakCount,
      totalHoursLogged,
      totalHoursCapacity,
      shiftUtilizationPct,
      activeWorkOrdersCount,
      completedTasksToday,
      avgSafetyScore,
      avgEfficiency,
    };
  }, [technicians, workOrders]);

  // Filtered Technicians
  const filteredTechnicians = useMemo(() => {
    return technicians.filter((t) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesRole = t.role.toLowerCase().includes(q);
        const matchesSpecialty = t.specialty.toLowerCase().includes(q);
        const matchesStation = t.assignedStationZone.toLowerCase().includes(q);
        const techWos = workOrdersByTech.get(t.name) || [];
        const matchesWo = techWos.some(
          (wo) => wo.id.toLowerCase().includes(q) || wo.title.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesRole && !matchesSpecialty && !matchesStation && !matchesWo) {
          return false;
        }
      }

      // Shift filter
      if (selectedShift !== 'all') {
        if (!t.shift.toLowerCase().includes(selectedShift.toLowerCase())) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (t.status !== selectedStatus) return false;
      }

      // Zone filter
      if (selectedZone !== 'all') {
        if (!t.assignedStationZone.toLowerCase().includes(selectedZone.toLowerCase())) return false;
      }

      return true;
    });
  }, [technicians, searchQuery, selectedShift, selectedStatus, selectedZone, workOrdersByTech]);

  // Handle Shift Hours update (+0.5h or -0.5h)
  const handleAdjustHours = (techId: string, delta: number) => {
    soundFx.playClick();
    setTechnicians((prev) =>
      prev.map((t) => {
        if (t.id !== techId) return t;
        const newHours = Math.max(0, Math.min(12, Math.round((t.shiftHoursLogged + delta) * 10) / 10));
        return {
          ...t,
          shiftHoursLogged: newHours,
        };
      })
    );
  };

  // Handle Status Toggle
  const handleToggleStatus = (techId: string, newStatus: Technician['status']) => {
    soundFx.playClick();
    setTechnicians((prev) =>
      prev.map((t) => (t.id === techId ? { ...t, status: newStatus } : t))
    );
  };

  // Ping radio sound & toast
  const handlePingRadio = (tech: Technician) => {
    soundFx.playAlarm();
    setRadioPingToast({ techName: tech.name, channel: tech.contactRadioChannel || 'CH-01' });
    setTimeout(() => {
      setRadioPingToast(null);
    }, 4000);
  };

  // Execute Work Order Reassignment
  const handleConfirmReassign = () => {
    if (!reassignModalWo || !targetTechName) return;
    soundFx.playSuccess();

    const selectedTech = technicians.find((t) => t.name === targetTechName);

    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === reassignModalWo.id
          ? {
              ...wo,
              assignedTechnician: targetTechName,
              technicianRole: selectedTech?.role || 'Maintenance Specialist',
              status: wo.status === 'completed' ? 'in_progress' : wo.status,
            }
          : wo
      )
    );

    // Update technician status to dispatched if on standby
    if (selectedTech && selectedTech.status === 'standby') {
      setTechnicians((prev) =>
        prev.map((t) => (t.id === selectedTech.id ? { ...t, status: 'dispatched' } : t))
      );
    }

    setReassignModalWo(null);
    setTargetTechName('');
  };

  // Complete a work order directly from labor view
  const handleCompleteWorkOrder = (woId: string) => {
    soundFx.playSuccess();
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== woId) return wo;
        return {
          ...wo,
          status: 'completed',
          steps: wo.steps.map((s) => ({ ...s, completed: true })),
        };
      })
    );

    // Increment completed today count for technician
    const targetWo = workOrders.find((w) => w.id === woId);
    if (targetWo) {
      setTechnicians((prev) =>
        prev.map((t) =>
          t.name === targetWo.assignedTechnician
            ? { ...t, completedTodayCount: t.completedTodayCount + 1, status: 'active' }
            : t
        )
      );
    }
  };

  // Toggle step completion inside a work order
  const handleToggleStep = (woId: string, stepIndex: number) => {
    soundFx.playClick();
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== woId) return wo;
        const newSteps = [...wo.steps];
        newSteps[stepIndex] = {
          ...newSteps[stepIndex],
          completed: !newSteps[stepIndex].completed,
        };
        const allDone = newSteps.every((s) => s.completed);
        return {
          ...wo,
          steps: newSteps,
          status: allDone ? 'completed' : 'in_progress',
        };
      })
    );
  };

  // AI-Assisted Automated Workforce Load Balancing
  const handleAutoBalanceWorkload = () => {
    soundFx.playSuccess();
    setOptimizingToast('Analyzing technician shift hours, active ticket loads, and zone specialties...');

    setTimeout(() => {
      // Find unassigned or pending work orders
      const pendingOrders = workOrders.filter((w) => w.status !== 'completed');
      if (pendingOrders.length === 0) {
        setOptimizingToast('All current work orders are already closed or optimal.');
        setTimeout(() => setOptimizingToast(null), 3000);
        return;
      }

      // Sort technicians by fewest active work orders and lowest shift hours
      const techWorkloads = technicians.map((t) => {
        const activeCount = workOrders.filter(
          (w) => w.assignedTechnician === t.name && w.status !== 'completed'
        ).length;
        return {
          tech: t,
          loadScore: activeCount * 2 + (t.shiftHoursLogged / (t.shiftMaxHours || 8)),
        };
      });

      techWorkloads.sort((a, b) => a.loadScore - b.loadScore);

      // Distribute any unassigned work order
      let updatedOrders = [...workOrders];
      let assignmentsMade = 0;

      updatedOrders = updatedOrders.map((wo) => {
        if (
          wo.status !== 'completed' &&
          (wo.assignedTechnician.toLowerCase() === 'unassigned' ||
            wo.assignedTechnician.toLowerCase() === 'none')
        ) {
          const bestTech = techWorkloads[assignmentsMade % techWorkloads.length].tech;
          assignmentsMade++;
          return {
            ...wo,
            assignedTechnician: bestTech.name,
            technicianRole: bestTech.role,
            status: 'in_progress' as const,
          };
        }
        return wo;
      });

      setWorkOrders(updatedOrders);
      setOptimizingToast(
        assignmentsMade > 0
          ? `Workforce optimized! Auto-assigned ${assignmentsMade} pending order(s) to balanced technicians.`
          : `Fleet workload is already balanced across all active shift technicians.`
      );

      setTimeout(() => {
        setOptimizingToast(null);
      }, 4500);
    }, 600);
  };

  // Warehouse Operational Functional Stations (Directly grounded in user reference diagram)
  const warehouseStations = [
    { key: 'all', label: 'All Zones', count: technicians.length },
    { key: 'Receiving', label: 'Goods Received (GRN)', count: technicians.filter(t => t.assignedStationZone.includes('Receiving') || t.assignedStationZone.includes('Dock')).length },
    { key: 'Quality', label: 'Quality Assurance', count: technicians.filter(t => t.assignedStationZone.includes('Quality')).length },
    { key: 'Sorter', label: 'Sorter & Conveyor', count: technicians.filter(t => t.assignedStationZone.includes('Sorter')).length },
    { key: 'Palletizing', label: 'Allocation / Putaway', count: technicians.filter(t => t.assignedStationZone.includes('Palletizing')).length },
    { key: 'AMR', label: 'Stock Transfer & AMR', count: technicians.filter(t => t.assignedStationZone.includes('AMR')).length },
    { key: 'Picking', label: 'Order Picking & Dispatch', count: technicians.filter(t => t.assignedStationZone.includes('Picking') || t.assignedStationZone.includes('Dispatch')).length },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Radio Ping Notification Toast */}
      {radioPingToast && (
        <div className="fixed top-20 right-6 z-50 bg-cyan-950/95 border-2 border-cyan-400 text-cyan-200 px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
              <span>TWO-WAY RADIO DISPATCH</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-cyan-500/30 rounded text-cyan-300 font-mono">
                {radioPingToast.channel}
              </span>
            </div>
            <p className="text-xs text-cyan-200 font-mono">
              Signal transmitted to <span className="font-bold text-white">{radioPingToast.techName}</span>. Tone acknowledged.
            </p>
          </div>
        </div>
      )}

      {/* Optimizing Workload Toast Banner */}
      {optimizingToast && (
        <div className="bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-blue-950/90 border border-cyan-500/50 p-3.5 rounded-xl shadow-lg flex items-center justify-between gap-3 text-cyan-200 font-mono text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
            <span className="font-semibold text-white">{optimizingToast}</span>
          </div>
          <button
            onClick={() => setOptimizingToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner: Workforce Management Analytics & Optimization Bar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Users className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-mono font-bold text-white tracking-wide">
                LABOR RESOURCE & SHIFT DISPATCH
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                LIVE WORKFORCE ACTIVE
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Shift hours tracking, station deployments, real-time ticket loads, and automated workforce balancing.
            </p>
          </div>

          {/* Action Buttons: Auto-Balance & Quick Dispatch */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleAutoBalanceWorkload}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Balance Workload</span>
            </button>
            {unassignedWorkOrders.length > 0 && (
              <button
                onClick={() => setReassignModalWo(unassignedWorkOrders[0])}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold transition-all animate-pulse"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>{unassignedWorkOrders.length} Unassigned Ticket(s)</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Analytical KPI Metrics Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* Techs On-Duty */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/90 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono mb-1">
              <span>ON-DUTY FLEET</span>
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-white">{metrics.totalTechs}</span>
              <span className="text-xs font-mono text-emerald-400">
                ({metrics.activeCount} active, {metrics.dispatchedCount} dispatched)
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-2">
              <span className="text-blue-400 font-semibold">{metrics.standbyCount} Standby</span>
              <span>&bull;</span>
              <span className="text-slate-400">{metrics.breakCount} On Break</span>
            </div>
          </div>

          {/* Shift Hours & Cumulative Capacity */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/90 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono mb-1">
              <span>SHIFT UTILIZATION</span>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-cyan-400">
                {metrics.totalHoursLogged.toFixed(1)}h
              </span>
              <span className="text-xs font-mono text-slate-400">
                / {metrics.totalHoursCapacity.toFixed(0)}h cap
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, metrics.shiftUtilizationPct)}%` }}
              />
            </div>
          </div>

          {/* Active Work Orders Under Execution */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/90 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono mb-1">
              <span>ACTIVE WORK ORDERS</span>
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-amber-300">
                {metrics.activeWorkOrdersCount}
              </span>
              <span className="text-xs font-mono text-slate-400">in execution</span>
            </div>
            <p className="text-[10px] font-mono text-emerald-400 mt-1">
              &bull; {metrics.completedTasksToday} closed today
            </p>
          </div>

          {/* Fleet Efficiency Rating */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/90 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono mb-1">
              <span>EFFICIENCY RATING</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-emerald-400">
                {metrics.avgEfficiency.toFixed(1)}%
              </span>
              <span className="text-[10px] font-mono text-emerald-500">+1.8% vs avg</span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 mt-1">
              Job throughput benchmark
            </p>
          </div>

          {/* Fleet Safety Score */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/90 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono mb-1">
              <span>SAFETY COMPLIANCE</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-emerald-300">
                {metrics.avgSafetyScore.toFixed(1)}%
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 mt-1">
              Zero OSHA incidents (184d)
            </p>
          </div>
        </div>

        {/* Interactive Warehouse Station Deployment Ribbon (Homage to User Reference Diagram) */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Warehouse Functional Stations &amp; Labor Allocation
            </span>
            <span className="text-[10px] font-mono text-slate-400">Click a station to filter</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {warehouseStations.map((st) => (
              <button
                key={st.key}
                onClick={() => {
                  soundFx.playClick();
                  setSelectedZone(selectedZone === st.key ? 'all' : st.key);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                  (selectedZone === st.key || (st.key === 'all' && selectedZone === 'all'))
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    (selectedZone === st.key || (st.key === 'all' && selectedZone === 'all'))
                      ? 'bg-blue-900/60 text-blue-200'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {st.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs: 24h Timeline & Coverage Gaps vs Technician Roster vs Combined */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('combined');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'combined'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Unified View</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('timeline');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>24h Shift Timeline &amp; Gaps</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 text-[10px] font-bold">
              Gaps Radar
            </span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('roster');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'roster'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Technician Profiles &amp; Dispatch</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active Warehouse Shift: <strong className="text-white">Morning Shift 1 (06:00 - 14:30)</strong></span>
        </div>
      </div>

      {/* 24-Hour Shift Timeline & Coverage Gap Radar */}
      {(activeTab === 'timeline' || activeTab === 'combined') && (
        <ShiftTimelineView
          technicians={technicians}
          setTechnicians={setTechnicians}
          workOrders={workOrders}
          selectedZoneFilter={selectedZone}
        />
      )}

      {/* Technician Roster Grid & Filter Section */}
      {(activeTab === 'roster' || activeTab === 'combined') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
            <span className="flex items-center gap-1.5 font-bold text-slate-300">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              DEPLOYED TECHNICIAN ROSTER &amp; ACTIVE TICKET QUEUES
            </span>
            <span>
              Showing {filteredTechnicians.length} of {technicians.length} personnel
            </span>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search technician, role, station zone, or work order ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Shift Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-400" />
            Shift:
          </span>
          <select
            value={selectedShift}
            onChange={(e) => {
              soundFx.playClick();
              setSelectedShift(e.target.value);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Shifts</option>
            <option value="morning">Morning (06:00 - 14:30)</option>
            <option value="afternoon">Afternoon (14:00 - 22:30)</option>
            <option value="night">Night (22:00 - 06:30)</option>
          </select>
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => {
              soundFx.playClick();
              setSelectedStatus(e.target.value);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active (On Floor)</option>
            <option value="dispatched">Dispatched (Ticket)</option>
            <option value="standby">Standby (Ready)</option>
            <option value="on_break">On Break</option>
          </select>
        </div>

        {/* Clear filters if any applied */}
        {(searchQuery || selectedShift !== 'all' || selectedStatus !== 'all' || selectedZone !== 'all') && (
          <button
            onClick={() => {
              soundFx.playClick();
              setSearchQuery('');
              setSelectedShift('all');
              setSelectedStatus('all');
              setSelectedZone('all');
            }}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Main Grid of Assigned Technicians */}
      {filteredTechnicians.length === 0 ? (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-mono font-bold text-white mb-1">No Technicians Match Criteria</h3>
          <p className="text-xs font-mono text-slate-400 mb-4">
            Try adjusting your search terms, station zone, or shift filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedShift('all');
              setSelectedStatus('all');
              setSelectedZone('all');
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-mono text-xs font-bold text-white transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {filteredTechnicians.map((tech) => {
            const techWos = workOrdersByTech.get(tech.name) || [];
            const activeWos = techWos.filter((w) => w.status !== 'completed');
            const completedWos = techWos.filter((w) => w.status === 'completed');
            const hoursLogged = tech.shiftHoursLogged || 0;
            const maxHours = tech.shiftMaxHours || 8;
            const shiftPct = Math.round((hoursLogged / maxHours) * 100);
            const remainingHours = Math.max(0, Math.round((maxHours - hoursLogged) * 10) / 10);
            const isOvertime = hoursLogged >= maxHours;

            return (
              <div
                key={tech.id}
                className="bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all p-4 sm:p-5 shadow-lg flex flex-col justify-between group space-y-4"
              >
                {/* Tech Profile Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Avatar & Identifiers */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-white text-base shadow-md relative"
                        style={{ backgroundColor: tech.avatarColor }}
                      >
                        {tech.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                        {/* Status Beacon Pip */}
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                            tech.status === 'active'
                              ? 'bg-emerald-400 animate-pulse'
                              : tech.status === 'dispatched'
                              ? 'bg-amber-400 animate-pulse'
                              : tech.status === 'standby'
                              ? 'bg-blue-400'
                              : 'bg-purple-400'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-mono font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {tech.name}
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {tech.id.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-300">{tech.role}</p>
                        <p className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          {tech.assignedStationZone}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill & Two-Way Radio Button */}
                    <div className="flex flex-col items-end gap-1.5">
                      <select
                        value={tech.status}
                        onChange={(e) =>
                          handleToggleStatus(tech.id, e.target.value as Technician['status'])
                        }
                        className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                          tech.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : tech.status === 'dispatched'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : tech.status === 'standby'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        }`}
                      >
                        <option value="active" className="bg-slate-900 text-emerald-400">
                          Active (On Floor)
                        </option>
                        <option value="dispatched" className="bg-slate-900 text-amber-400">
                          Dispatched
                        </option>
                        <option value="standby" className="bg-slate-900 text-blue-400">
                          Standby (Ready)
                        </option>
                        <option value="on_break" className="bg-slate-900 text-purple-400">
                          On Break
                        </option>
                      </select>

                      {/* Radio Dispatch Button */}
                      <button
                        onClick={() => handlePingRadio(tech)}
                        title={`Ping two-way radio ${tech.contactRadioChannel || 'CH-01'}`}
                        className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 hover:border-cyan-500/40 transition-colors"
                      >
                        <Radio className="w-2.5 h-2.5 text-cyan-400" />
                        <span>{tech.contactRadioChannel || 'CH-01'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Shift Hours Telemetry Card & Adjuster */}
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Shift: {tech.shift}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAdjustHours(tech.id, -0.5)}
                          title="Deduct 0.5 logged hours"
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center justify-center transition-colors"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleAdjustHours(tech.id, +0.5)}
                          title="Add 0.5 logged hours"
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-baseline text-[11px] font-mono mb-1">
                        <span className="text-slate-400">
                          Hours Logged:{' '}
                          <strong className="text-white text-xs">{hoursLogged.toFixed(1)}h</strong> /{' '}
                          {maxHours.toFixed(1)}h
                        </span>
                        <span
                          className={`font-bold ${
                            isOvertime
                              ? 'text-rose-400'
                              : shiftPct > 80
                              ? 'text-amber-400'
                              : 'text-cyan-400'
                          }`}
                        >
                          {isOvertime ? 'OVERTIME' : `${remainingHours}h remaining`} ({shiftPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOvertime
                              ? 'bg-rose-500'
                              : shiftPct > 80
                              ? 'bg-amber-500'
                              : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, shiftPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Compact Badges: Safety & Efficiency */}
                    <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <ShieldCheck className="w-3 h-3" />
                        Safety: {tech.safetyScore}%
                      </span>
                      <span className="flex items-center gap-1 text-cyan-300">
                        <TrendingUp className="w-3 h-3" />
                        Efficiency: {tech.efficiencyRating || 96}%
                      </span>
                      <span className="flex items-center gap-1 text-blue-300">
                        <CheckCircle2 className="w-3 h-3" />
                        Closed Today: {tech.completedTodayCount}
                      </span>
                    </div>
                  </div>

                  {/* Certifications Pills */}
                  {tech.certifications && tech.certifications.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tech.certifications.map((cert) => (
                        <span
                          key={cert}
                          className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 flex items-center gap-1"
                        >
                          <Award className="w-2.5 h-2.5 text-amber-400" />
                          {cert}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section: Active Work Orders Assigned to Technician */}
                <div className="border-t border-slate-800 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                        Active Assigned Work Orders ({activeWos.length})
                      </span>
                    </div>
                    {/* Reassign / Assign Button */}
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        // Find first unassigned ticket or ticket from this tech
                        const orderToAssign = unassignedWorkOrders[0] || activeWos[0];
                        if (orderToAssign) {
                          setReassignModalWo(orderToAssign);
                          setTargetTechName(tech.name);
                        } else if (workOrders.length > 0) {
                          setReassignModalWo(workOrders[0]);
                          setTargetTechName(tech.name);
                        }
                      }}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Assign Ticket</span>
                    </button>
                  </div>

                  {activeWos.length === 0 ? (
                    <div className="bg-slate-950/50 rounded-xl p-3 border border-dashed border-slate-800 text-center">
                      <p className="text-xs font-mono text-slate-400">
                        No active work orders currently assigned.
                      </p>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold block mt-0.5">
                        &bull; Standby capacity available for priority dispatch
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeWos.map((wo) => {
                        const completedSteps = wo.steps.filter((s) => s.completed).length;
                        const totalSteps = wo.steps.length;
                        const stepPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                        return (
                          <div
                            key={wo.id}
                            className="bg-slate-950 rounded-xl p-3 border border-slate-800/90 hover:border-slate-700 space-y-2 transition-colors"
                          >
                            {/* WO Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-mono text-xs font-bold text-cyan-400">
                                    {wo.id}
                                  </span>
                                  <span
                                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded ${
                                      wo.priority === 'urgent'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                        : wo.priority === 'high'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                    }`}
                                  >
                                    {wo.priority}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                                    {wo.category}
                                  </span>
                                </div>
                                <h4 className="text-xs font-mono font-semibold text-slate-200 line-clamp-1">
                                  {wo.title}
                                </h4>
                                <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                                  <span>Target:</span>
                                  <strong className="text-slate-300">{wo.assetCode}</strong> &bull; {wo.assetName}
                                </p>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    soundFx.playClick();
                                    setReassignModalWo(wo);
                                    setTargetTechName('');
                                  }}
                                  title="Reassign to another technician"
                                  className="p-1 rounded text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono"
                                >
                                  Reassign
                                </button>
                                <button
                                  onClick={() => handleCompleteWorkOrder(wo.id)}
                                  title="Mark Work Order as Completed"
                                  className="p-1 rounded text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-[10px] font-mono flex items-center gap-0.5"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Close</span>
                                </button>
                              </div>
                            </div>

                            {/* Checklist Steps (Interactive) */}
                            {wo.steps.length > 0 && (
                              <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800/80 space-y-1.5">
                                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                                  <span>Checklist ({completedSteps}/{totalSteps})</span>
                                  <span className="text-cyan-400 font-bold">{stepPct}%</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                                  <div
                                    className="bg-cyan-400 h-full rounded-full transition-all"
                                    style={{ width: `${stepPct}%` }}
                                  />
                                </div>
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1 text-[11px] font-mono">
                                  {wo.steps.map((step, sIdx) => (
                                    <div
                                      key={sIdx}
                                      onClick={() => handleToggleStep(wo.id, sIdx)}
                                      className={`flex items-start gap-2 p-1 rounded cursor-pointer transition-colors ${
                                        step.completed
                                          ? 'text-slate-400 line-through bg-slate-950/40'
                                          : 'text-slate-200 hover:bg-slate-800'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={step.completed}
                                        onChange={() => {}}
                                        className="mt-0.5 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                                      />
                                      <span className="text-[10px] leading-tight flex-1">
                                        {step.text}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Time & Due Date Footer */}
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                              <span>Est. Time: {wo.estimatedHours}h</span>
                              <span>Due: {wo.dueDate}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recently Completed Section Fold */}
                  {completedWos.length > 0 && (
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1 text-emerald-400/80">
                        <CheckCircle2 className="w-3 h-3" />
                        {completedWos.length} order(s) completed this shift
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      )}

      {/* Reassign / Dispatch Work Order Modal */}
      {reassignModalWo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-mono text-base font-bold text-white">
                    REASSIGN WORK ORDER DISPATCH
                  </h3>
                </div>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Optimize workforce allocation by assigning to a certified technician.
                </p>
              </div>
              <button
                onClick={() => setReassignModalWo(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ticket Snapshot */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-400">{reassignModalWo.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                  {reassignModalWo.priority}
                </span>
              </div>
              <p className="text-xs font-semibold text-white">{reassignModalWo.title}</p>
              <p className="text-[11px] text-slate-400">
                Target: <strong className="text-slate-300">{reassignModalWo.assetCode}</strong> ({reassignModalWo.assetName})
              </p>
              <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                <span>Current Assignee: <strong className="text-amber-300">{reassignModalWo.assignedTechnician}</strong></span>
                <span>Est: {reassignModalWo.estimatedHours}h</span>
              </div>
            </div>

            {/* Select Target Technician */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-semibold text-slate-300 block">
                Select Destination Technician:
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {technicians.map((t) => {
                  const isSelected = targetTechName === t.name;
                  const activeCount = (workOrdersByTech.get(t.name) || []).filter(
                    (w) => w.status !== 'completed'
                  ).length;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setTargetTechName(t.name)}
                      className={`p-2.5 rounded-xl border cursor-pointer font-mono text-xs transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: t.avatarColor }}
                        >
                          {t.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-100">{t.name}</p>
                          <p className="text-[10px] text-slate-400">{t.role}</p>
                        </div>
                      </div>

                      <div className="text-right text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                            t.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : t.status === 'standby'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {t.status}
                        </span>
                        <p className="text-slate-400 mt-1">
                          {activeCount} active order(s) &bull; {t.shiftHoursLogged}h logged
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => setReassignModalWo(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!targetTechName}
                onClick={handleConfirmReassign}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono text-xs font-bold transition-all shadow-md"
              >
                Confirm Dispatch &amp; Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
