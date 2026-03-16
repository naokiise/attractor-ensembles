
export enum AttractorType {
  LORENZ = 'LORENZ',
  AIZAWA = 'AIZAWA',
  THOMAS = 'THOMAS', // Cyclically Symmetric (Quasi-periodic-like)
  HALVORSEN = 'HALVORSEN'
}

export enum Theme {
  DARK = 'DARK',
  LIGHT = 'LIGHT'
}

export enum SoundMode {
  DRONE = 'DRONE',  
  ETHER = 'ETHER',  
  PULSE = 'PULSE'   
}

export enum ProjectionType {
  ORTHOGRAPHIC = 'ORTHOGRAPHIC',
  FISHEYE = 'FISHEYE',
  PERSPECTIVE = 'PERSPECTIVE',
  MERCATOR = 'MERCATOR'
}

export enum MusicalScale {
  C_MINOR = 'C_MINOR',
  C_MAJOR = 'C_MAJOR',
  PENTATONIC_MIN = 'PENTATONIC_MIN',
  LYDIAN = 'LYDIAN',     // Ambient favorite
  HIRAJOSHI = 'HIRAJOSHI', 
  RYUKYU = 'RYUKYU',       
  PELOG = 'PELOG',         
  CHROMATIC = 'CHROMATIC'
}

export interface LorenzParams {
  attractor1: AttractorType;
  attractor2: AttractorType;
  attractor3: AttractorType;
  
  // Physics Constants
  sigma: number;
  rho: number;
  beta: number;

  // Individual Simulation Speeds (0.1 - 5.0) -> Acts as Clock Divider
  speed1: number;
  speed2: number;
  speed3: number;

  // Sound Tuning Parameters
  waterTune: number;    // Layer 1 (Water Pitch/Flow)
  glitchTune: number;   // Layer 2
  bassTune: number;     // Layer 3 (formerly Choir)
  
  // Bass Sound Design
  bassFilter: number;   // Cutoff frequency offset (0-100)
  bassResonance: number;// Filter Resonance/Q (0-1)

  // Mixing
  globalGain: number;   // Master boost/drive (0.1 - 2.0)

  // Musical Context
  musicalScale: MusicalScale;

  // Extra Controls
  drift?: number; // Detune/Feedback amount
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface PhysicsState {
  x: number;
  y: number;
  z: number;
  velocity: number;
}

export enum PlayState {
  STOPPED,
  PLAYING,
}