/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  AMRUnit, 
  RoboticArmUnit, 
  ConveyorUnit, 
  LoadingDockUnit, 
  Asset, 
  AssetStatus 
} from '../types';
import { soundFx } from '../utils/audio';
import { 
  Play, 
  Pause, 
  FastForward, 
  RotateCcw, 
  Layers, 
  Radio, 
  Flame, 
  Crosshair, 
  Maximize2, 
  ShieldAlert, 
  Activity,
  Zap,
  QrCode
} from 'lucide-react';

interface WarehouseCanvasProps {
  amrs: AMRUnit[];
  setAmrs: React.Dispatch<React.SetStateAction<AMRUnit[]>>;
  roboticArms: RoboticArmUnit[];
  setRoboticArms: React.Dispatch<React.SetStateAction<RoboticArmUnit[]>>;
  conveyor: ConveyorUnit;
  setConveyor: React.Dispatch<React.SetStateAction<ConveyorUnit>>;
  docks: LoadingDockUnit[];
  setDocks: React.Dispatch<React.SetStateAction<LoadingDockUnit[]>>;
  selectedAsset: Asset | null;
  onSelectAsset: (asset: Asset | null) => void;
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  onTriggerFault: (assetId: string) => void;
  onOpenQRScanner?: () => void;
}

// Particle stream type for glowing IoT telemetry ribbons
interface TelemetryParticle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  hue: number;
  size: number;
  sourceId: string;
}

// Conveyor moving package type
interface ConveyorPackage {
  id: string;
  progress: number; // 0 to 1 along conveyor path
  type: 'box' | 'tote';
  color: string;
  label: string;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  amrs,
  setAmrs,
  roboticArms,
  setRoboticArms,
  conveyor,
  setConveyor,
  docks,
  setDocks,
  selectedAsset,
  onSelectAsset,
  simulationSpeed,
  setSimulationSpeed,
  isPaused,
  setIsPaused,
  onTriggerFault,
  onOpenQRScanner,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Overlay layer controls
  const [showTelemetryStreams, setShowTelemetryStreams] = useState(true);
  const [showGuideLanes, setShowGuideLanes] = useState(true);
  const [showThermalOverlay, setShowThermalOverlay] = useState(true);
  const [showScannerBeams, setShowScannerBeams] = useState(true);
  const [hoveredAsset, setHoveredAsset] = useState<Asset | null>(null);
  const [cameraView, setCameraView] = useState<'overview' | 'robots' | 'conveyor' | 'docks'>('overview');

  // Real-time thermal load fleet statistics for FLIR HUD
  const thermalStats = React.useMemo(() => {
    const allTemps: { code: string; temp: number }[] = [
      { code: conveyor.code, temp: conveyor.vitals.temperatureC },
      ...roboticArms.map((a) => ({ code: a.code, temp: a.vitals.temperatureC })),
      ...amrs.map((a) => ({ code: a.code, temp: a.vitals.temperatureC })),
    ];
    let peak = allTemps[0] || { code: 'WHS-01', temp: 35.0 };
    let sum = 0;
    allTemps.forEach((t) => {
      sum += t.temp;
      if (t.temp > peak.temp) peak = t;
    });
    return {
      maxTemp: peak.temp,
      maxCode: peak.code,
      avgTemp: allTemps.length ? sum / allTemps.length : 35.0,
    };
  }, [conveyor, roboticArms, amrs]);

  // Animation refs
  const animFrameId = useRef<number | null>(null);
  const telemetryParticles = useRef<TelemetryParticle[]>([]);
  const conveyorPackages = useRef<ConveyorPackage[]>([
    { id: 'p1', progress: 0.1, type: 'box', color: '#e0a96d', label: 'SKU-091' },
    { id: 'p2', progress: 0.35, type: 'box', color: '#ca8a04', label: 'SKU-442' },
    { id: 'p3', progress: 0.6, type: 'tote', color: '#3b82f6', label: 'TOT-180' },
    { id: 'p4', progress: 0.85, type: 'box', color: '#e0a96d', label: 'SKU-771' },
  ]);
  const conveyorRollerAngle = useRef(0);
  const scannerFlashTimer = useRef(0);
  const armAnimTick = useRef(0);

  // Camera transform
  const camera = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    zoom: 1,
    targetZoom: 1,
  });

  // Adjust camera preset
  const applyCameraPreset = (preset: 'overview' | 'robots' | 'conveyor' | 'docks') => {
    setCameraView(preset);
    soundFx.playClick();
    if (preset === 'overview') {
      camera.current.targetX = 0;
      camera.current.targetY = 0;
      camera.current.targetZoom = 1;
    } else if (preset === 'robots') {
      camera.current.targetX = 240;
      camera.current.targetY = 100;
      camera.current.targetZoom = 1.35;
    } else if (preset === 'conveyor') {
      camera.current.targetX = -120;
      camera.current.targetY = -80;
      camera.current.targetZoom = 1.3;
    } else if (preset === 'docks') {
      camera.current.targetX = -320;
      camera.current.targetY = 0;
      camera.current.targetZoom = 1.25;
    }
  };

  // Main simulation and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const width = canvas.width;
      const height = canvas.height;

      // Smooth camera interpolation
      camera.current.x += (camera.current.targetX - camera.current.x) * 0.08;
      camera.current.y += (camera.current.targetY - camera.current.y) * 0.08;
      camera.current.zoom += (camera.current.targetZoom - camera.current.zoom) * 0.08;

      // Update simulation physics if not paused
      if (!isPaused) {
        const speedMultiplier = simulationSpeed;

        // 1. Update AMRs along waypoints
        setAmrs((prev) =>
          prev.map((amr) => {
            if (amr.status === 'critical' || amr.state === 'stopped') {
              return amr; // Halted due to fault
            }

            const currentTarget = amr.waypoints[amr.routeStep];
            const dx = currentTarget.x - amr.x;
            const dy = currentTarget.y - amr.y;
            const dist = Math.hypot(dx, dy);

            let newX = amr.x;
            let newY = amr.y;
            let newRotation = amr.rotation;
            let newStep = amr.routeStep;
            const speed = (amr.vitals.speedMps || 1.2) * 45 * speedMultiplier * dt;

            if (dist < 8) {
              // Next waypoint
              newStep = (amr.routeStep + 1) % amr.waypoints.length;
            } else {
              const angle = Math.atan2(dy, dx);
              // Smooth rotation towards travel angle
              let angleDiff = angle - amr.rotation;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              newRotation += angleDiff * Math.min(8 * dt * speedMultiplier, 1);

              newX += Math.cos(newRotation) * Math.min(speed, dist);
              newY += Math.sin(newRotation) * Math.min(speed, dist);
            }

            return {
              ...amr,
              x: newX,
              y: newY,
              rotation: newRotation,
              routeStep: newStep,
            };
          })
        );

        // 2. Update Robotic Arms cycle
        armAnimTick.current += dt * speedMultiplier;
        setRoboticArms((prev) =>
          prev.map((arm, index) => {
            if (arm.status === 'critical') return arm;

            const t = armAnimTick.current * 0.8 + index * Math.PI;
            // Articulated joint kinematics
            const j1 = Math.sin(t) * 0.45;
            const j2 = 0.6 + Math.cos(t * 0.9) * 0.35;
            const j3 = -0.3 + Math.sin(t * 1.1) * 0.25;

            // Pick cycle box presence
            const boxPresent = Math.sin(t) > -0.2;

            return {
              ...arm,
              joint1Angle: j1,
              joint2Angle: j2,
              joint3Angle: j3,
              carryingBox: boxPresent,
              gripperState: boxPresent ? 'holding' : 'open',
            };
          })
        );

        // 3. Update Conveyor Belt Rollers and Packages
        if (conveyor.rollersActive && conveyor.status !== 'critical') {
          conveyorRollerAngle.current = (conveyorRollerAngle.current + 5 * speedMultiplier) % 360;

          // Move packages along conveyor path
          conveyorPackages.current.forEach((pkg) => {
            pkg.progress = (pkg.progress + 0.04 * speedMultiplier * dt) % 1;
            // Trigger scanner optical flash around progress 0.48 - 0.52
            if (pkg.progress >= 0.49 && pkg.progress <= 0.51) {
              scannerFlashTimer.current = 0.15;
              soundFx.playScanBeep();
              // Increment scanned count
              setConveyor((c) => ({
                ...c,
                packagesScannedCount: c.packagesScannedCount + 1,
                lastScannedBarcode: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
              }));
            }
          });
        }

        if (scannerFlashTimer.current > 0) {
          scannerFlashTimer.current = Math.max(0, scannerFlashTimer.current - dt);
        }

        // 4. Update Dock loading progress
        setDocks((prev) =>
          prev.map((dock) => {
            if (!dock.truckPresent) return dock;
            const increment = (dt * speedMultiplier * 0.8);
            let nextPct = dock.progressPct + increment;
            if (nextPct >= 100) {
              nextPct = 12; // New truck cycle
            }
            return {
              ...dock,
              progressPct: nextPct,
              processedPallets: Math.floor((nextPct / 100) * dock.totalPallets),
            };
          })
        );

        // 5. Update Telemetry Particles
        if (showTelemetryStreams) {
          // Spawn new particles occasionally
          if (Math.random() < 0.35 * speedMultiplier) {
            // Pick an asset source
            const allSources: { id: string; x: number; y: number }[] = [
              ...amrs.map((a) => ({ id: a.id, x: a.x, y: a.y })),
              ...roboticArms.map((a) => ({ id: a.id, x: a.baseX, y: a.baseY })),
              { id: 'conv-01', x: 680, y: 260 },
              { id: 'dock-04', x: 880, y: 160 },
              { id: 'dock-05', x: 880, y: 320 },
            ];
            const src = allSources[Math.floor(Math.random() * allSources.length)];
            // Target is bottom-left / center operator tablet location
            telemetryParticles.current.push({
              startX: src.x,
              startY: src.y,
              targetX: 280,
              targetY: 580,
              progress: 0,
              speed: 0.4 + Math.random() * 0.4,
              hue: src.id.includes('arm') ? 175 : src.id.includes('conv') ? 190 : 160,
              size: 2.5 + Math.random() * 2,
              sourceId: src.id,
            });
          }

          // Advance particles
          telemetryParticles.current.forEach((p) => {
            p.progress += p.speed * dt * speedMultiplier;
          });
          telemetryParticles.current = telemetryParticles.current.filter((p) => p.progress <= 1);
        }
      }

      // ================= CLEAR & DRAW CANVAS =================
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Warehouse industrial floor background
      const floorGrad = ctx.createLinearGradient(0, 0, width, height);
      floorGrad.addColorStop(0, '#0f172a'); // deep navy slate
      floorGrad.addColorStop(0.5, '#1e293b'); // industrial warehouse grey
      floorGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 0, width, height);

      // Apply camera view transform
      ctx.translate(width / 2, height / 2);
      ctx.scale(camera.current.zoom, camera.current.zoom);
      ctx.translate(-width / 2 + camera.current.x, -height / 2 + camera.current.y);

      // 1. Draw Architectural Floor Grid & Safety Zones
      drawFloorGrid(ctx, width, height);

      // 2. Draw Floor Laser Guidance Lanes for AMRs
      if (showGuideLanes) {
        drawGuideLanes(ctx, amrs);
      }

      // 3. Draw High-Bay Multi-Tier Pallet Racks (Left Wall)
      drawPalletRacks(ctx, 40, 60, 200, 480);

      // 4. Draw Linear Rail and Robotic Arms
      drawRoboticArmSystem(ctx, roboticArms, selectedAsset, hoveredAsset);

      // 5. Draw High-Speed Roller Conveyor & Scanner Arch
      drawConveyorSystem(
        ctx,
        conveyor,
        conveyorPackages.current,
        conveyorRollerAngle.current,
        scannerFlashTimer.current > 0,
        showScannerBeams,
        selectedAsset,
        hoveredAsset
      );

      // 6. Draw Loading Dock Bays (Right Wall) with Semi-Trailers
      drawLoadingDocks(ctx, docks, selectedAsset, hoveredAsset);

      // 7. Draw Autonomous Mobile Robots (AMRs)
      drawAMRs(ctx, amrs, selectedAsset, hoveredAsset);

      // 8. Draw Human Maintenance Technicians in High-Vis Gear
      drawTechnicians(ctx);

      // 9. Draw Glowing IoT Telemetry Particle Streams
      if (showTelemetryStreams) {
        drawTelemetryStreams(ctx, telemetryParticles.current);
      }

      // 10. Thermal Heatmap sensor layer
      if (showThermalOverlay) {
        drawThermalLoadHeatmap(ctx, amrs, roboticArms, conveyor, docks, time / 1000);
      }

      // 11. Draw Foreground Operator Holding Tablet Silhouette (direct homage to user image)
      drawOperatorForeground(ctx, width, height);

      ctx.restore();

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [
    isPaused,
    simulationSpeed,
    showTelemetryStreams,
    showGuideLanes,
    showThermalOverlay,
    showScannerBeams,
    amrs,
    roboticArms,
    conveyor,
    docks,
    selectedAsset,
    hoveredAsset,
  ]);

  // Resize canvas to match display container
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Handle canvas mouse move for interactive hover inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Invert camera transform to find world coordinates
    const midX = canvas.width / 2;
    const midY = canvas.height / 2;
    const worldX = (rawX - midX) / camera.current.zoom + midX - camera.current.x;
    const worldY = (rawY - midY) / camera.current.zoom + midY - camera.current.y;

    // Check hit on AMRs (radius ~30px)
    for (const amr of amrs) {
      if (Math.hypot(worldX - amr.x, worldY - amr.y) < 36) {
        setHoveredAsset(amr);
        return;
      }
    }

    // Check hit on Robotic Arms
    for (const arm of roboticArms) {
      if (Math.hypot(worldX - arm.baseX, worldY - arm.baseY) < 45) {
        setHoveredAsset(arm);
        return;
      }
    }

    // Check hit on Conveyor (bounding box around conveyor loop)
    if (worldX >= 530 && worldX <= 760 && worldY >= 140 && worldY <= 380) {
      setHoveredAsset(conveyor);
      return;
    }

    // Check hit on Docks
    for (const dock of docks) {
      const dockY = dock.dockNumber === 4 ? 130 : 320;
      if (worldX >= 840 && worldX <= 1040 && worldY >= dockY - 60 && worldY <= dockY + 70) {
        setHoveredAsset(dock);
        return;
      }
    }

    setHoveredAsset(null);
  };

  // Handle canvas click to select an asset
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredAsset) {
      soundFx.playClick();
      onSelectAsset(hoveredAsset);
    } else {
      onSelectAsset(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[580px] lg:h-[640px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none"
    >
      {/* 2.5D Interactive WebGL/Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Top Left HUD: Facility Status & Camera Presets */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" />
          <span className="font-mono text-xs uppercase tracking-wider text-slate-200 font-bold">
            FACILITY 07 DIGITAL TWIN
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            60 FPS LIVE
          </span>
        </div>

        {/* Camera Preset Toolbar */}
        <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-md pointer-events-auto">
          <button
            onClick={() => applyCameraPreset('overview')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all font-medium ${
              cameraView === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => applyCameraPreset('robots')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all font-medium ${
              cameraView === 'robots'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Robotic Arms
          </button>
          <button
            onClick={() => applyCameraPreset('conveyor')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all font-medium ${
              cameraView === 'conveyor'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Conveyor
          </button>
          <button
            onClick={() => applyCameraPreset('docks')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all font-medium ${
              cameraView === 'docks'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Logistics Docks
          </button>
        </div>
      </div>

      {/* Top Right: Layer Toggles & Fault Simulation Button */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {/* Layer Controls */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-lg">
          <button
            title="Toggle IoT Telemetry Streams"
            onClick={() => {
              setShowTelemetryStreams(!showTelemetryStreams);
              soundFx.playClick();
            }}
            className={`p-1.5 rounded-lg text-xs font-mono flex items-center gap-1 transition-all ${
              showTelemetryStreams
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Telemetry</span>
          </button>

          <button
            title="Toggle AMR Floor Guide Lanes"
            onClick={() => {
              setShowGuideLanes(!showGuideLanes);
              soundFx.playClick();
            }}
            className={`p-1.5 rounded-lg text-xs font-mono flex items-center gap-1 transition-all ${
              showGuideLanes
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tracks</span>
          </button>

          <button
            title="Toggle Real-Time Thermal Load Heatmap"
            onClick={() => {
              setShowThermalOverlay(!showThermalOverlay);
              soundFx.playClick();
            }}
            className={`p-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
              showThermalOverlay
                ? 'bg-gradient-to-r from-orange-500/25 to-amber-500/25 text-orange-200 border border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showThermalOverlay ? 'text-orange-400 animate-pulse' : ''}`} />
            <span className="hidden sm:inline font-semibold">Thermal Load</span>
            {showThermalOverlay && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping ml-0.5" />
            )}
          </button>
        </div>

        {/* Camera Optical QR Scanner Quick Action */}
        {onOpenQRScanner && (
          <button
            id="canvas-qr-scanner-btn"
            onClick={() => {
              soundFx.playClick();
              onOpenQRScanner();
            }}
            className="flex items-center gap-1.5 bg-blue-950/80 hover:bg-blue-900/90 border border-blue-500/60 text-blue-200 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] active:scale-95"
            title="Scan Asset QR Code with Camera"
          >
            <QrCode className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">QR SCANNER</span>
          </button>
        )}

        {/* Fault Simulation / Incident Injection */}
        <button
          onClick={() => {
            soundFx.playAlarm();
            // Trigger fault on conveyor or first AMR
            const targetId = conveyor.status === 'optimal' ? 'conv-01' : 'amr-01';
            onTriggerFault(targetId);
          }}
          className="flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/70 text-rose-200 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] active:scale-95"
        >
          <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
          <span>INJECT FAULT</span>
        </button>
      </div>

      {/* Bottom Center: Simulation Transport Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/80 shadow-2xl z-20">
        <button
          onClick={() => {
            setIsPaused(!isPaused);
            soundFx.playClick();
          }}
          className={`p-2 rounded-xl text-white transition-all ${
            isPaused ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
          title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
        >
          {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
        </button>

        <div className="h-5 w-px bg-slate-700 mx-1" />

        <span className="text-xs font-mono text-slate-400">Speed:</span>
        {[1, 2, 4].map((spd) => (
          <button
            key={spd}
            onClick={() => {
              setSimulationSpeed(spd);
              soundFx.playClick();
            }}
            className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all ${
              simulationSpeed === spd
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {spd}x
          </button>
        ))}

        <div className="h-5 w-px bg-slate-700 mx-1" />

        <button
          onClick={() => {
            applyCameraPreset('overview');
            setIsPaused(false);
            setSimulationSpeed(1);
            soundFx.playClick();
          }}
          title="Reset View"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Right: FLIR Thermal Load Scale & Hotspot Telemetry Card */}
      {showThermalOverlay && (
        <div className="absolute bottom-4 right-4 bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-orange-500/40 shadow-2xl z-20 w-64 sm:w-72 pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-orange-300">
              <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              <span>FLIR THERMAL LOAD</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">
              IR SPECTRUM
            </span>
          </div>

          {/* Color Gradient Scale Bar */}
          <div className="space-y-1 mb-2">
            <div className="h-2.5 w-full rounded-md bg-gradient-to-r from-blue-600 via-cyan-400 via-emerald-400 via-amber-400 via-orange-500 to-rose-600 border border-slate-700/60 shadow-inner" />
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>20°C (Cold)</span>
              <span>45°C</span>
              <span>60°C</span>
              <span className="text-rose-400 font-bold">75°C+</span>
            </div>
          </div>

          {/* Real-time Peak Hotspot & Summary Stats */}
          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex justify-between items-center bg-slate-950/70 px-2 py-1 rounded-lg border border-slate-800/80">
              <span className="text-slate-400">Peak Hotspot:</span>
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                {thermalStats.maxTemp.toFixed(1)}°C ({thermalStats.maxCode})
              </span>
            </div>
            <div className="flex justify-between text-slate-400 px-1 pt-0.5 text-[10px]">
              <span>Fleet Mean Temp:</span>
              <span className="text-cyan-400 font-semibold">{thermalStats.avgTemp.toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between text-slate-400 px-1 text-[10px]">
              <span>Telemetry Grid:</span>
              <span className="text-emerald-400 font-semibold">9 Sensors Synced</span>
            </div>
          </div>
        </div>
      )}

      {/* Hover Card Tooltip */}
      {hoveredAsset && (
        <div className="absolute top-16 left-4 bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 p-3 rounded-xl shadow-xl pointer-events-none z-30 max-w-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-white tracking-wide">
              {hoveredAsset.name}
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold uppercase ${
                hoveredAsset.status === 'optimal'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : hoveredAsset.status === 'warning'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {hoveredAsset.status}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 font-mono space-y-0.5">
            <div>Code: <span className="text-cyan-400 font-semibold">{hoveredAsset.code}</span></div>
            <div>Temp: <span className="text-slate-100">{hoveredAsset.vitals.temperatureC.toFixed(1)}°C</span></div>
            <div>Vibration: <span className="text-slate-100">{hoveredAsset.vitals.vibrationRms.toFixed(2)} mm/s</span></div>
            <div>Health Score: <span className="text-emerald-400 font-semibold">{hoveredAsset.vitals.healthScore}%</span></div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-cyan-400/80 font-mono flex items-center gap-1">
            <Crosshair className="w-3 h-3" />
            Click machine to open diagnostics
          </div>
        </div>
      )}
    </div>
  );
};

// ================= CANVAS DRAWING SUB-ROUTINES =================

function drawFloorGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)'; // slate-700 subtle grid
  ctx.lineWidth = 1;
  const gridSize = 40;

  for (let x = 0; x < width * 1.5; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height * 1.5);
    ctx.stroke();
  }
  for (let y = 0; y < height * 1.5; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width * 1.5, y);
    ctx.stroke();
  }

  // Safety Zone Yellow/Black Striped Perimeter for Robotic Arm Area
  ctx.save();
  ctx.strokeStyle = '#eab308'; // yellow
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(30, 50, 230, 480);
  ctx.restore();

  // Zone Label Watermarks
  ctx.font = '700 11px Chakra Petch, monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.fillText('ZONE A: HIGH-BAY STORAGE & RAIL GANTRY', 40, 42);
  ctx.fillText('ZONE B: AMR AUTONOMOUS TRANSIT GRID', 320, 180);
  ctx.fillText('ZONE C: HIGH-SPEED CONVEYOR & OPTICAL SCANNER', 530, 120);
  ctx.fillText('ZONE D: INBOUND / OUTBOUND LOGISTICS DOCKS', 840, 60);
  ctx.restore();
}

function drawGuideLanes(ctx: CanvasRenderingContext2D, amrs: AMRUnit[]) {
  ctx.save();
  // Pre-mapped floor guide lines
  const lanes = [
    [
      { x: 420, y: 380 },
      { x: 420, y: 260 },
      { x: 540, y: 260 },
      { x: 540, y: 440 },
      { x: 380, y: 440 },
      { x: 380, y: 380 },
    ],
    [
      { x: 640, y: 440 },
      { x: 640, y: 520 },
      { x: 480, y: 520 },
      { x: 480, y: 440 },
      { x: 640, y: 440 },
    ],
    [
      { x: 340, y: 220 },
      { x: 340, y: 320 },
      { x: 460, y: 320 },
      { x: 460, y: 220 },
    ],
  ];

  lanes.forEach((lane) => {
    ctx.beginPath();
    ctx.moveTo(lane[0].x, lane[0].y);
    for (let i = 1; i < lane.length; i++) {
      ctx.lineTo(lane[i].x, lane[i].y);
    }
    ctx.closePath();

    // Glowing LED embedded strip
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)'; // emerald
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.stroke();

    // Glow halo
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.15)';
    ctx.lineWidth = 8;
    ctx.stroke();
  });

  ctx.restore();
}

function drawPalletRacks(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number
) {
  ctx.save();
  // Rack Outer Steel Frame (Blue & Orange Industrial Theme)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(rx, ry, rw, rh);

  // Upright steel columns
  ctx.fillStyle = '#1d4ed8'; // Industrial Blue Uprights
  ctx.fillRect(rx, ry, 12, rh);
  ctx.fillRect(rx + rw - 12, ry, 12, rh);

  const tiers = 5;
  const tierHeight = (rh - 20) / tiers;

  for (let i = 0; i < tiers; i++) {
    const ty = ry + 15 + i * tierHeight;

    // Orange shelf load beams
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(rx + 10, ty + tierHeight - 8, rw - 20, 8);

    // Cross-bracing diagonals
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx + 12, ty);
    ctx.lineTo(rx + rw - 12, ty + tierHeight);
    ctx.moveTo(rx + rw - 12, ty);
    ctx.lineTo(rx + 12, ty + tierHeight);
    ctx.stroke();

    // Pallets with stacked cartons
    const palletWidth = 42;
    const numPallets = 3;
    for (let p = 0; p < numPallets; p++) {
      const px = rx + 24 + p * (palletWidth + 14);
      const py = ty + tierHeight - 16;

      // Wooden pallet base
      ctx.fillStyle = '#a16207'; // wood tan
      ctx.fillRect(px, py + 2, palletWidth, 6);

      // Stacked Cartons on pallet
      ctx.fillStyle = p % 2 === 0 ? '#d97706' : '#b45309';
      ctx.fillRect(px + 3, py - 20, palletWidth - 6, 20);

      // Barcode / SKU label on box
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(px + 8, py - 14, 14, 8);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px + 10, py - 12, 10, 2);
    }
  }

  // High-Bay Rack Signboard
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(rx + 30, ry - 14, rw - 60, 18);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 30, ry - 14, rw - 60, 18);

  ctx.font = '600 10px Chakra Petch, monospace';
  ctx.fillStyle = '#60a5fa';
  ctx.textAlign = 'center';
  ctx.fillText('BAY A-01 / OCCUPANCY 91%', rx + rw / 2, ry - 2);
  ctx.restore();
}

function drawRoboticArmSystem(
  ctx: CanvasRenderingContext2D,
  arms: RoboticArmUnit[],
  selected: Asset | null,
  hovered: Asset | null
) {
  ctx.save();
  // Linear Floor Rail Track
  ctx.fillStyle = '#334155';
  ctx.fillRect(165, 80, 30, 440);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.strokeRect(165, 80, 30, 440);

  // Rail Gear Teeth
  ctx.fillStyle = '#475569';
  for (let y = 90; y < 510; y += 12) {
    ctx.fillRect(176, y, 8, 4);
  }

  // Render each Robotic Arm
  arms.forEach((arm) => {
    const isTargeted = selected?.id === arm.id || hovered?.id === arm.id;
    const isCritical = arm.status === 'critical';

    ctx.save();
    ctx.translate(arm.baseX, arm.baseY);

    // Target holographic reticle if selected/hovered
    if (isTargeted) {
      drawTargetReticle(ctx, 0, 0, 50, isCritical ? '#f43f5e' : '#38bdf8');
    }

    // Heavy Gantry Carriage Base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-22, -18, 44, 36);
    ctx.strokeStyle = isCritical ? '#f43f5e' : isTargeted ? '#38bdf8' : '#84cc16'; // safety lime
    ctx.lineWidth = 3;
    ctx.strokeRect(-22, -18, 44, 36);

    // Status Indicator Beacon on base
    ctx.fillStyle = isCritical ? '#f43f5e' : '#84cc16';
    ctx.beginPath();
    ctx.arc(0, -10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Arm Turntable Joint
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Primary Arm Segment (Lower Link)
    ctx.rotate(arm.joint1Angle);
    ctx.fillStyle = '#84cc16'; // KUKA / Industrial lime green
    ctx.fillRect(-6, -42, 12, 42);
    ctx.strokeStyle = '#3f6212';
    ctx.lineWidth = 1;
    ctx.strokeRect(-6, -42, 12, 42);

    // Elbow Joint
    ctx.translate(0, -42);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Secondary Arm Segment (Upper Link)
    ctx.rotate(arm.joint2Angle);
    ctx.fillStyle = '#a3e635';
    ctx.fillRect(-5, -36, 10, 36);

    // Wrist Joint
    ctx.translate(0, -36);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // End-Effector Gripper / Suction Tool
    ctx.rotate(arm.joint3Angle);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-8, -12, 16, 6);

    // Vacuum suction cups or gripper fingers
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10, -18, 4, 8);
    ctx.fillRect(6, -18, 4, 8);

    // Box if being carried
    if (arm.carryingBox) {
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(-12, -36, 24, 18);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-6, -30, 12, 6);
    }

    ctx.restore();
  });

  ctx.restore();
}

function drawConveyorSystem(
  ctx: CanvasRenderingContext2D,
  conv: ConveyorUnit,
  packages: ConveyorPackage[],
  rollerAngle: number,
  isScanning: boolean,
  showBeams: boolean,
  selected: Asset | null,
  hovered: Asset | null
) {
  ctx.save();
  const isTargeted = selected?.id === conv.id || hovered?.id === conv.id;
  const isCritical = conv.status === 'critical';

  // Conveyor path coordinates: from (560, 360) -> (560, 220) -> curve to (740, 220) -> (740, 360)
  const cx = 550;
  const cy = 200;
  const cw = 210;
  const ch = 180;

  if (isTargeted) {
    drawTargetReticle(ctx, cx + cw / 2, cy + ch / 2, 130, isCritical ? '#f43f5e' : '#38bdf8');
  }

  // Steel frame structure
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = isCritical ? '#f43f5e' : '#475569';
  ctx.lineWidth = 3;

  // Outer loop belt bed
  ctx.beginPath();
  ctx.roundRect(cx, cy, cw, ch, 28);
  ctx.stroke();

  // Inner cutout for modular island
  ctx.beginPath();
  ctx.roundRect(cx + 42, cy + 38, cw - 84, ch - 76, 16);
  ctx.stroke();

  // Rollers along the track
  const numRollers = 18;
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;

  for (let i = 0; i < numRollers; i++) {
    const rx = cx + 8 + i * ((cw - 16) / numRollers);
    ctx.beginPath();
    ctx.moveTo(rx, cy + 4);
    ctx.lineTo(rx, cy + 34);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rx, cy + ch - 34);
    ctx.lineTo(rx, cy + ch - 4);
    ctx.stroke();
  }

  // Optical Barcode Scanner Arch Tunnel (Stationed at cx + cw/2)
  const archX = cx + cw / 2 - 20;
  const archY = cy - 8;
  const archW = 40;
  const archH = 50;

  // Scanner Gantry Arch
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(archX, archY, archW, archH);
  ctx.strokeStyle = isScanning ? '#38bdf8' : '#0284c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(archX, archY, archW, archH);

  // Optical laser scanning beam
  if (showBeams) {
    ctx.fillStyle = isScanning
      ? 'rgba(56, 189, 248, 0.45)'
      : 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(archX + 4, archY + 12, archW - 8, 30);

    // Laser cross-line
    ctx.strokeStyle = isScanning ? '#e0f2fe' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(archX, archY + 28);
    ctx.lineTo(archX + archW, archY + 28);
    ctx.stroke();
  }

  // Status HUD tag on scanner
  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 9px Chakra Petch, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('OPTICAL SCANNER TUNNEL', archX + archW / 2, archY - 5);

  // Moving packages along the conveyor loop
  packages.forEach((pkg) => {
    // Map progress (0-1) to loop position
    let px = cx + 20;
    let py = cy + 18;

    if (pkg.progress < 0.35) {
      // Top run: left to right
      px = cx + 20 + (pkg.progress / 0.35) * (cw - 40);
      py = cy + 18;
    } else if (pkg.progress < 0.5) {
      // Right curve down
      const t = (pkg.progress - 0.35) / 0.15;
      px = cx + cw - 20;
      py = cy + 18 + t * (ch - 36);
    } else if (pkg.progress < 0.85) {
      // Bottom run: right to left
      const t = (pkg.progress - 0.5) / 0.35;
      px = cx + cw - 20 - t * (cw - 40);
      py = cy + ch - 18;
    } else {
      // Left curve up
      const t = (pkg.progress - 0.85) / 0.15;
      px = cx + 20;
      py = cy + ch - 18 - t * (ch - 36);
    }

    // Draw Package
    ctx.save();
    ctx.translate(px, py);

    if (pkg.type === 'box') {
      ctx.fillStyle = pkg.color;
      ctx.fillRect(-12, -10, 24, 20);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      ctx.strokeRect(-12, -10, 24, 20);

      // Shipping label
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -6, 12, 8);
    } else {
      // Plastic Tote
      ctx.fillStyle = pkg.color;
      ctx.fillRect(-14, -10, 28, 20);
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-14, -10, 28, 20);
    }

    ctx.restore();
  });

  ctx.restore();
}

function drawLoadingDocks(
  ctx: CanvasRenderingContext2D,
  docks: LoadingDockUnit[],
  selected: Asset | null,
  hovered: Asset | null
) {
  ctx.save();
  const dockX = 850;

  docks.forEach((dock) => {
    const isTargeted = selected?.id === dock.id || hovered?.id === dock.id;
    const isCritical = dock.status === 'critical';
    const dockY = dock.dockNumber === 4 ? 90 : 270;
    const dockW = 180;
    const dockH = 150;

    if (isTargeted) {
      drawTargetReticle(ctx, dockX + dockW / 2, dockY + dockH / 2, 100, isCritical ? '#f43f5e' : '#38bdf8');
    }

    // Industrial Roll-Up Door & Shelter Frame
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(dockX, dockY, dockW, dockH);
    ctx.strokeStyle = isCritical ? '#f43f5e' : '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(dockX, dockY, dockW, dockH);

    // Roll-up shutter slats
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let sy = dockY + 8; sy < dockY + 50; sy += 6) {
      ctx.beginPath();
      ctx.moveTo(dockX + 6, sy);
      ctx.lineTo(dockX + dockW - 6, sy);
      ctx.stroke();
    }

    // Logistics Truck Trailer (Semi-Trailer Backed Into Dock)
    if (dock.truckPresent) {
      const trailerX = dockX + 40;
      const trailerY = dockY + 30;
      const trailerW = 130;
      const trailerH = 100;

      // Trailer Body (Clean white/silver logistics livery)
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(trailerX, trailerY, trailerW, trailerH);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(trailerX, trailerY, trailerW, trailerH);

      // Carrier Branding Stripe
      ctx.fillStyle = dock.dockNumber === 4 ? '#0284c7' : '#059669';
      ctx.fillRect(trailerX, trailerY + 18, trailerW, 14);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9px Chakra Petch, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(dock.carrier.toUpperCase(), trailerX + 8, trailerY + 29);

      // Loading Progress Bar on Dock
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(dockX + 10, dockY + dockH - 24, dockW - 20, 16);
      ctx.fillStyle = dock.direction === 'inbound' ? '#38bdf8' : '#10b981';
      ctx.fillRect(
        dockX + 12,
        dockY + dockH - 22,
        ((dockW - 24) * dock.progressPct) / 100,
        12
      );

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 9px Chakra Petch, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${dock.direction.toUpperCase()} ${dock.progressPct.toFixed(0)}%`,
        dockX + dockW / 2,
        dockY + dockH - 12
      );
    }

    // Dock Number Header
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 11px Chakra Petch, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`DOCK BAY 0${dock.dockNumber}`, dockX + 10, dockY - 6);
  });

  ctx.restore();
}

function drawAMRs(
  ctx: CanvasRenderingContext2D,
  amrs: AMRUnit[],
  selected: Asset | null,
  hovered: Asset | null
) {
  ctx.save();

  amrs.forEach((amr) => {
    const isTargeted = selected?.id === amr.id || hovered?.id === amr.id;
    const isCritical = amr.status === 'critical';

    ctx.save();
    ctx.translate(amr.x, amr.y);
    ctx.rotate(amr.rotation);

    if (isTargeted) {
      drawTargetReticle(ctx, 0, 0, 38, isCritical ? '#f43f5e' : '#38bdf8');
    }

    // AMR Body Chassis (Circular / Rounded rectangular industrial design)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-24, -18, 48, 36, 12);
    ctx.fill();

    // High-visibility Lime Green or Blue bumper ring
    ctx.strokeStyle = isCritical ? '#f43f5e' : '#84cc16'; // safety lime
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 360° Safety LiDAR Ring (pulsing cyan scanner)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();

    // LiDAR center emitter
    ctx.fillStyle = isCritical ? '#f43f5e' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Directional head lights (Front headlights)
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(20, -10, 4, 6);
    ctx.fillRect(20, 4, 4, 6);

    // Rear brake/status lights
    ctx.fillStyle = isCritical ? '#f43f5e' : '#ef4444';
    ctx.fillRect(-24, -10, 3, 5);
    ctx.fillRect(-24, 5, 3, 5);

    // Top Cargo if loaded
    if (amr.carryingCargo) {
      if (amr.cargoType === 'crate') {
        ctx.fillStyle = amr.cargoColor;
        ctx.fillRect(-14, -12, 28, 24);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.strokeRect(-14, -12, 28, 24);

        // SKU tag
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -6, 12, 12);
      } else if (amr.cargoType === 'tote') {
        ctx.fillStyle = amr.cargoColor;
        ctx.fillRect(-15, -13, 30, 26);
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-15, -13, 30, 26);
      }
    }

    // Reset rotation for text label
    ctx.rotate(-amr.rotation);

    // AMR Code Label above robot
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 9px Chakra Petch, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(amr.code, 0, -26);

    // Mini battery indicator bar
    const bPct = amr.vitals.batteryPct || 90;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-12, 25, 24, 4);
    ctx.fillStyle = bPct > 30 ? '#10b981' : '#f59e0b';
    ctx.fillRect(-12, 25, (24 * bPct) / 100, 4);

    ctx.restore();
  });

  ctx.restore();
}

function drawTechnicians(ctx: CanvasRenderingContext2D) {
  ctx.save();
  // Maintenance technicians in high-vis vests and yellow hardhats
  const workers = [
    { x: 500, y: 150, name: 'M. Vance (Conveyor)' },
    { x: 260, y: 340, name: 'S. Chen (Robotics)' },
    { x: 800, y: 220, name: 'D. Kim (Dock Ops)' },
  ];

  workers.forEach((w) => {
    ctx.save();
    ctx.translate(w.x, w.y);

    // Hardhat (Yellow)
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(0, -14, 6, 0, Math.PI * 2);
    ctx.fill();

    // High-Vis Safety Vest (Fluorescent orange/lime with reflective stripe)
    ctx.fillStyle = '#f97316'; // orange vest
    ctx.beginPath();
    ctx.roundRect(-8, -8, 16, 18, 4);
    ctx.fill();

    // Silver reflective chevron stripe
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-8, -4, 16, 3);

    // Worker Name Label
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 8px Chakra Petch, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(w.name, 0, 18);

    ctx.restore();
  });

  ctx.restore();
}

function drawTelemetryStreams(ctx: CanvasRenderingContext2D, particles: TelemetryParticle[]) {
  ctx.save();

  // Draw glowing Bezier telemetry ribbons connecting machines to the operator's diagnostic tablet
  particles.forEach((p) => {
    const cpX = (p.startX + p.targetX) / 2 + Math.sin(p.progress * Math.PI) * 40;
    const cpY = (p.startY + p.targetY) / 2 - 40;

    // Quadratic bezier curve point
    const t = p.progress;
    const invT = 1 - t;
    const curX = invT * invT * p.startX + 2 * invT * t * cpX + t * t * p.targetX;
    const curY = invT * invT * p.startY + 2 * invT * t * cpY + t * t * p.targetY;

    // Glowing particle packet
    ctx.fillStyle = `hsl(${p.hue}, 100%, 75%)`;
    ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(curX, curY, p.size, 0, Math.PI * 2);
    ctx.fill();

    // Spline curve stream line
    ctx.strokeStyle = `hsla(${p.hue}, 100%, 65%, ${0.15 * (1 - p.progress)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.startX, p.startY);
    ctx.quadraticCurveTo(cpX, cpY, p.targetX, p.targetY);
    ctx.stroke();
  });

  ctx.restore();
}

function drawThermalLoadHeatmap(
  ctx: CanvasRenderingContext2D,
  amrs: AMRUnit[],
  arms: RoboticArmUnit[],
  conv: ConveyorUnit,
  docks: LoadingDockUnit[],
  timeSec: number
) {
  // Aggregate real-time telemetry hotspots from all warehouse machinery
  const spots: {
    x: number;
    y: number;
    temp: number;
    maxTemp: number;
    label: string;
    sublabel: string;
    radius: number;
    isHotspot: boolean;
  }[] = [
    // High-speed Conveyor Primary Drive Stator & Gearbox
    {
      x: 550,
      y: 240,
      temp: conv.vitals.temperatureC,
      maxTemp: conv.vitals.temperatureMax,
      label: conv.code,
      sublabel: 'Drive Stator',
      radius: 94,
      isHotspot: conv.vitals.temperatureC >= 58,
    },
    // Conveyor Return Loop Idler Bearing
    {
      x: 730,
      y: 240,
      temp: conv.vitals.temperatureC * 0.88,
      maxTemp: conv.vitals.temperatureMax,
      label: 'CNV-TAIL',
      sublabel: 'Idler Bearing',
      radius: 70,
      isHotspot: conv.vitals.temperatureC * 0.88 >= 58,
    },
    // Conveyor 6-Sided Barcode Tunnel Optics Array
    {
      x: 640,
      y: 160,
      temp: conv.vitals.temperatureC * 0.82,
      maxTemp: conv.vitals.temperatureMax,
      label: 'CNV-OPTIC',
      sublabel: 'Laser Scanner',
      radius: 58,
      isHotspot: false,
    },
    // Heavy 6-Axis Robotic Arms
    ...arms.flatMap((arm) => [
      {
        x: arm.baseX,
        y: arm.baseY,
        temp: arm.vitals.temperatureC,
        maxTemp: arm.vitals.temperatureMax,
        label: arm.code,
        sublabel: 'Base Turntable',
        radius: 78,
        isHotspot: arm.vitals.temperatureC >= 55,
      },
      {
        x: arm.baseX + Math.sin(arm.joint1Angle) * 32,
        y: arm.baseY - 28,
        temp: arm.vitals.temperatureC * 0.94,
        maxTemp: arm.vitals.temperatureMax,
        label: `${arm.code}-J2`,
        sublabel: 'Harmonic Drive',
        radius: 56,
        isHotspot: arm.vitals.temperatureC * 0.94 >= 55,
      },
    ]),
    // Autonomous Mobile Robots (AMR Powertrains & Battery Cells)
    ...amrs.map((a) => ({
      x: a.x,
      y: a.y,
      temp: a.vitals.temperatureC,
      maxTemp: a.vitals.temperatureMax,
      label: a.code,
      sublabel: `${a.name.split(' ')[0]} Pack`,
      radius: 58,
      isHotspot: a.vitals.temperatureC >= 55,
    })),
    // Logistics Loading Docks Hydraulic HPU
    ...docks.map((d) => ({
      x: 880,
      y: d.dockNumber === 4 ? 130 : 320,
      temp: 36.2,
      maxTemp: 70,
      label: d.code,
      sublabel: 'Hydraulic HPU',
      radius: 48,
      isHotspot: false,
    })),
  ];

  ctx.save();

  // PASS 1: Screen-blended false-color IR emission field (creates organic FLIR heat blending)
  ctx.globalCompositeOperation = 'screen';

  spots.forEach((s, idx) => {
    // Subtle physical thermal oscillation/breathing
    const pulse = 1 + 0.04 * Math.sin(timeSec * 2.5 + idx * 1.3);
    const r = s.radius * pulse;

    const grad = ctx.createRadialGradient(s.x, s.y, 3, s.x, s.y, r);

    if (s.temp >= 62) {
      // Critical thermal load (Crimson to Incandescent White core)
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.16, 'rgba(254, 240, 138, 0.9)');
      grad.addColorStop(0.38, 'rgba(239, 68, 68, 0.85)');
      grad.addColorStop(0.62, 'rgba(249, 115, 22, 0.55)');
      grad.addColorStop(0.82, 'rgba(234, 179, 8, 0.25)');
      grad.addColorStop(1.0, 'rgba(37, 99, 235, 0)');
    } else if (s.temp >= 50) {
      // Elevated thermal load (Hot Amber-Orange core)
      grad.addColorStop(0, 'rgba(254, 215, 170, 0.9)');
      grad.addColorStop(0.22, 'rgba(249, 115, 22, 0.8)');
      grad.addColorStop(0.48, 'rgba(234, 179, 8, 0.6)');
      grad.addColorStop(0.72, 'rgba(16, 185, 129, 0.3)');
      grad.addColorStop(1.0, 'rgba(6, 182, 212, 0)');
    } else if (s.temp >= 40) {
      // Nominal working range (Chartreuse to Emerald core)
      grad.addColorStop(0, 'rgba(217, 249, 157, 0.85)');
      grad.addColorStop(0.25, 'rgba(16, 185, 129, 0.65)');
      grad.addColorStop(0.55, 'rgba(6, 182, 212, 0.4)');
      grad.addColorStop(0.80, 'rgba(37, 99, 235, 0.2)');
      grad.addColorStop(1.0, 'rgba(15, 23, 42, 0)');
    } else {
      // Ambient cool (Teal to Deep Indigo core)
      grad.addColorStop(0, 'rgba(125, 211, 252, 0.8)');
      grad.addColorStop(0.3, 'rgba(14, 165, 233, 0.5)');
      grad.addColorStop(0.65, 'rgba(59, 130, 246, 0.3)');
      grad.addColorStop(1.0, 'rgba(15, 23, 42, 0)');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Restore normal composite mode for crisp vector overlays
  ctx.globalCompositeOperation = 'source-over';

  // PASS 2: Isothermal contours & center sensor crosshairs
  spots.forEach((s) => {
    // Isothermal boundary ring for elevated/critical components
    if (s.temp >= 48) {
      ctx.save();
      ctx.strokeStyle =
        s.temp >= 62
          ? 'rgba(254, 202, 202, 0.75)'
          : 'rgba(253, 224, 71, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();

      // Outer faint contour
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Micro crosshair at hotspot center
    ctx.save();
    ctx.strokeStyle = s.temp >= 62 ? '#fee2e2' : '#e0f2fe';
    ctx.lineWidth = 1;
    const len = 4;
    ctx.beginPath();
    ctx.moveTo(s.x - len, s.y);
    ctx.lineTo(s.x + len, s.y);
    ctx.moveTo(s.x, s.y - len);
    ctx.lineTo(s.x, s.y + len);
    ctx.stroke();
    ctx.restore();
  });

  // PASS 3: Floating Thermal Telemetry Readout Capsules
  spots.forEach((s) => {
    // Only display badge for main machine anchor points to avoid visual clutter
    if (s.sublabel === 'Harmonic Drive' || s.sublabel === 'Laser Scanner') return;

    const badgeW = 76;
    const badgeH = 20;
    const badgeX = s.x - badgeW / 2;
    const badgeY = s.y - s.radius * 0.55 - badgeH - 2;

    const isHot = s.temp >= 60;
    const isElevated = s.temp >= 50 && s.temp < 60;

    // Draw frosted capsule pill
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = isHot
      ? 'rgba(239, 68, 68, 0.95)'
      : isElevated
      ? 'rgba(245, 158, 11, 0.85)'
      : 'rgba(6, 182, 212, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = isHot
      ? 'rgba(239, 68, 68, 0.5)'
      : isElevated
      ? 'rgba(245, 158, 11, 0.35)'
      : 'rgba(6, 182, 212, 0.2)';
    ctx.shadowBlur = 6;

    // Rounded rectangle
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Hotspot flame indicator pip
    ctx.fillStyle = isHot ? '#ef4444' : isElevated ? '#f59e0b' : '#10b981';
    ctx.beginPath();
    ctx.arc(badgeX + 8, badgeY + badgeH / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Temperature text
    ctx.fillStyle = isHot ? '#fecaca' : '#ffffff';
    ctx.font = '700 10px Chakra Petch, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${s.temp.toFixed(1)}°C`, badgeX + 16, badgeY + badgeH / 2);

    // Thermal load percentage
    const loadPct = Math.round((s.temp / s.maxTemp) * 100);
    ctx.fillStyle = isHot ? '#f87171' : isElevated ? '#fbbf24' : '#67e8f9';
    ctx.font = '600 8px Chakra Petch, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${loadPct}%`, badgeX + badgeW - 6, badgeY + badgeH / 2);

    ctx.restore();
  });

  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTargetReticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Corner brackets
  ctx.setLineDash([]);
  const len = 10;
  const d = radius * 0.8;

  ctx.beginPath();
  // top-left
  ctx.moveTo(x - d, y - d + len);
  ctx.lineTo(x - d, y - d);
  ctx.lineTo(x - d + len, y - d);
  // top-right
  ctx.moveTo(x + d - len, y - d);
  ctx.lineTo(x + d, y - d);
  ctx.lineTo(x + d, y - d + len);
  // bottom-left
  ctx.moveTo(x - d, y + d - len);
  ctx.lineTo(x - d, y + d);
  ctx.lineTo(x - d + len, y + d);
  // bottom-right
  ctx.moveTo(x + d - len, y + d);
  ctx.lineTo(x + d, y + d);
  ctx.lineTo(x + d, y + d - len);
  ctx.stroke();

  ctx.restore();
}

function drawOperatorForeground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  // Artistic subtle homage to the user's reference image:
  // Shows the operator's digital tablet receiver waypoint in the lower left corner
  ctx.save();
  const tx = 280;
  const ty = 580;

  // Tablet screen glowing node
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(tx - 65, ty - 45, 130, 80, 8);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glow halo
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(tx, ty - 30, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 8px Chakra Petch, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('IoT TELEMETRY RECEIVER HUB', tx, ty - 12);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('LINKED TO SUPERVISOR TABLET', tx, ty + 2);

  // Tiny animated pulse wave
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.beginPath();
  ctx.arc(tx, ty - 30, 8 + (Date.now() % 1000) / 100, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
