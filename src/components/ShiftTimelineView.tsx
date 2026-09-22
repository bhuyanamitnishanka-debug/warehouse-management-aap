/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Technician, WorkOrder } from '../types';
import { soundFx } from '../utils/audio';
import {
  Clock,
  AlertTriangle,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  MapPin,
  Sparkles,
  Info,
  Radio,
  Briefcase,
  TrendingDown,
  UserPlus
} from 'lucide-react';

interface ShiftTimelineViewProps {
  technicians: Technician[];
  setTechnicians: React.Dispatch<React.SetStateAction<Technician[]>>;
  workOrders: WorkOrder[];
  selectedZoneFilter?: string;
}

export const ShiftTimelineView: React.FC<ShiftTimelineViewProps> = ({
  technicians,
  setTechnicians,
  workOrders,
  selectedZoneFilter = 'all',
}) => {
  // Active simulated facility hour for current time marker (e.g. 10.75 = 10:45 AM)
  const [currentHour] = useState<number>(10.75); // 10:45 AM during peak shift
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [hoveredTechId, setHoveredTechId] = useState<string | null>(null);
  const [selectedOverlapId, setSelectedOverlapId] = useState<string | null>(null);
  const [gapResolutionToast, setGapResolutionToast] = useState<string | null>(null);

  // 24 Hour ticks (0 to 24)
  const hourTicks = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => i * 2); // [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
  }, []);

  // Filter technicians if zone filter applied
  const filteredTechs = useMemo(() => {
    if (!selectedZoneFilter || selectedZoneFilter === 'all') return technicians;
    return technicians.filter((t) =>
      t.assignedStationZone.toLowerCase().includes(selectedZoneFilter.toLowerCase())
    );
  }, [technicians, selectedZoneFilter]);

  // Helper to test if a technician is on-duty at a specific hour `h` (0 <= h < 24)
  const isTechOnDutyAtHour = (tech: Technician, h: number): boolean => {
    const start = tech.shiftStartHour ?? 6.0;
    const end = tech.shiftEndHour ?? 14.5;
    if (start < end) {
      // Standard shift (e.g. 06:00 to 14:30)
      return h >= start && h < end;
    } else {
      // Overnight shift spanning midnight (e.g. 22:00 to 06:30)
      return h >= start || h < end;
    }
  };

  // Compute 24-hour hourly staffing distribution (0 to 23)
  const hourlyStaffing = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => {
      const activeTechs = technicians.filter((t) => isTechOnDutyAtHour(t, h));
      const activeCount = activeTechs.length;

      // Classify coverage level
      let status: 'critical_gap' | 'low_coverage' | 'optimal' | 'overlap_peak';
      if (activeCount === 0) {
        status = 'critical_gap';
      } else if (activeCount <= 1) {
        status = 'low_coverage';
      } else if (activeCount >= 5) {
        status = 'overlap_peak';
      } else {
        status = 'optimal';
      }

      return {
        hour: h,
        count: activeCount,
        status,
        techs: activeTechs,
      };
    });
    return hours;
  }, [technicians]);

  // Detected Shift Overlaps
  const shiftOverlaps = useMemo(() => {
    return [
      {
        id: 'overlap-morning-afternoon',
        title: 'Morning ➔ Afternoon Shift Handover',
        timeWindow: '14:00 - 14:30',
        startHour: 14.0,
        endHour: 14.5,
        durationMin: 30,
        incomingShift: 'Afternoon Shift (14:00 - 22:30)',
        outgoingShift: 'Morning Shift (06:00 - 14:30)',
        staffCount: technicians.filter((t) => isTechOnDutyAtHour(t, 14.25)).length,
        briefingFocus: 'High-speed sorter conveyor load balance & putaway backlog review',
        checklist: [
          'Conveyor drive temperature telemetry briefing',
          'Active work order status transfer (WO-4115, WO-4122)',
          'LiDAR barcode tunnel optical calibration confirmation',
        ],
        status: 'Optimal 30m Overlap Window',
      },
      {
        id: 'overlap-afternoon-night',
        title: 'Afternoon ➔ Night Graveyard Handover',
        timeWindow: '22:00 - 22:30',
        startHour: 22.0,
        endHour: 22.5,
        durationMin: 30,
        incomingShift: 'Night Shift (22:00 - 06:30)',
        outgoingShift: 'Afternoon Shift (14:00 - 22:30)',
        staffCount: technicians.filter((t) => isTechOnDutyAtHour(t, 22.25)).length,
        briefingFocus: 'End-of-day pallet buffer clearing & scheduled PM overnight tasks',
        checklist: [
          'Safety LOTO lock verification for gantry tensioning',
          'Emergency response channel frequency check (CH-08)',
          'Overnight automated AMR battery recharging schedule',
        ],
        status: 'Optimal 30m Overlap Window',
      },
      {
        id: 'overlap-night-morning',
        title: 'Night Graveyard ➔ Morning Shift Handover',
        timeWindow: '06:00 - 06:30',
        startHour: 6.0,
        endHour: 6.5,
        durationMin: 30,
        incomingShift: 'Morning Shift (06:00 - 14:30)',
        outgoingShift: 'Night Shift (22:00 - 06:30)',
        staffCount: technicians.filter((t) => isTechOnDutyAtHour(t, 6.25)).length,
        briefingFocus: 'Facility startup check, emergency faults overnight & pre-shift audit',
        checklist: [
          'Overnight AMR fault log review',
          'Dock 04 hydraulic HPU pressure check',
          'Pre-shift tool sign-out & radio check-in',
        ],
        status: 'Optimal 30m Overlap Window',
      },
    ];
  }, [technicians]);

  // Detected Coverage Gaps
  const coverageGaps = useMemo(() => {
    const gaps: {
      id: string;
      title: string;
      timeWindow: string;
      startHour: number;
      endHour: number;
      severity: 'high' | 'medium' | 'critical';
      currentHeadcount: number;
      minRequiredHeadcount: number;
      impactDescription: string;
      recommendedAction: string;
      affectedStations: string[];
    }[] = [];

    // Deep Night low coverage: 00:00 to 06:00
    const deepNightStaff = hourlyStaffing.slice(0, 6).reduce((min, h) => Math.min(min, h.count), 99);
    if (deepNightStaff <= 1) {
      gaps.push({
        id: 'gap-deep-night',
        title: 'Deep Night Single-Tech Coverage Risk',
        timeWindow: '00:00 - 06:00',
        startHour: 0.0,
        endHour: 6.0,
        severity: 'high',
        currentHeadcount: deepNightStaff,
        minRequiredHeadcount: 2,
        impactDescription:
          'Only 1 certified technician on-duty (Kenji Sato). Single point of failure for conveyor breakdowns, AMR fleet stalls, or high-bay stacker errors.',
        recommendedAction:
          'Dispatch On-Call Relief or cross-train night dock supervisor for emergency LOTO response.',
        affectedStations: [
          'Zone B - AMR Fleet Staging',
          'Zone A - Palletizing Station',
          'Logistics Dock 04',
        ],
      });
    }

    // Evening Graveyard Buffer: 22:30 to 24:00
    const eveningStaff = hourlyStaffing.slice(23, 24).reduce((min, h) => Math.min(min, h.count), 99);
    if (eveningStaff <= 1) {
      gaps.push({
        id: 'gap-evening-buffer',
        title: 'Late Evening Shift Transition Void',
        timeWindow: '22:30 - 24:00',
        startHour: 22.5,
        endHour: 24.0,
        severity: 'medium',
        currentHeadcount: eveningStaff,
        minRequiredHeadcount: 2,
        impactDescription:
          'Afternoon technicians clock out at 22:30. Solo technician covers inbound truck receiving and automated sorter simultaneously.',
        recommendedAction: 'Extend Afternoon shift by 1.0h or assign standby backup.',
        affectedStations: ['Zone C - Sorter Conveyor', 'Quality Assurance & GRN'],
      });
    }

    return gaps;
  }, [hourlyStaffing]);

  // Handle Quick Resolve Gap (e.g. Schedule standby relief)
  const handleResolveGap = (gapId: string) => {
    soundFx.playSuccess();
    if (gapId === 'gap-deep-night') {
      setGapResolutionToast(
        'Standby Relief Dispatched! Tech Elena Rostova placed on priority call-in schedule for 01:00 - 05:00.'
      );
    } else {
      setGapResolutionToast(
        'Shift Extended! Mateo Rossi approved for +1.5h shift extension covering 22:30 - 24:00.'
      );
      // Adjust Mateo Rossi shiftEndHour to 24.0
      setTechnicians((prev) =>
        prev.map((t) => (t.id === 'tech-08' ? { ...t, shiftEndHour: 24.0, shiftHoursLogged: 3.5 } : t))
      );
    }
    setTimeout(() => {
      setGapResolutionToast(null);
    }, 5000);
  };

  // Convert hour value (0 to 24) to percentage on timeline (0% to 100%)
  const hourToPct = (h: number) => {
    return Math.max(0, Math.min(100, (h / 24) * 100));
  };

  // Helper to format hour decimal (e.g. 14.5 -> "14:30")
  const formatHourDecimal = (h: number) => {
    const whole = Math.floor(h);
    const mins = Math.round((h - whole) * 60);
    return `${whole.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-lg space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Clock className="w-4 h-4" />
            </span>
            <h3 className="text-base font-mono font-bold text-white tracking-wide">
              24-HOUR SHIFT TIMELINE &amp; COVERAGE GAP RADAR
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              CYCLE: 00:00 - 24:00
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400">
            Real-time shift distribution, overlap handover intervals, and automated coverage gap detection across all 24 hours.
          </p>
        </div>

        {/* Legend Pips */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80 border border-blue-400" />
            <span>Shift Span</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/60 border border-cyan-300" />
            <span>Handover Overlap (30m)</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/60 border border-rose-400" />
            <span>Coverage Gap (&le;1 Tech)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Current Time (10:45)</span>
          </div>
        </div>
      </div>

      {/* Gap Resolution Toast */}
      {gapResolutionToast && (
        <div className="bg-gradient-to-r from-emerald-950/90 to-cyan-950/90 border border-emerald-500/50 p-3 rounded-xl flex items-center justify-between text-emerald-200 font-mono text-xs shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{gapResolutionToast}</span>
          </div>
          <button
            onClick={() => setGapResolutionToast(null)}
            className="text-slate-400 hover:text-white text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Section: Key Analytical Metrics for Shifts & Gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Identified Gaps Card */}
        <div
          className={`rounded-xl p-3 border font-mono ${
            coverageGaps.length > 0
              ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
              : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-bold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              DETECTED COVERAGE GAPS
            </span>
            <span className="px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300 text-[10px] font-bold">
              {coverageGaps.length} VULNERABILITY WINDOWS
            </span>
          </div>
          <div className="text-xl font-bold text-white mb-0.5">
            {coverageGaps.length > 0 ? '7.5 Hours Low Coverage' : 'Zero Coverage Gaps'}
          </div>
          <p className="text-[10px] text-slate-400">
            Deep night (00:00 - 06:00) &amp; late evening (22:30 - 24:00) risk
          </p>
        </div>

        {/* Handover Overlaps Card */}
        <div className="bg-cyan-950/30 rounded-xl p-3 border border-cyan-800/70 font-mono text-cyan-200">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-bold flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              SHIFT OVERLAP HANDOVERS
            </span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300 text-[10px] font-bold">
              3 SCHEDULED WINDOWS
            </span>
          </div>
          <div className="text-xl font-bold text-white mb-0.5">90 Minutes Overlap</div>
          <p className="text-[10px] text-slate-400">
            30m handovers at 06:00, 14:00, and 22:00
          </p>
        </div>

        {/* Active Peak Headcount */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 font-mono text-slate-300">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              PEAK CONCURRENCY
            </span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              PEAK: 14:00 - 14:30
            </span>
          </div>
          <div className="text-xl font-bold text-white mb-0.5">7 Technicians Concurrently</div>
          <p className="text-[10px] text-slate-400">
            Morning + Afternoon crossover window
          </p>
        </div>
      </div>

      {/* Main 24-Hour Visual Timeline Canvas / Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 font-bold text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            24-HOUR GANTT SCHEDULE &amp; STAFFING DISTRIBUTION
          </span>
          <span className="text-[11px]">Click or hover timeline to inspect hourly staffing</span>
        </div>

        {/* Timeline Container */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-4 overflow-x-auto min-w-[720px]">
          {/* 1. Time Axis Header with Hour Markers & Day/Night bands */}
          <div className="relative pt-6 pb-2">
            {/* Background Band Shading: Night (00-06), Day (06-18), Evening (18-22), Night (22-24) */}
            <div className="absolute inset-0 top-6 bottom-0 flex opacity-20 pointer-events-none rounded-lg overflow-hidden">
              <div style={{ width: `${hourToPct(6)}%` }} className="bg-indigo-900 border-r border-slate-700" />
              <div style={{ width: `${hourToPct(12)}%` }} className="bg-sky-700 border-r border-slate-700" />
              <div style={{ width: `${hourToPct(4)}%` }} className="bg-amber-800 border-r border-slate-700" />
              <div style={{ width: `${hourToPct(2)}%` }} className="bg-indigo-900" />
            </div>

            {/* Overlap Highlights along the axis */}
            {shiftOverlaps.map((ov) => (
              <div
                key={ov.id}
                title={`${ov.title} (${ov.timeWindow})`}
                style={{
                  left: `${hourToPct(ov.startHour)}%`,
                  width: `${hourToPct(ov.endHour) - hourToPct(ov.startHour)}%`,
                }}
                className="absolute top-6 bottom-0 bg-cyan-400/20 border-x border-cyan-400/50 z-10 cursor-pointer pointer-events-none"
              />
            ))}

            {/* Coverage Gap Highlights along the axis */}
            {coverageGaps.map((gap) => (
              <div
                key={gap.id}
                title={`${gap.title} (${gap.timeWindow})`}
                style={{
                  left: `${hourToPct(gap.startHour)}%`,
                  width: `${hourToPct(gap.endHour) - hourToPct(gap.startHour)}%`,
                }}
                className="absolute top-6 bottom-0 bg-rose-500/15 border-x border-rose-500/40 z-10 pointer-events-none"
              />
            ))}

            {/* Current Time Indicator Line (10:45 AM) */}
            <div
              style={{ left: `${hourToPct(currentHour)}%` }}
              className="absolute top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none"
            >
              <span className="bg-amber-500 text-slate-950 font-mono font-bold text-[9px] px-1.5 py-0.5 rounded shadow-md whitespace-nowrap animate-pulse">
                NOW 10:45
              </span>
              <div className="w-0.5 h-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            </div>

            {/* Hour Ticks & Labels */}
            <div className="relative flex justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-1.5 z-20">
              {hourTicks.map((h) => (
                <div key={h} className="flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 mb-0.5">|</span>
                  <span className={h === 10 ? 'text-amber-300 font-bold' : ''}>
                    {h.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Hourly Staffing Density Histogram Strip */}
          <div className="space-y-1 pt-1 pb-2 border-b border-slate-800/80">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-slate-300">
                <Users className="w-3 h-3 text-cyan-400" />
                HOURLY ON-DUTY STAFF DENSITY (TARGET: &ge; 2 TECHS)
              </span>
              {hoveredHour !== null && (
                <span className="text-cyan-300 font-bold animate-in fade-in duration-100">
                  Hour {hoveredHour.toString().padStart(2, '0')}:00 &bull; {hourlyStaffing[hoveredHour].count}{' '}
                  Tech(s) on-duty
                </span>
              )}
            </div>

            {/* Density Bars */}
            <div className="grid grid-cols-24 gap-1 h-9 items-end bg-slate-900/60 p-1 rounded-lg border border-slate-800/60">
              {hourlyStaffing.map((hs) => {
                const maxStaff = 8;
                const heightPct = Math.max(15, (hs.count / maxStaff) * 100);
                const isHovered = hoveredHour === hs.hour;

                return (
                  <div
                    key={hs.hour}
                    onMouseEnter={() => setHoveredHour(hs.hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                    className="relative group h-full flex items-end cursor-pointer"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all duration-150 ${
                        hs.status === 'critical_gap'
                          ? 'bg-rose-500 animate-pulse'
                          : hs.status === 'low_coverage'
                          ? 'bg-amber-500/80 group-hover:bg-amber-400'
                          : hs.status === 'overlap_peak'
                          ? 'bg-cyan-400 group-hover:bg-cyan-300'
                          : 'bg-blue-500/80 group-hover:bg-blue-400'
                      } ${isHovered ? 'ring-2 ring-white scale-y-105' : ''}`}
                    />

                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-40 bg-slate-900 border border-slate-700 p-2 rounded-lg text-[10px] font-mono shadow-xl whitespace-nowrap pointer-events-none">
                      <div className="font-bold text-white flex items-center gap-1">
                        <span>{formatHourDecimal(hs.hour)} - {formatHourDecimal(hs.hour + 1)}</span>
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] uppercase font-bold ${
                            hs.status === 'critical_gap'
                              ? 'bg-rose-500/30 text-rose-300'
                              : hs.status === 'low_coverage'
                              ? 'bg-amber-500/30 text-amber-300'
                              : hs.status === 'overlap_peak'
                              ? 'bg-cyan-500/30 text-cyan-300'
                              : 'bg-blue-500/30 text-blue-300'
                          }`}
                        >
                          {hs.count} Techs ({hs.status.replace('_', ' ')})
                        </span>
                      </div>
                      <div className="text-slate-300 mt-1">
                        {hs.techs.length > 0 ? (
                          hs.techs.map((t) => t.name).join(', ')
                        ) : (
                          <span className="text-rose-400 font-bold">NO STAFF (CRITICAL GAP)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Per-Technician Gantt Track Rows */}
          <div className="space-y-2.5 pt-1">
            {filteredTechs.map((tech) => {
              const start = tech.shiftStartHour ?? 6.0;
              const end = tech.shiftEndHour ?? 14.5;
              const isNightSpanning = start > end;
              const isHovered = hoveredTechId === tech.id;
              const techWos = workOrders.filter((w) => w.assignedTechnician === tech.name);

              return (
                <div
                  key={tech.id}
                  onMouseEnter={() => setHoveredTechId(tech.id)}
                  onMouseLeave={() => setHoveredTechId(null)}
                  className={`relative flex items-center group transition-colors rounded-xl p-1.5 ${
                    isHovered ? 'bg-slate-900/90' : 'hover:bg-slate-900/50'
                  }`}
                >
                  {/* Left Tech Metadata Column (Width: 220px fixed) */}
                  <div className="w-56 shrink-0 flex items-center gap-2 pr-3 font-mono">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm"
                      style={{ backgroundColor: tech.avatarColor }}
                    >
                      {tech.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300">
                          {tech.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{tech.shift.split('(')[0].trim()}</p>
                    </div>
                  </div>

                  {/* Right 24h Timeline Gantt Bar Track */}
                  <div className="relative flex-1 h-8 bg-slate-900/40 rounded-lg border border-slate-800/80 overflow-hidden">
                    {/* Shift Bar rendering */}
                    {!isNightSpanning ? (
                      // Single contiguous bar (e.g. 06:00 to 14:30)
                      <div
                        style={{
                          left: `${hourToPct(start)}%`,
                          width: `${hourToPct(end) - hourToPct(start)}%`,
                        }}
                        className={`absolute top-1 bottom-1 rounded-md border flex items-center justify-between px-2 text-[10px] font-mono text-white shadow-sm transition-all ${
                          tech.shift.includes('Morning')
                            ? 'bg-gradient-to-r from-blue-600/90 to-cyan-600/90 border-cyan-400/50'
                            : tech.shift.includes('Afternoon')
                            ? 'bg-gradient-to-r from-indigo-600/90 to-purple-600/90 border-purple-400/50'
                            : 'bg-gradient-to-r from-teal-600/90 to-emerald-600/90 border-teal-400/50'
                        }`}
                      >
                        <span className="font-bold truncate text-[10px]">
                          {formatHourDecimal(start)} - {formatHourDecimal(end)}
                        </span>

                        {/* Active Work Order Chips inside the shift bar */}
                        {techWos.length > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950/70 border border-white/20 text-cyan-200 font-bold shrink-0">
                            {techWos.length} WO ({techWos[0].assetCode})
                          </span>
                        )}
                      </div>
                    ) : (
                      // Night Shift Spanning Midnight (Two segments: start to 24, 0 to end)
                      <>
                        {/* Segment 1: start to 24.0 (e.g. 22:00 to 24:00) */}
                        <div
                          style={{
                            left: `${hourToPct(start)}%`,
                            width: `${hourToPct(24) - hourToPct(start)}%`,
                          }}
                          className="absolute top-1 bottom-1 rounded-l-md border-y border-l bg-gradient-to-r from-teal-600/90 to-emerald-600/90 border-teal-400/50 flex items-center px-2 text-[10px] font-mono text-white shadow-sm"
                        >
                          <span className="font-bold truncate text-[10px]">{formatHourDecimal(start)} &rarr; 24:00</span>
                        </div>
                        {/* Segment 2: 0.0 to end (e.g. 00:00 to 06:30) */}
                        <div
                          style={{
                            left: '0%',
                            width: `${hourToPct(end)}%`,
                          }}
                          className="absolute top-1 bottom-1 rounded-r-md border-y border-r bg-gradient-to-r from-emerald-600/90 to-teal-600/90 border-teal-400/50 flex items-center justify-between px-2 text-[10px] font-mono text-white shadow-sm"
                        >
                          <span className="font-bold truncate text-[10px]">00:00 &rarr; {formatHourDecimal(end)}</span>
                          {techWos.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950/70 border border-white/20 text-cyan-200 font-bold shrink-0">
                              {techWos.length} WO
                            </span>
                          )}
                        </div>
                      </>
                    )}

                    {/* Current Time Marker on this track */}
                    <div
                      style={{ left: `${hourToPct(currentHour)}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-20"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Dual Column for Overlaps & Coverage Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
        {/* Left Column: Shift Overlaps & Handover Protocols */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Users className="w-3.5 h-3.5" />
              </span>
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wide">
                Shift Overlap Windows (Handover Protocol)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">
              30-Minute Continuity Overlaps
            </span>
          </div>

          <div className="space-y-2.5">
            {shiftOverlaps.map((ov) => {
              const isSelected = selectedOverlapId === ov.id;
              return (
                <div
                  key={ov.id}
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedOverlapId(isSelected ? null : ov.id);
                  }}
                  className={`p-3 rounded-xl border font-mono cursor-pointer transition-all space-y-2 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-cyan-300">{ov.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                          {ov.timeWindow}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>{ov.outgoingShift.split('(')[0]}</span>
                        <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>{ov.incomingShift.split('(')[0]}</span>
                      </p>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold whitespace-nowrap">
                      {ov.staffCount} Techs Active
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                    <strong className="text-cyan-300">Briefing Objective:</strong> {ov.briefingFocus}
                  </p>

                  {/* Expandable Checklist Details */}
                  {isSelected && (
                    <div className="pt-2 border-t border-slate-800 space-y-1.5 animate-in fade-in duration-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Mandatory Handover Checklist:
                      </span>
                      <div className="space-y-1">
                        {ov.checklist.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Identified Coverage Gaps & Actionable Mitigation */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wide">
                Coverage Gaps &amp; Vulnerability Radar
              </h4>
            </div>
            <span className="text-[10px] font-mono text-rose-400 font-bold">
              {coverageGaps.length} Action Items
            </span>
          </div>

          <div className="space-y-3">
            {coverageGaps.map((gap) => (
              <div
                key={gap.id}
                className="bg-slate-900/80 rounded-xl p-3.5 border border-rose-900/60 font-mono space-y-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-300">{gap.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold uppercase">
                        {gap.severity} Risk
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                      Vulnerability Window: <strong className="text-white">{gap.timeWindow}</strong> (
                      {gap.currentHeadcount} Tech on duty vs {gap.minRequiredHeadcount} required)
                    </span>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleResolveGap(gap.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_10px_rgba(244,63,94,0.3)] active:scale-95 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Plug Gap</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  {gap.impactDescription}
                </p>

                {/* Affected Stations */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400">Exposed Stations:</span>
                  {gap.affectedStations.map((st) => (
                    <span
                      key={st}
                      className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-200 border border-rose-800/60"
                    >
                      {st}
                    </span>
                  ))}
                </div>

                {/* Mitigation Recommendation */}
                <div className="text-[10px] text-amber-300/90 flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Recommendation: {gap.recommendedAction}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
