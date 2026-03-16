
import * as Tone from 'tone';
import { MusicalScale } from "../types";

// Base frequency (C2)
const BASE_FREQ = 65.406; 

// Scale Generation
const generateScale = (intervals: number[]): number[] => {
    const freqs: number[] = [];
    for (let octave = 0; octave < 5; octave++) {
        intervals.forEach(semitone => {
            const noteIndex = octave * 12 + semitone;
            const f = BASE_FREQ * Math.pow(2, noteIndex / 12);
            freqs.push(f);
        });
    }
    return freqs;
};

const SCALES: Record<MusicalScale, number[]> = {
    [MusicalScale.C_MAJOR]: generateScale([0, 2, 4, 5, 7, 9, 11]),
    [MusicalScale.C_MINOR]: generateScale([0, 2, 3, 5, 7, 8, 10]),
    [MusicalScale.PENTATONIC_MIN]: generateScale([0, 3, 5, 7, 10]),
    [MusicalScale.LYDIAN]: generateScale([0, 2, 4, 6, 7, 9, 11]), 
    [MusicalScale.HIRAJOSHI]: generateScale([0, 2, 3, 7, 8]), 
    [MusicalScale.RYUKYU]: generateScale([0, 4, 5, 7, 11]), 
    [MusicalScale.PELOG]: generateScale([0, 1, 3, 7, 8]), 
    [MusicalScale.CHROMATIC]: generateScale([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
};

interface SynthLayer {
    instrument: Tone.Synth;
    vol: Tone.Volume;
    panner: Tone.Panner3D;
    lfo: Tone.LFO; // For Rhythm (Amplitude Modulation)
    filter: Tone.Filter; 
    currentNote: number | null; 
}

export class AudioEngine {
  // Master FX
  private masterGain: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  
  // Analysis
  private masterAnalyser: AnalyserNode | null = null;
  private channelAnalysers: AnalyserNode[] = [];

  // Channel Buses
  private channelGains: Tone.Gain[] = [];

  // Layers
  private layers: SynthLayer[] = [];

  private isPlaying: boolean = false;

  // Mix
  private vol1: number = 0.6; 
  private vol2: number = 0.6; 
  private vol3: number = 0.6; 
  
  private manualMasterVolume: number = 0.5;
  private generativeGlobalGain: number = 1.0;

  constructor() {}

  public async start() {
    await Tone.start();
    if (Tone.context.state !== 'running') await Tone.context.resume();

    this.isPlaying = true;
    const now = Tone.now();

    // 1. Master Chain
    this.masterGain = new Tone.Gain(this.manualMasterVolume * this.generativeGlobalGain);
    
    // Simple Reverb
    this.reverb = new Tone.Reverb({ decay: 4, preDelay: 0.1 });
    await this.reverb.ready;
    this.reverb.wet.value = 0.3; 

    this.masterAnalyser = Tone.context.createAnalyser();
    this.masterAnalyser.fftSize = 256;

    this.masterGain.connect(this.reverb);
    this.reverb.connect(this.masterAnalyser);
    Tone.connect(this.masterAnalyser, Tone.Destination);

    // 2. Setup Layers
    this.channelGains = [];
    this.channelAnalysers = [];
    this.layers = [];

    // Create 3 Layers
    for(let i=0; i<3; i++) {
        const bus = new Tone.Gain(1.0);
        const analyser = Tone.context.createAnalyser();
        analyser.fftSize = 256;

        bus.connect(this.masterGain);
        Tone.connect(bus, analyser);

        this.channelGains.push(bus);
        this.channelAnalysers.push(analyser);

        this.layers.push(this.createLayer(now, i));
    }
  }

  public stop() {
    this.isPlaying = false;
    
    this.layers.forEach(layer => {
        layer.instrument.triggerRelease();
        layer.instrument.dispose();
        layer.vol.dispose();
        layer.lfo.stop();
        layer.lfo.dispose();
        layer.filter.dispose();
        layer.panner.dispose();
    });
    this.layers = [];

    this.channelGains.forEach(g => g.dispose());
    this.channelGains = [];

    this.channelAnalysers.forEach(a => { try { a.disconnect(); } catch(e) {} });
    this.channelAnalysers = []; 

    if (this.masterGain) this.masterGain.dispose();
    if (this.reverb) this.reverb.dispose();
    if (this.masterAnalyser) { try { this.masterAnalyser.disconnect(); } catch(e) {} }
    
    this.masterGain = null;
    this.reverb = null;
    this.masterAnalyser = null;
  }

  // --- SOUND DESIGN ---
  // Simple Sine Wave Oscillator with Tremolo (AM) for Rhythm
  private createLayer(t: number, index: number): SynthLayer {
      
      const synth = new Tone.Synth({
        oscillator: { type: "sine" }, // Pure sine wave
        envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 1.0,
            release: 1.0
        }
      });

      // Volume node to handle Amplitude Modulation (Rhythm)
      const volNode = new Tone.Volume(0);
      
      // LFO for Rhythm (Tremolo effect)
      // Modulates volume from -Infinity (silent) to 0db
      const lfo = new Tone.LFO(2, -20, 0).start(t); // Rate 2Hz, Depth -20db to 0db
      lfo.connect(volNode.volume);

      const filter = new Tone.Filter(3000, "lowpass");
      
      const panner = new Tone.Panner3D({
          panningModel: 'HRTF',
          refDistance: 2,
          maxDistance: 100,
          rolloffFactor: 1
      });

      // Signal Chain: Synth -> Filter -> Volume(AM) -> Panner -> Bus
      synth.connect(filter);
      filter.connect(volNode);
      volNode.connect(panner);
      panner.connect(this.channelGains[index]);

      return {
          instrument: synth,
          vol: volNode,
          panner,
          lfo,
          filter,
          currentNote: null
      };
  }

  private updateMasterGain() {
      if (this.masterGain) {
          const target = this.manualMasterVolume * this.generativeGlobalGain;
          this.masterGain.gain.rampTo(target, 0.1);
      }
  }

  public update(
      p1: {x:number, y:number, z:number, vel:number}, 
      p2: {x:number, y:number, z:number, vel:number}, 
      p3: {x:number, y:number, z:number, vel:number},
      speeds: {s1: number, s2: number, s3: number},
      tuning: {
        waterTune: number, 
        glitchTune: number, 
        bassTune: number, 
        drift?: number,
        musicalScale: MusicalScale,
        bassFilter: number,
        bassResonance: number,
        globalGain: number
      }
  ) {
    if (!this.isPlaying) return;
    if (Tone.context.state === 'suspended') Tone.context.resume().catch(() => {});

    const now = Tone.now();
    
    // Global Volume
    if (this.generativeGlobalGain !== tuning.globalGain) {
        this.generativeGlobalGain = tuning.globalGain;
        this.updateMasterGain();
    }

    // Helper to process one attractor layer
    const processLayer = (
        index: number, 
        pos: {x:number, y:number, z:number, vel:number}, 
        speed: number, 
        tune: number, 
        vol: number
    ) => {
        const layer = this.layers[index];
        if (!layer) return;

        // 1. Spatial
        layer.panner.positionX.rampTo(this.clamp(pos.x), 0.1);
        layer.panner.positionY.rampTo(this.clamp(pos.y), 0.1);
        layer.panner.positionZ.rampTo(this.clamp(pos.z), 0.1);

        // 2. Channel Volume (Mixer)
        this.channelGains[index].gain.rampTo(vol, 0.1);

        // 3. Modulation (Rhythm)
        // Map simulation speed to LFO rate (Rhythm)
        // Speed range ~0.1 to 5.0 -> LFO 1Hz to 15Hz
        const lfoRate = 1 + (speed * 2);
        layer.lfo.frequency.rampTo(lfoRate, 0.1);

        // 4. Harmony (Pitch)
        const value = pos.x + pos.y;
        
        // Lower octaves for audibility (C3, C4, C2)
        const octaveOffset = index === 0 ? 36 : (index === 1 ? 48 : 24); 
        const noteFreq = this.getQuantizedNote(value, octaveOffset, octaveOffset + 24, tuning.musicalScale);
        
        // Apply tuning multiplier
        const targetFreq = noteFreq * tune;

        // Trigger logic - Portamento
        if (layer.currentNote !== targetFreq) {
            // If synth is active, ramp to new frequency
            layer.instrument.triggerAttack(targetFreq, now);
            layer.currentNote = targetFreq;
        }
    };

    processLayer(0, p1, speeds.s1, tuning.waterTune, this.vol1);
    processLayer(1, p2, speeds.s2, tuning.glitchTune, this.vol2);
    processLayer(2, p3, speeds.s3, tuning.bassTune, this.vol3);
  }

  // --- Helpers ---

  private clamp(v: number): number {
      if (!Number.isFinite(v)) return 0;
      return Math.max(-1000, Math.min(1000, v));
  }

  private getScaleArray(scaleType: MusicalScale): number[] {
    return SCALES[scaleType] || SCALES[MusicalScale.LYDIAN];
  }

  private getQuantizedNote(value: number, minIndex: number, maxIndex: number, scaleType: MusicalScale): number {
    const scale = this.getScaleArray(scaleType);
    const range = maxIndex - minIndex;
    const normalized = (Math.sin(value / 10) + 1) / 2; // Slower fluctuation
    const index = Math.floor(normalized * range) + minIndex;
    const safeIndex = Math.max(0, Math.min(scale.length - 1, index));
    return scale[safeIndex];
  }

  // --- Getters/Setters ---
  public getAnalyser(index: number): AnalyserNode | null {
      return this.channelAnalysers[index] || null;
  }
  public getMasterAnalyser(): AnalyserNode | null {
      return this.masterAnalyser;
  }
  public setMasterVolume(v: number) { 
      this.manualMasterVolume = v;
      this.updateMasterGain();
  }
  public setVol1(v: number) { this.vol1 = v; }
  public setVol2(v: number) { this.vol2 = v; }
  public setVol3(v: number) { this.vol3 = v; }
}
