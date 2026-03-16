
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LorenzCanvas } from './components/LorenzCanvas';
import { AudioEngine } from './services/audioEngine';
import { LorenzParams, PlayState, AttractorType, Theme, ProjectionType, MusicalScale } from './types';
import { Play, Square, Sun, Moon, Eye, EyeOff, MoveHorizontal, Activity, Zap } from 'lucide-react';

const audioEngine = new AudioEngine();

const DEFAULT_PARAMS: LorenzParams = {
  attractor1: AttractorType.LORENZ,
  attractor2: AttractorType.AIZAWA,
  attractor3: AttractorType.THOMAS,
  sigma: 10,
  rho: 28,
  beta: 8/3,
  speed1: 0.5, 
  speed2: 1.2, 
  speed3: 0.3, 
  waterTune: 1.0,
  glitchTune: 1.0,
  bassTune: 1.0,
  bassFilter: 50, 
  bassResonance: 0.2,
  globalGain: 1.0,
  drift: 0.2,
  musicalScale: MusicalScale.LYDIAN 
};

// --- Master Volume Fader (Matches XYController Dimensions) ---
interface MasterFaderProps {
  vol: number;
  onVolChange: (vol: number) => void;
  isDark: boolean;
}

const MasterFader: React.FC<MasterFaderProps> = ({ vol, onVolChange, isDark }) => {
  const volRef = useRef<HTMLDivElement>(null);
  const isDraggingVol = useRef(false);

  const updateVol = (e: React.PointerEvent) => {
    if (!volRef.current) return;
    const rect = volRef.current.getBoundingClientRect();
    const newVol = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onVolChange(newVol);
  };

  const handlePointerDownVol = (e: React.PointerEvent) => {
    isDraggingVol.current = true;
    updateVol(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingVol.current) updateVol(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingVol.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const borderColor = isDark ? 'border-white' : 'border-[#1c1c1c]';
  // Use #1a1a1a for dark mode background (10% gray)
  const bgColor = isDark ? 'bg-[#1a1a1a]' : 'bg-[#f0f0f0]';
  const textColor = isDark ? 'text-white' : 'text-[#1c1c1c]';
  const barColor = isDark ? '#ffffff' : '#1c1c1c';

  return (
    <div className={`flex flex-col gap-1 p-2 rounded-sm ${bgColor} transition-all duration-300`}>
       {/* Header */}
       <div className="flex items-center justify-between px-1 mb-1">
          <div className={`flex items-center gap-2 font-bold lowercase tracking-wider text-xs ${textColor}`}>
             dac
          </div>
       </div>

       {/* Main Area */}
       <div className="flex h-28 w-20 gap-2">
          {/* Main Fader */}
          <div 
              ref={volRef}
              onPointerDown={handlePointerDownVol}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`relative flex-1 cursor-ns-resize border ${borderColor} overflow-hidden`}
          >
              <div 
                  className="absolute bottom-0 w-full opacity-60 transition-none"
                  style={{ height: `${vol * 100}%`, backgroundColor: barColor }}
              />
              <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none opacity-30">
                  {[...Array(10)].map((_,i) => <div key={i} className={`w-full h-px ${isDark ? 'bg-white' : 'bg-[#1c1c1c]'}`} />)}
              </div>
              <span className={`absolute bottom-1 left-0 w-full text-center text-[8px] font-bold pointer-events-none mix-blend-difference text-white`}>
                  {Math.round(vol*100)}
              </span>
          </div>
       </div>
    </div>
  );
};


// --- Reusable XY Pad Component ---
interface XYControllerProps {
  label: string;
  icon?: React.ReactNode;
  color: string;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  vol: number; // 0..1 normalized
  onXYChange: (x: number, y: number) => void;
  onVolChange: (vol: number) => void;
  isDark: boolean;
  children?: React.ReactNode;
}

const XYController: React.FC<XYControllerProps> = ({ label, icon, color, x, y, vol, onXYChange, onVolChange, isDark, children }) => {
  const padRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const isDraggingXY = useRef(false);
  const isDraggingVol = useRef(false);

  const handlePointerDownXY = (e: React.PointerEvent) => {
    isDraggingXY.current = true;
    updateXY(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerDownVol = (e: React.PointerEvent) => {
    isDraggingVol.current = true;
    updateVol(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const updateXY = (e: React.PointerEvent) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newY = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)); 
    onXYChange(newX, newY);
  };

  const updateVol = (e: React.PointerEvent) => {
    if (!volRef.current) return;
    const rect = volRef.current.getBoundingClientRect();
    const newVol = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onVolChange(newVol);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingXY.current) updateXY(e);
    if (isDraggingVol.current) updateVol(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingXY.current = false;
    isDraggingVol.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const borderColor = isDark ? 'border-white' : 'border-[#1c1c1c]';
  // Use #1a1a1a for dark mode background (10% gray)
  const bgColor = isDark ? 'bg-[#1a1a1a]' : 'bg-[#f0f0f0]'; 
  const gridColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(28,28,28,0.1)';
  const textColor = isDark ? 'text-white' : 'text-[#1c1c1c]';

  return (
    <div className={`flex flex-col gap-1 p-2 rounded-sm ${bgColor} transition-all duration-300`}>
      {/* Header */}
      {icon && (
          <div className="flex items-center justify-between px-1 mb-1">
            <div className={`flex items-center gap-2 font-bold lowercase tracking-wider text-xs ${textColor}`}>
              {icon}
            </div>
          </div>
      )}
      
      <div className="flex h-28 w-40 gap-2">
        {/* XY Pad */}
        <div 
          ref={padRef}
          onPointerDown={handlePointerDownXY}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative flex-1 cursor-crosshair border ${borderColor} overflow-hidden group`}
          style={{ 
            backgroundImage: `radial-gradient(${gridColor} 1px, transparent 1px)`,
            backgroundSize: '10px 10px'
          }}
        >
          <span className={`absolute bottom-1 right-1 text-[8px] font-bold pointer-events-none opacity-50 ${textColor}`}>speed</span>
          <span className={`absolute top-1 left-1 text-[8px] font-bold pointer-events-none opacity-50 ${textColor}`}>pitch</span>
          
          <div 
            className={`absolute w-4 h-4 -ml-2 -mb-2 rounded-full border-2 ${isDark ? 'border-white' : 'border-[#1c1c1c]'} shadow-sm`}
            style={{ 
              left: `${x * 100}%`, 
              bottom: `${y * 100}%`,
              backgroundColor: color 
            }}
          />
        </div>

        {/* Volume Fader */}
        <div 
          ref={volRef}
          onPointerDown={handlePointerDownVol}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative w-6 cursor-ns-resize border ${borderColor} overflow-hidden`}
        >
          <div 
            className="absolute bottom-0 w-full opacity-60 transition-none"
            style={{ height: `${vol * 100}%`, backgroundColor: color }}
          />
          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none opacity-30">
             {[...Array(5)].map((_,i) => <div key={i} className={`w-full h-px ${isDark ? 'bg-white' : 'bg-[#1c1c1c]'}`} />)}
          </div>
          <span className={`absolute bottom-1 left-0 w-full text-center text-[8px] font-bold pointer-events-none mix-blend-difference text-white`}>vol</span>
        </div>
      </div>
      
      {/* Extra Controls (Unconditionally Rendered) */}
      {children && (
        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-white/20' : 'border-[#1c1c1c]/20'} flex flex-col gap-2`}>
            {children}
        </div>
      )}
    </div>
  );
};


export default function App() {
  const [params, setParams] = useState<LorenzParams>(DEFAULT_PARAMS);
  const [playState, setPlayState] = useState<PlayState>(PlayState.STOPPED);
  const [theme, setTheme] = useState<Theme>(Theme.LIGHT); 
  const [cameraFollows, setCameraFollows] = useState<boolean>(false);
  const [projection, setProjection] = useState<ProjectionType>(ProjectionType.PERSPECTIVE);
  
  // Audio Mixer State
  const [masterVol, setMasterVol] = useState(0.5);
  const [vol1, setVol1] = useState(0.7); 
  const [vol2, setVol2] = useState(0.6); 
  const [vol3, setVol3] = useState(0.8); 
  
  const [, setTick] = useState(0);

  const handleSimulationTick = useCallback((
      p1: {x:number, y:number, z:number, vel:number}, 
      p2: {x:number, y:number, z:number, vel:number}, 
      p3: {x:number, y:number, z:number, vel:number},
    ) => {
    
    if (playState === PlayState.PLAYING) {
        audioEngine.update(p1, p2, p3, 
        { s1: params.speed1, s2: params.speed2, s3: params.speed3 },
        { 
            waterTune: params.waterTune, 
            glitchTune: params.glitchTune, 
            bassTune: params.bassTune,
            drift: params.drift,
            musicalScale: params.musicalScale,
            bassFilter: params.bassFilter,
            bassResonance: params.bassResonance,
            globalGain: params.globalGain
        });
    }
  }, [playState, params]);

  const togglePlay = async () => {
    if (playState === PlayState.STOPPED) {
      await audioEngine.start();
      audioEngine.setMasterVolume(masterVol); 
      audioEngine.setVol1(vol1);
      audioEngine.setVol2(vol2);
      audioEngine.setVol3(vol3);
      setPlayState(PlayState.PLAYING);
      setTimeout(() => setTick(t => t+1), 100);
    } else {
      audioEngine.stop();
      setPlayState(PlayState.STOPPED);
    }
  };

  const handleMasterVolChange = (v: number) => {
      setMasterVol(v);
      audioEngine.setMasterVolume(v);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === Theme.DARK ? Theme.LIGHT : Theme.DARK);
  };

  const handleAtt1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setParams(prev => ({ ...prev, attractor1: e.target.value as AttractorType }));
  };
  const handleAtt2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setParams(prev => ({ ...prev, attractor2: e.target.value as AttractorType }));
  };
  const handleAtt3Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setParams(prev => ({ ...prev, attractor3: e.target.value as AttractorType }));
  };

  const isDark = theme === Theme.DARK;

  // Normalize/Denormalize helpers
  const normSpeed = (v: number) => (v - 0.1) / (5.0 - 0.1);
  const denormSpeed = (n: number) => 0.1 + n * (5.0 - 0.1);
  
  const normFreq = (v: number) => (v - 0.5) / (2.0 - 0.5);
  const denormFreq = (n: number) => 0.5 + n * (2.0 - 0.5);

  return (
    <div className={`relative w-screen h-screen overflow-hidden font-sans selection:bg-orange-500 selection:text-white ${isDark ? 'bg-[#1a1a1a] text-white' : 'bg-[#f0f0f0] text-[#1c1c1c]'}`}>
      
      {/* Background Canvas */}
      <div className="absolute inset-0 z-0">
        <LorenzCanvas 
          params={params} 
          theme={theme}
          isPlaying={playState === PlayState.PLAYING} 
          cameraFollows={cameraFollows}
          volumes={[vol1, vol2, vol3]}
          projection={projection}
          onTick={handleSimulationTick}
        />
      </div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 w-full p-4 z-10 pointer-events-none">
        <div className="flex flex-wrap justify-between items-start gap-4 pointer-events-auto">
           {/* Title Removed */}

           <div className="flex gap-4 ml-4"> 
              <div className="flex flex-col">
                  <select value={params.attractor1} onChange={handleAtt1Change}
                        className={`text-xs font-bold py-1 px-2 rounded-sm focus:outline-none lowercase cursor-pointer border ${isDark ? 'bg-[#222] text-gray-300 border-[#333]' : 'bg-[#e0e0e0] text-[#1c1c1c] border-transparent'}`}>
                        {Object.values(AttractorType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
                  </select>
              </div>
              <div className="flex flex-col">
                  <select value={params.attractor2} onChange={handleAtt2Change}
                        className={`text-xs font-bold py-1 px-2 rounded-sm focus:outline-none lowercase cursor-pointer border ${isDark ? 'bg-[#222] text-gray-300 border-[#333]' : 'bg-[#e0e0e0] text-[#1c1c1c] border-transparent'}`}>
                        {Object.values(AttractorType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
                  </select>
              </div>
              <div className="flex flex-col">
                  <select value={params.attractor3} onChange={handleAtt3Change}
                        className={`text-xs font-bold py-1 px-2 rounded-sm focus:outline-none lowercase cursor-pointer border ${isDark ? 'bg-[#222] text-gray-300 border-[#333]' : 'bg-[#e0e0e0] text-[#1c1c1c] border-transparent'}`}>
                        {Object.values(AttractorType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
                  </select>
              </div>
           </div>

           {/* View & Scale Selectors */}
           <div className="flex gap-4 items-start">
             <div className="flex flex-col items-end">
                <span className={`text-[10px] font-bold mb-1 lowercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>scale</span>
                <select value={params.musicalScale} onChange={(e) => setParams(p => ({...p, musicalScale: e.target.value as MusicalScale}))}
                      className={`text-xs font-bold py-1 px-2 rounded-sm focus:outline-none lowercase cursor-pointer border ${isDark ? 'bg-[#222] text-gray-300 border-[#333]' : 'bg-[#e0e0e0] text-[#1c1c1c] border-transparent'}`}>
                      {Object.values(MusicalScale).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
                </select>
             </div>
             <div className="flex flex-col items-end">
                <span className={`text-[10px] font-bold mb-1 lowercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>view</span>
                <select value={projection} onChange={(e) => setProjection(e.target.value as ProjectionType)}
                      className={`text-xs font-bold py-1 px-2 rounded-sm focus:outline-none lowercase cursor-pointer border ${isDark ? 'bg-[#222] text-gray-300 border-[#333]' : 'bg-[#e0e0e0] text-[#1c1c1c] border-transparent'}`}>
                      {Object.values(ProjectionType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
                </select>
             </div>
           </div>
        </div>
      </div>

      {/* Bottom Control Deck (Bottom Left) */}
      <div className="absolute bottom-6 left-0 w-full z-20 pointer-events-none flex justify-start items-end px-6">
          <div className="flex flex-wrap items-end gap-4 pointer-events-auto">
            
            {/* Global Controls */}
            <div className="flex flex-col gap-2">
                <button onClick={togglePlay}
                    className={`h-16 w-16 flex flex-col items-center justify-center gap-1 transition-all
                    ${isDark ? 'text-white' : 'text-[#1c1c1c]'}`}
                >
                    {playState === PlayState.PLAYING ? 
                      <Square size={20} fill="currentColor" strokeWidth={0}/> : 
                      <Play size={20} fill="currentColor" strokeWidth={0}/>
                    }
                    <span className="text-[10px] font-bold lowercase">{playState === PlayState.PLAYING ? "stop" : "play"}</span>
                </button>

                <div className="grid grid-cols-2 gap-2 w-16">
                     <button onClick={() => setCameraFollows(!cameraFollows)} 
                        className={`h-8 w-8 flex items-center justify-center transition-all
                        ${isDark ? 'text-white' : 'text-[#1c1c1c]'}`}>
                        {cameraFollows ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={toggleTheme} 
                        className={`h-8 w-8 flex items-center justify-center transition-all
                        ${isDark ? 'bg-[#1a1a1a] text-yellow-400' : 'bg-[#f0f0f0] text-[#1c1c1c]'}`}>
                        {isDark ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                </div>
            </div>
            
            {/* Master Volume Fader (Boost removed) */}
            <MasterFader 
                vol={masterVol} 
                onVolChange={handleMasterVolChange} 
                isDark={isDark} 
            />

            {/* XY Controller 1: VIOLET */}
            <XYController 
                label=""
                color={isDark ? '#A78BFA' : '#7C3AED'} // Violet 400 / 600
                isDark={isDark}
                x={normSpeed(params.speed1)}
                y={normFreq(params.waterTune)}
                vol={vol1}
                onXYChange={(x, y) => setParams(p => ({ ...p, speed1: denormSpeed(x), waterTune: denormFreq(y) }))}
                onVolChange={(v) => { setVol1(v); audioEngine.setVol1(v); }}
            />

            {/* XY Controller 2: GREEN */}
            <XYController 
                label=""
                color={isDark ? '#86EFAC' : '#16A34A'} // Green 300 / 600
                isDark={isDark}
                x={normSpeed(params.speed2)}
                y={normFreq(params.glitchTune)}
                vol={vol2}
                onXYChange={(x, y) => setParams(p => ({ ...p, speed2: denormSpeed(x), glitchTune: denormFreq(y) }))}
                onVolChange={(v) => { setVol2(v); audioEngine.setVol2(v); }}
            />

            {/* XY Controller 3: RED */}
            <XYController 
                label=""
                color={isDark ? '#FCA5A5' : '#DC2626'} // Red 300 / 600
                isDark={isDark}
                x={normSpeed(params.speed3)}
                y={normFreq(params.bassTune)}
                vol={vol3}
                onXYChange={(x, y) => setParams(p => ({ ...p, speed3: denormSpeed(x), bassTune: denormFreq(y) }))}
                onVolChange={(v) => { setVol3(v); audioEngine.setVol3(v); }}
            />

          </div>
      </div>
    </div>
  );
}
