
import React, { useState, useCallback, useRef } from 'react';
import { LorenzCanvas } from './components/LorenzCanvas';
import { AudioEngine } from './services/audioEngine';
import { LorenzParams, PlayState, AttractorType, Theme, ProjectionType, MusicalScale } from './types';
import { Play, Square, Sun, Moon } from 'lucide-react';

const audioEngine = new AudioEngine();

const DEFAULT_PARAMS: LorenzParams = {
  attractor1: AttractorType.LORENZ,
  attractor2: AttractorType.AIZAWA,
  attractor3: AttractorType.THOMAS,
  sigma: 10,
  rho: 28,
  beta: 8/3,
  speed1: 1.275,
  speed2: 1.275,
  speed3: 1.275,
  waterTune: 1.25,
  glitchTune: 1.25,
  bassTune: 1.25,
  bassFilter: 50,
  bassResonance: 0.2,
  globalGain: 1.0,
  drift: 0.2,
  musicalScale: MusicalScale.LYDIAN
};

// --- Shared style helpers ---
const fg = (isDark: boolean) => isDark ? 'rgba(255,255,255,ALPHA)' : 'rgba(0,0,0,ALPHA)';
const fgClass = (isDark: boolean, alpha: '90'|'50'|'25' = '90') => {
  const map = { '90': isDark ? 'text-white/90' : 'text-black/90', '50': isDark ? 'text-white/50' : 'text-black/50', '25': isDark ? 'text-white/25' : 'text-black/25' };
  return map[alpha];
};
const borderClass = (isDark: boolean) => isDark ? 'border-white/20' : 'border-black/[0.12]';
const panelBg = (_isDark: boolean) => 'bg-transparent';
const selectClass = (isDark: boolean) =>
  `text-xs font-medium py-1 px-2 rounded-sm focus:outline-none lowercase cursor-pointer border bg-transparent ${borderClass(isDark)} ${fgClass(isDark, '90')}`;

// --- Master Volume Fader ---
interface MasterFaderProps { vol: number; onVolChange: (v: number) => void; isDark: boolean; }

const MasterFader: React.FC<MasterFaderProps> = ({ vol, onVolChange, isDark }) => {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = (e: React.PointerEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    onVolChange(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)));
  };

  return (
    <div className={`flex flex-col gap-1 p-2 rounded-sm ${panelBg(isDark)}`}>
      <div className={`text-[10px] font-medium lowercase tracking-wider px-1 ${fgClass(isDark, '50')}`}>volume</div>
      <div className="flex h-14 w-10 gap-2">
        <div
          ref={ref}
          onPointerDown={e => { dragging.current = true; update(e); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (dragging.current) update(e); }}
          onPointerUp={e => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
          className={`relative flex-1 cursor-ns-resize overflow-hidden`}
        >
          <div
            className="absolute bottom-0 w-full transition-none"
            style={{ height: `${vol * 100}%`, backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
          />
          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none opacity-20">
            {[...Array(10)].map((_, i) => (
              <div key={i} className={`w-full h-px ${isDark ? 'bg-white' : 'bg-black'}`} />
            ))}
          </div>
          <span className="absolute bottom-1 left-0 w-full text-center text-[8px] font-bold pointer-events-none mix-blend-difference text-white">
            {Math.round(vol * 100)}
          </span>
        </div>
      </div>
    </div>
  );
};

// --- XY Controller ---
interface XYControllerProps {
  color: string; x: number; y: number; vol: number;
  onXYChange: (x: number, y: number) => void;
  onVolChange: (v: number) => void;
  isDark: boolean;
}

const XYController: React.FC<XYControllerProps> = ({ color, x, y, vol, onXYChange, onVolChange, isDark }) => {
  const padRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const draggingXY = useRef(false);
  const draggingVol = useRef(false);

  const updateXY = (e: React.PointerEvent) => {
    if (!padRef.current) return;
    const r = padRef.current.getBoundingClientRect();
    onXYChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)));
  };
  const updateVol = (e: React.PointerEvent) => {
    if (!volRef.current) return;
    const r = volRef.current.getBoundingClientRect();
    onVolChange(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)));
  };

  const handleMove = (e: React.PointerEvent) => {
    if (draggingXY.current) updateXY(e);
    if (draggingVol.current) updateVol(e);
  };
  const handleUp = (e: React.PointerEvent) => {
    draggingXY.current = false; draggingVol.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';

  return (
    <div className={`flex flex-col gap-1 p-2 rounded-sm ${panelBg(isDark)}`}>
      <div className="flex h-14 w-20 gap-2">
        {/* XY Pad */}
        <div
          ref={padRef}
          onPointerDown={e => { draggingXY.current = true; updateXY(e); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          className={`relative flex-1 cursor-crosshair overflow-hidden`}
          style={{ backgroundImage: `radial-gradient(${gridColor} 1px, transparent 1px)`, backgroundSize: '10px 10px' }}
        >
          <span className={`absolute bottom-1 right-1 text-[8px] font-medium pointer-events-none ${fgClass(isDark, '25')}`}>speed</span>
          <span className={`absolute top-1 left-1 text-[8px] font-medium pointer-events-none ${fgClass(isDark, '25')}`}>pitch</span>
          <div
            className={`absolute w-4 h-4 -ml-2 -mb-2 rounded-full border-2 ${isDark ? 'border-white/80' : 'border-black/60'} shadow-sm`}
            style={{ left: `${x * 100}%`, bottom: `${y * 100}%`, backgroundColor: color }}
          />
        </div>
        {/* Vol Fader */}
        <div className="flex flex-col gap-0 items-center">
          <span className={`text-[8px] font-medium lowercase mb-1 pointer-events-none ${fgClass(isDark, '25')}`}>volume</span>
          <div
            ref={volRef}
            onPointerDown={e => { draggingVol.current = true; updateVol(e); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            className={`relative w-3 flex-1 cursor-ns-resize overflow-hidden`}
          >
            <div className="absolute bottom-0 w-full transition-none opacity-70" style={{ height: `${vol * 100}%`, backgroundColor: color }} />
            <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none opacity-20">
              {[...Array(5)].map((_, i) => <div key={i} className={`w-full h-px ${isDark ? 'bg-white' : 'bg-black'}`} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- App ---
export default function App() {
  const [params, setParams] = useState<LorenzParams>(DEFAULT_PARAMS);
  const [playState, setPlayState] = useState<PlayState>(PlayState.STOPPED);
  const [theme, setTheme] = useState<Theme>(Theme.LIGHT);
  const [cameraFollows, setCameraFollows] = useState(true);
  const [projection, setProjection] = useState<ProjectionType>(ProjectionType.PERSPECTIVE);
  const [masterVol, setMasterVol] = useState(0);
  const hasStarted = useRef(false);
  const [vol1, setVol1] = useState(0.7);
  const [vol2, setVol2] = useState(0.6);
  const [vol3, setVol3] = useState(0.8);
  const [, setTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isDark = theme === Theme.DARK;

  const handleSimulationTick = useCallback((
    p1: {x:number,y:number,z:number,vel:number},
    p2: {x:number,y:number,z:number,vel:number},
    p3: {x:number,y:number,z:number,vel:number},
  ) => {
    if (playState === PlayState.PLAYING) {
      audioEngine.update(p1, p2, p3,
        { s1: params.speed1, s2: params.speed2, s3: params.speed3 },
        { waterTune: params.waterTune, glitchTune: params.glitchTune, bassTune: params.bassTune,
          drift: params.drift, musicalScale: params.musicalScale, bassFilter: params.bassFilter,
          bassResonance: params.bassResonance, globalGain: params.globalGain });
    }
  }, [playState, params]);

  const togglePlay = async () => {
    if (playState === PlayState.STOPPED) {
      await audioEngine.start();
      audioEngine.setMasterVolume(masterVol);
      audioEngine.setVol1(vol1); audioEngine.setVol2(vol2); audioEngine.setVol3(vol3);
      setPlayState(PlayState.PLAYING);
      setTimeout(() => setTick(t => t + 1), 100);
    } else {
      audioEngine.stop();
      setPlayState(PlayState.STOPPED);
    }
  };

  // Auto-start audio on first user interaction
  React.useEffect(() => {
    const handleFirstInteraction = async () => {
      if (hasStarted.current) return;
      hasStarted.current = true;
      await audioEngine.start();
      audioEngine.setMasterVolume(0);
      audioEngine.setVol1(vol1); audioEngine.setVol2(vol2); audioEngine.setVol3(vol3);
      setPlayState(PlayState.PLAYING);
      document.removeEventListener('pointerdown', handleFirstInteraction);
    };
    document.addEventListener('pointerdown', handleFirstInteraction);
    return () => document.removeEventListener('pointerdown', handleFirstInteraction);
  }, []);

  const normSpeed = (v: number) => (v - 0.05) / (2.5 - 0.05);
  const denormSpeed = (n: number) => 0.05 + n * (2.5 - 0.05);
  const normFreq = (v: number) => (v - 0.5) / (2.0 - 0.5);
  const denormFreq = (n: number) => 0.5 + n * (2.0 - 0.5);

  // naokiise.com header-icon style
  const iconBtnClass = `flex items-center justify-center w-9 h-9 rounded-md border-none bg-transparent cursor-pointer transition-colors duration-200
    ${isDark ? 'text-white/50 hover:text-white/90 hover:bg-white/[0.08]' : 'text-black/50 hover:text-black/90 hover:bg-black/[0.08]'}`;

  return (
    <div className={`relative w-screen h-screen overflow-hidden font-sans selection:bg-orange-500 selection:text-white ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}
      style={{ transition: 'background 0.3s, color 0.3s' }}>

      {/* Canvas */}
      <div className="absolute inset-0 z-0">
        <LorenzCanvas
          params={params} theme={theme} isPlaying={playState === PlayState.PLAYING}
          cameraFollows={cameraFollows} volumes={[vol1, vol2, vol3]}
          projection={projection} onTick={handleSimulationTick}
        />
      </div>

      {/* ── Search Overlay (naokiise.com style) ── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-center items-start"
          style={{ paddingTop: '15vh', background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false); }}
        >
          <div
            className={`rounded-lg px-5 py-4 w-[90%] max-w-[420px] border ${isDark ? 'bg-black border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.3)]' : 'bg-white border-black/25 shadow-[0_8px_32px_rgba(0,0,0,0.1)]'}`}
          >
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
              placeholder="Search…"
              className={`w-full bg-transparent border-none outline-none text-[16px] font-[inherit] ${fgClass(isDark, '90')} placeholder:${fgClass(isDark, '50')}`}
            />
          </div>
        </div>
      )}

      {/* ── Site Header (naokiise.com style) ── */}
      <header className="absolute top-0 left-0 w-full z-10 grid px-6 pointer-events-none"
        style={{ height: '56px', gridTemplateColumns: '1fr auto 1fr', fontFamily: "'Inter', system-ui, sans-serif", alignItems: 'center' }}>

        {/* Left: Naoki Ise */}
        <div className="flex items-center pointer-events-auto">
          <a
            href="https://naokiise.com"
            className={`text-[20px] font-[500] no-underline whitespace-nowrap ${fgClass(isDark, '90')}`}
            style={{ textDecoration: 'none' }}
          >
            Naoki Ise
          </a>
        </div>

        {/* Center: sonic type / chaoscillator (active) */}
        <div className="flex items-center gap-2 text-[20px] font-[500] pointer-events-auto">
          <a href="https://naokiise.com" className={`no-underline ${fgClass(isDark, '50')}`} style={{ textDecoration: 'none' }}>sonic type</a>
          <span className={fgClass(isDark, '25')}>/</span>
          <span className={`${fgClass(isDark, '90')} border-b`} style={{ borderColor: 'currentColor', paddingBottom: '1px' }}>
            chaoscillator
          </span>
        </div>

        {/* Right: About + theme + search */}
        <div className="flex items-center gap-1 justify-end pointer-events-auto">
          <a
            href="https://info.naokiise.com"
            className={`text-[14px] px-3 py-1.5 transition-colors duration-200 no-underline ${fgClass(isDark, '50')}`}
            style={{ textDecoration: 'none' }}
          >
            About
          </a>
          <button
            onClick={() => setTheme(t => t === Theme.DARK ? Theme.LIGHT : Theme.DARK)}
            className={iconBtnClass} title="Toggle theme"
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>
                <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
                <path d="M2 12h2"/><path d="M20 12h2"/>
                <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>
                <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
                <path d="M2 12h2"/><path d="M20 12h2"/>
                <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            )}
          </button>
<button onClick={() => setSearchOpen(true)} className={iconBtnClass} title="Search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Bottom Controls ── */}
      <div className="absolute bottom-6 left-0 w-full z-20 pointer-events-none flex justify-start items-end px-6">
        <div className="flex flex-col gap-1 pointer-events-auto">

          {/* Row 1: all selects aligned */}
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <select value={params.musicalScale} onChange={e => setParams(p => ({...p, musicalScale: e.target.value as MusicalScale}))} className={selectClass(isDark)}>
                {Object.values(MusicalScale).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
              </select>
              <select value={projection} onChange={e => setProjection(e.target.value as ProjectionType)} className={selectClass(isDark)}>
                {Object.values(ProjectionType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
              </select>
            </div>
            <select value={params.attractor1} onChange={e => setParams(p => ({...p, attractor1: e.target.value as AttractorType}))} className={selectClass(isDark)}>
              {Object.values(AttractorType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
            <select value={params.attractor2} onChange={e => setParams(p => ({...p, attractor2: e.target.value as AttractorType}))} className={selectClass(isDark)}>
              {Object.values(AttractorType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
            <select value={params.attractor3} onChange={e => setParams(p => ({...p, attractor3: e.target.value as AttractorType}))} className={selectClass(isDark)}>
              {Object.values(AttractorType).map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
          </div>

          {/* Row 2: controllers */}
          <div className="flex items-end gap-4">
            <MasterFader vol={masterVol} onVolChange={v => { setMasterVol(v); audioEngine.setMasterVolume(v); }} isDark={isDark} />
            <XYController
              color={isDark ? '#A78BFA' : '#7C3AED'}
              isDark={isDark}
              x={normSpeed(params.speed1)} y={normFreq(params.waterTune)} vol={vol1}
              onXYChange={(x, y) => setParams(p => ({...p, speed1: denormSpeed(x), waterTune: denormFreq(y)}))}
              onVolChange={v => { setVol1(v); audioEngine.setVol1(v); }}
            />
            <XYController
              color={isDark ? '#86EFAC' : '#16A34A'}
              isDark={isDark}
              x={normSpeed(params.speed2)} y={normFreq(params.glitchTune)} vol={vol2}
              onXYChange={(x, y) => setParams(p => ({...p, speed2: denormSpeed(x), glitchTune: denormFreq(y)}))}
              onVolChange={v => { setVol2(v); audioEngine.setVol2(v); }}
            />
            <XYController
              color={isDark ? '#FCA5A5' : '#DC2626'}
              isDark={isDark}
              x={normSpeed(params.speed3)} y={normFreq(params.bassTune)} vol={vol3}
              onXYChange={(x, y) => setParams(p => ({...p, speed3: denormSpeed(x), bassTune: denormFreq(y)}))}
              onVolChange={v => { setVol3(v); audioEngine.setVol3(v); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
