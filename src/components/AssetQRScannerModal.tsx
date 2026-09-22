/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '../types';
import { soundFx } from '../utils/audio';
import { 
  Camera, 
  QrCode, 
  X, 
  RefreshCw, 
  Flashlight, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Search,
  Scan,
  ShieldCheck,
  VideoOff
} from 'lucide-react';

interface AssetQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
}

export const AssetQRScannerModal: React.FC<AssetQRScannerModalProps> = ({
  isOpen,
  onClose,
  assets,
  onSelectAsset,
}) => {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanningState, setScanningState] = useState<'searching' | 'locked' | 'detected'>('searching');
  const [matchedAsset, setMatchedAsset] = useState<Asset | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('conv-01');
  const [barcodeSearchQuery, setBarcodeSearchQuery] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stop active camera stream helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setCameraActive(false);
  };

  // Start real user webcam / back-camera if available in browser
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera MediaDevices API not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setHasCameraPermission(true);
      setCameraActive(true);
      soundFx.playClick();
    } catch (err) {
      console.warn('Direct camera feed unavailable or denied, falling back to simulated optical HUD viewfinder:', err);
      setHasCameraPermission(false);
      setCameraError('Physical camera feed restricted or unavailable. Running in High-Fidelity Optical Simulator mode.');
      setCameraActive(false);
    }
  };

  // Toggle Camera on/off
  useEffect(() => {
    if (isOpen) {
      setScanningState('searching');
      setMatchedAsset(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Flip camera facing mode
  const toggleFacingMode = () => {
    soundFx.playClick();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Toggle flash torch if track supports it
  const toggleTorch = async () => {
    soundFx.playClick();
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
      if (capabilities && capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !torchOn } as any],
          });
          setTorchOn(!torchOn);
          return;
        } catch {
          // fallback
        }
      }
    }
    setTorchOn(!torchOn);
  };

  // Handle successful QR detection / simulation
  const handleTriggerDetection = (asset: Asset) => {
    soundFx.playScanBeep();
    setScanningState('locked');
    setMatchedAsset(asset);

    setTimeout(() => {
      setScanningState('detected');
      soundFx.playSuccess();
    }, 600);
  };

  // Confirm selection and open drawer
  const handleOpenDiagnostics = () => {
    if (!matchedAsset) return;
    soundFx.playClick();
    onSelectAsset(matchedAsset);
    onClose();
  };

  // Filter presets for manual barcode entry / quick tag selection
  const filteredAssets = assets.filter((a) => {
    const q = barcodeSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.zone.toLowerCase().includes(q)
    );
  });

  const activePresetAsset = assets.find((a) => a.id === selectedPresetId) || assets[0];

  if (!isOpen) return null;

  return (
    <div 
      id="qr-scanner-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        id="qr-scanner-container"
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-mono font-bold text-white tracking-wide">
                  OPTICAL ASSET QR & RFID SCANNER
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  CV-ENGINE v4.2
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Point live camera at physical asset bar tag or select an asset badge below
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="qr-close-button"
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            
            {/* Camera Viewfinder Viewport (7 Cols on desktop) */}
            <div className="lg:col-span-7 flex flex-col space-y-2">
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
                
                {/* Live Real Video Stream */}
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  /* Optical Simulation Mode Canvas Background */
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
                    {/* Simulated warehouse backdrop elements */}
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                        <Camera className="w-8 h-8 animate-pulse text-cyan-300" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                        Virtual Optical Lens Active
                      </span>
                      <p className="text-[11px] font-mono text-slate-400 max-w-xs mt-1">
                        {cameraError ? cameraError : 'Target warehouse hardware tag to capture optical telemetry.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Torch overlay filter effect */}
                {torchOn && (
                  <div className="absolute inset-0 bg-white/10 pointer-events-none mix-blend-screen" />
                )}

                {/* HUD Overlay Guidelines & Scan Reticle */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20">
                  {/* Top HUD info */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400/90 drop-shadow">
                    <span className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-cyan-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LENS: {cameraActive ? 'OPTICAL SENSOR' : 'SIMULATOR'}
                    </span>
                    <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-cyan-500/30">
                      FPS: 60 &bull; ISO: AUTO
                    </span>
                  </div>

                  {/* Center Scanning Frame / Targeting Reticle */}
                  <div className="relative mx-auto my-auto w-48 h-48 sm:w-56 sm:h-56">
                    {/* Corner Reticle Markers */}
                    <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 transition-colors duration-200 ${
                      scanningState === 'detected' ? 'border-emerald-400' : scanningState === 'locked' ? 'border-amber-400' : 'border-cyan-400'
                    }`} />
                    <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 transition-colors duration-200 ${
                      scanningState === 'detected' ? 'border-emerald-400' : scanningState === 'locked' ? 'border-amber-400' : 'border-cyan-400'
                    }`} />
                    <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 transition-colors duration-200 ${
                      scanningState === 'detected' ? 'border-emerald-400' : scanningState === 'locked' ? 'border-amber-400' : 'border-cyan-400'
                    }`} />
                    <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 transition-colors duration-200 ${
                      scanningState === 'detected' ? 'border-emerald-400' : scanningState === 'locked' ? 'border-amber-400' : 'border-cyan-400'
                    }`} />

                    {/* Laser Scanning Bar */}
                    {scanningState === 'searching' && (
                      <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-bounce" 
                           style={{ animationDuration: '1.8s' }} 
                      />
                    )}

                    {/* QR Code Graphic In Center (Visible in simulator or for alignment) */}
                    <div className="absolute inset-4 border border-dashed border-cyan-500/20 rounded-lg flex items-center justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-2 rounded-lg shadow-lg flex flex-col items-center justify-center opacity-85 hover:opacity-100 transition-opacity">
                        {/* Realistic SVG QR Pattern Matrix */}
                        <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                          {/* Corner Squares */}
                          <rect x="0" y="0" width="30" height="30" fill="currentColor" />
                          <rect x="5" y="5" width="20" height="20" fill="white" />
                          <rect x="10" y="10" width="10" height="10" fill="currentColor" />

                          <rect x="70" y="0" width="30" height="30" fill="currentColor" />
                          <rect x="75" y="5" width="20" height="20" fill="white" />
                          <rect x="80" y="10" width="10" height="10" fill="currentColor" />

                          <rect x="0" y="70" width="30" height="30" fill="currentColor" />
                          <rect x="5" y="75" width="20" height="20" fill="white" />
                          <rect x="10" y="80" width="10" height="10" fill="currentColor" />

                          {/* Data bits */}
                          <rect x="36" y="10" width="8" height="8" fill="currentColor" />
                          <rect x="48" y="10" width="8" height="8" fill="currentColor" />
                          <rect x="36" y="24" width="8" height="8" fill="currentColor" />
                          <rect x="10" y="44" width="8" height="8" fill="currentColor" />
                          <rect x="24" y="44" width="8" height="8" fill="currentColor" />
                          <rect x="40" y="40" width="18" height="18" fill="currentColor" />
                          <rect x="68" y="44" width="8" height="8" fill="currentColor" />
                          <rect x="82" y="44" width="8" height="8" fill="currentColor" />
                          <rect x="40" y="68" width="8" height="8" fill="currentColor" />
                          <rect x="56" y="68" width="8" height="8" fill="currentColor" />
                          <rect x="72" y="72" width="18" height="18" fill="currentColor" />
                        </svg>
                        <span className="text-[7px] font-mono text-slate-800 font-bold uppercase tracking-tighter mt-0.5 truncate w-full text-center">
                          {activePresetAsset.code}
                        </span>
                      </div>
                    </div>

                    {/* Detected Match Badge */}
                    {scanningState === 'detected' && matchedAsset && (
                      <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm rounded-lg border border-emerald-400 flex flex-col items-center justify-center p-3 animate-in zoom-in-95">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
                        <span className="text-xs font-mono font-bold text-white uppercase">
                          MATCH CONFIRMED
                        </span>
                        <span className="text-[10px] font-mono text-emerald-300 font-bold truncate max-w-full">
                          {matchedAsset.code}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Viewfinder Status text */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono bg-black/60 px-2.5 py-1 rounded backdrop-blur text-slate-300 border border-slate-700/60 flex items-center gap-1.5">
                      <Scan className="w-3 h-3 text-cyan-400" />
                      {scanningState === 'searching' && 'ALIGN QR MATRIX WITHIN FRAME'}
                      {scanningState === 'locked' && 'LOCKING TELEMETRY RF CARRIER...'}
                      {scanningState === 'detected' && 'ASSET TELEMETRY SYNCED'}
                    </span>

                    <button
                      onClick={toggleTorch}
                      className={`p-1.5 rounded-lg border text-xs font-mono transition-colors pointer-events-auto backdrop-blur flex items-center gap-1 ${
                        torchOn 
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300' 
                          : 'bg-black/60 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title="Toggle Camera Flash Torch"
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{torchOn ? 'FLASH ON' : 'FLASH'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Viewfinder Controls row */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    id="qr-toggle-camera-btn"
                    onClick={() => {
                      if (cameraActive) {
                        stopCamera();
                      } else {
                        startCamera();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors"
                  >
                    {cameraActive ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Camera className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{cameraActive ? 'Stop Stream' : 'Restart Camera'}</span>
                  </button>

                  <button
                    id="qr-flip-camera-btn"
                    onClick={toggleFacingMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors"
                    title="Switch between front and back camera"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Flip Lens</span>
                  </button>
                </div>

                {/* Instant Scan Button for Current Target */}
                <button
                  id="qr-scan-now-btn"
                  onClick={() => handleTriggerDetection(activePresetAsset)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Scan Target Asset</span>
                </button>
              </div>
            </div>

            {/* Right Pane: Asset Target Selector & Identified Hardware Dossier (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-3">
              
              {/* If Asset Identified / Detected */}
              {matchedAsset ? (
                <div className="p-4 bg-slate-950/80 rounded-xl border border-emerald-500/40 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                      <CheckCircle2 className="w-4 h-4" />
                      ASSET IDENTIFIED
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-bold">
                      HEALTH: {matchedAsset.vitals.healthScore}%
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">{matchedAsset.name}</h4>
                    <p className="text-xs font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="text-cyan-400 font-semibold">{matchedAsset.code}</span>
                      <span>&bull;</span>
                      <span>{matchedAsset.zone}</span>
                    </p>
                  </div>

                  {/* Vitals snapshot */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Status</span>
                      <span className={`font-bold uppercase ${
                        matchedAsset.status === 'optimal' ? 'text-emerald-400' :
                        matchedAsset.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {matchedAsset.status}
                      </span>
                    </div>

                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Operating Hours</span>
                      <span className="font-bold text-slate-200">
                        {matchedAsset.vitals.operatingHours.toLocaleString()} hrs
                      </span>
                    </div>

                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Temperature</span>
                      <span className="font-bold text-slate-200">
                        {matchedAsset.vitals.temperatureC}°C
                      </span>
                    </div>

                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Firmware</span>
                      <span className="font-bold text-slate-200 truncate block">
                        {matchedAsset.vitals.firmwareVersion}
                      </span>
                    </div>
                  </div>

                  {/* Action CTA: Open full diagnostics */}
                  <button
                    id="qr-launch-diagnostics-btn"
                    onClick={handleOpenDiagnostics}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95"
                  >
                    <span>OPEN ASSET DIAGNOSTICS & TELEMETRY</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-1.5">
                  <div className="w-9 h-9 mx-auto rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400">
                    <Scan className="w-5 h-5 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-mono font-bold text-slate-200">AWAITING QR CAPTURE</h4>
                  <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                    Select an asset tag from the warehouse roster below or click <strong className="text-cyan-300">Scan Target Asset</strong> to instantly simulate camera recognition.
                  </p>
                </div>
              )}

              {/* Warehouse Asset Catalog List to simulate scanning */}
              <div className="bg-slate-950/90 rounded-xl border border-slate-800 p-3 space-y-2.5 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    Asset Tag Presets ({filteredAssets.length})
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Direct Tag Select</span>
                </div>

                {/* Filter search box */}
                <input
                  type="text"
                  placeholder="Filter by name, SKU, or code..."
                  value={barcodeSearchQuery}
                  onChange={(e) => setBarcodeSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />

                {/* Asset badges list */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {filteredAssets.map((asset) => {
                    const isSelected = selectedPresetId === asset.id;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => {
                          soundFx.playClick();
                          setSelectedPresetId(asset.id);
                          handleTriggerDetection(asset);
                        }}
                        className={`p-2 rounded-lg border text-xs font-mono cursor-pointer transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500/60 text-white shadow-sm'
                            : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold truncate">{asset.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="text-cyan-400 font-mono font-semibold">{asset.code}</span>
                            <span>&bull;</span>
                            <span className="truncate">{asset.zone}</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              asset.status === 'optimal' ? 'bg-emerald-400' :
                              asset.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                          />
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 hover:bg-cyan-900 hover:text-cyan-200">
                            Scan
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Modal Footer Note */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Industrial QR / DataMatrix / RFID scanner integrated with Warehouse Telemetry Hub</span>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
