
import React, { useRef, useEffect } from 'react';
import { LorenzParams, Point, AttractorType, Theme, ProjectionType } from '../types';

interface LorenzCanvasProps {
  params: LorenzParams;
  theme: Theme;
  isPlaying: boolean;
  cameraFollows: boolean;
  volumes: number[]; // [vol1, vol2, vol3]
  projection: ProjectionType;
  onTick: (
      p1: {x:number, y:number, z:number, vel:number}, 
      p2: {x:number, y:number, z:number, vel:number}, 
      p3: {x:number, y:number, z:number, vel:number},
    ) => void;
}

const MAX_TRAIL_LENGTH = 5000;

export const LorenzCanvas: React.FC<LorenzCanvasProps> = ({ params, theme, isPlaying, onTick, cameraFollows, volumes, projection }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTime = useRef<number>(0);
  
  // Refs for Props to decouple animation loop from render cycle
  const paramsRef = useRef(params);
  const themeRef = useRef(theme);
  const cameraFollowsRef = useRef(cameraFollows);
  const volumesRef = useRef(volumes);
  const projectionRef = useRef(projection);
  const onTickRef = useRef(onTick);

  // Sync refs with props
  useEffect(() => {
    paramsRef.current = params;
    themeRef.current = theme;
    cameraFollowsRef.current = cameraFollows;
    volumesRef.current = volumes;
    projectionRef.current = projection;
    onTickRef.current = onTick;
  }, [params, theme, cameraFollows, volumes, projection, onTick]);

  // Rotation State
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0, y: 0 }); 
  
  // Zoom State
  const scale = useRef(12);

  // Camera State (for smooth following)
  const cameraPos = useRef({ x: 0, y: 0, z: 30 });

  // Intro Animation State
  const scanZ = useRef(0);

  // Mutable state for 3 Attractors
  const state = useRef<{
    pos1: Point;
    pos2: Point;
    pos3: Point;
    trail1: Point[];
    trail2: Point[];
    trail3: Point[];
    lastAtt1: AttractorType | null;
    lastAtt2: AttractorType | null;
    lastAtt3: AttractorType | null;
  }>({
    pos1: { x: 0.1, y: 0, z: 0 },
    pos2: { x: 1, y: 0, z: 0 },
    pos3: { x: 0, y: 0.1, z: 0 },
    trail1: [],
    trail2: [],
    trail3: [],
    lastAtt1: null,
    lastAtt2: null,
    lastAtt3: null,
  });

  const getStartPos = (type: AttractorType, offset: number): Point => {
      switch(type) {
        case AttractorType.HALVORSEN: return { x: 1 + offset, y: 0, z: 0 };
        default: return { x: 0.1 + offset, y: 0, z: 0 };
      }
  };

  const getNormalizationScale = (type: AttractorType): number => {
      switch(type) {
          case AttractorType.AIZAWA: return 15.0;
          case AttractorType.THOMAS: return 5.0;
          case AttractorType.HALVORSEN: return 3.0;
          case AttractorType.LORENZ: default: return 1.0;
      }
  };

  const getVisualOffset = (type: AttractorType): Point => {
      switch(type) {
          case AttractorType.LORENZ: return { x: 0, y: 0, z: 0 };
          default: return { x: 0, y: 0, z: 30 };
      }
  };

  // Reset logic if attractor type changes
  useEffect(() => {
    const s = state.current;
    if (s.lastAtt1 !== params.attractor1) {
        s.lastAtt1 = params.attractor1;
        s.pos1 = getStartPos(params.attractor1, 0);
        s.trail1 = [];
    }
    if (s.lastAtt2 !== params.attractor2) {
        s.lastAtt2 = params.attractor2;
        s.pos2 = getStartPos(params.attractor2, 0.1);
        s.trail2 = [];
    }
    if (s.lastAtt3 !== params.attractor3) {
        s.lastAtt3 = params.attractor3;
        s.pos3 = getStartPos(params.attractor3, 0.2);
        s.trail3 = [];
    }
  }, [params.attractor1, params.attractor2, params.attractor3]);

  // Reset scan animation when visual context changes
  useEffect(() => {
    scanZ.current = 0;
  }, [projection, theme, params.attractor1, params.attractor2, params.attractor3]);

  const computeStep = (attractor: AttractorType, pos: Point): {dx:number, dy:number, dz:number} => {
        let dx = 0, dy = 0, dz = 0;
        const { sigma, rho, beta } = paramsRef.current;

        switch (attractor) {
            case AttractorType.AIZAWA: {
                const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
                dx = (pos.z - b) * pos.x - d * pos.y;
                dy = d * pos.x + (pos.z - b) * pos.y;
                dz = c + a * pos.z - (Math.pow(pos.z, 3) / 3) - (Math.pow(pos.x, 2) + Math.pow(pos.y, 2)) * (1 + e * pos.z) + f * pos.z * Math.pow(pos.x, 3);
                break;
            }
            case AttractorType.THOMAS: {
                const b_thomas = 0.208186; 
                dx = Math.sin(pos.y) - b_thomas * pos.x;
                dy = Math.sin(pos.z) - b_thomas * pos.y;
                dz = Math.sin(pos.x) - b_thomas * pos.z;
                break;
            }
            case AttractorType.HALVORSEN: {
                const a_hal = 1.4; 
                dx = -a_hal * pos.x - 4 * pos.y - 4 * pos.z - (pos.y * pos.y);
                dy = -a_hal * pos.y - 4 * pos.z - 4 * pos.x - (pos.z * pos.z);
                dz = -a_hal * pos.z - 4 * pos.x - 4 * pos.y - (pos.x * pos.x);
                break;
            }
            case AttractorType.LORENZ:
            default: {
                dx = sigma * (pos.y - pos.x);
                dy = pos.x * (rho - pos.z) - pos.y;
                dz = pos.x * pos.y - beta * pos.z;
                break;
            }
        }
        return { dx, dy, dz };
  };

  const simulateSingle = (attractor: AttractorType, pos: Point, speed: number, steps: number): { newPos: Point, vel: number } => {
      let curr = { ...pos };
      const dt = (0.01 * speed) / steps; 
      
      for (let i = 0; i < steps; i++) {
          const d = computeStep(attractor, curr);
          curr.x += d.dx * dt;
          curr.y += d.dy * dt;
          curr.z += d.dz * dt;
          if (!Number.isFinite(curr.x)) {
              const reset = getStartPos(attractor, Math.random());
              curr.x = reset.x; curr.y = reset.y; curr.z = reset.z;
          }
      }
      const dist = Math.sqrt(Math.pow(curr.x - pos.x, 2) + Math.pow(curr.y - pos.y, 2) + Math.pow(curr.z - pos.z, 2));
      const vel = (dist / dt) * 0.1; 
      return { newPos: curr, vel };
  };

  const simulate = () => {
    const SUB_STEPS = 10;
    const s = state.current;
    const p = paramsRef.current;

    const res1 = simulateSingle(p.attractor1, s.pos1, p.speed1, SUB_STEPS);
    const res2 = simulateSingle(p.attractor2, s.pos2, p.speed2, SUB_STEPS);
    const res3 = simulateSingle(p.attractor3, s.pos3, p.speed3, SUB_STEPS);

    s.pos1 = res1.newPos;
    s.pos2 = res2.newPos;
    s.pos3 = res3.newPos;

    const scale1 = getNormalizationScale(p.attractor1);
    const off1 = getVisualOffset(p.attractor1);
    s.trail1.push({ x: s.pos1.x * scale1 + off1.x, y: s.pos1.y * scale1 + off1.y, z: s.pos1.z * scale1 + off1.z });

    const scale2 = getNormalizationScale(p.attractor2);
    const off2 = getVisualOffset(p.attractor2);
    s.trail2.push({ x: s.pos2.x * scale2 + off2.x, y: s.pos2.y * scale2 + off2.y, z: s.pos2.z * scale2 + off2.z });

    const scale3 = getNormalizationScale(p.attractor3);
    const off3 = getVisualOffset(p.attractor3);
    s.trail3.push({ x: s.pos3.x * scale3 + off3.x, y: s.pos3.y * scale3 + off3.y, z: s.pos3.z * scale3 + off3.z });

    if (s.trail1.length > MAX_TRAIL_LENGTH) s.trail1.shift();
    if (s.trail2.length > MAX_TRAIL_LENGTH) s.trail2.shift();
    if (s.trail3.length > MAX_TRAIL_LENGTH) s.trail3.shift();

    if (onTickRef.current) {
        onTickRef.current(
            { ...s.trail1[s.trail1.length-1], vel: res1.vel * 100 }, 
            { ...s.trail2[s.trail2.length-1], vel: res2.vel * 100 },
            { ...s.trail3[s.trail3.length-1], vel: res3.vel * 100 }
        );
    }
  };

  const project = (p: Point, origin: Point, width: number, height: number, type: ProjectionType): Point | null => {
    const cx = width / 2;
    const cy = height / 2;
    
    // Rotate around Grid Center (Pivot) to create Orbit effect
    const pivot = { x: 0, y: 0, z: 30 };
    
    // 1. World -> Pivot Relative
    let vx = p.x - pivot.x;
    let vy = p.y - pivot.y;
    let vz = p.z - pivot.z;

    // 2. Apply Rotation
    const cosY = Math.cos(rotation.current.y);
    const sinY = Math.sin(rotation.current.y);
    let rx = vx * cosY - vz * sinY;
    let rz = vx * sinY + vz * cosY;
    let ry = vy;

    const cosX = Math.cos(rotation.current.x);
    const sinX = Math.sin(rotation.current.x);
    let ry2 = ry * cosX - rz * sinX;
    let rz2 = ry * sinX + rz * cosX;
    let rx2 = rx;

    // 3. Pivot Relative -> World (Rotated)
    let wx = rx2 + pivot.x;
    let wy = ry2 + pivot.y;
    let wz = rz2 + pivot.z;

    // 4. World -> Camera Relative
    let x = wx - origin.x;
    let y = wy - origin.y;
    let z = wz - origin.z;

    const s = scale.current;

    switch (type) {
        case ProjectionType.ORTHOGRAPHIC: {
             return { x: x * s + cx, y: -y * s + cy, z: z };
        }
        case ProjectionType.MERCATOR: {
            // Treat rotated X,Z as longitude/plane and Y as latitude
            const r = Math.sqrt(x*x + y*y + z*z);
            if (r < 0.001) return { x: cx, y: cy, z: z };

            // Longitude (wrapping X)
            const lambda = Math.atan2(x, z); 

            // Latitude
            const phi = Math.asin(Math.max(-1, Math.min(1, y / r)));

            // Clamp latitude to avoid infinity at poles
            const maxPhi = 85 * (Math.PI / 180);
            const clampedPhi = Math.max(-maxPhi, Math.min(maxPhi, phi));

            const mercX = lambda;
            const mercY = Math.log(Math.tan(Math.PI / 4 + clampedPhi / 2));

            // Adjust scale factor for Mercator
            const zoom = s * 20; 

            return {
                x: mercX * zoom + cx,
                y: -mercY * zoom + cy,
                z: z
            };
        }
        case ProjectionType.FISHEYE: {
            const r = Math.sqrt(x*x + y*y);
            if (z > 0) return null; 
            
            const theta = Math.atan2(r, -z); 
            const phi = Math.atan2(y, x);
            const f = s * 40; 
            const r_screen = f * theta;
            const maxR = Math.min(width, height) * 0.45; // Limit to circle fitting screen
            
            // Clip points outside the lens circle
            if (r_screen > maxR) return null;
            
            return {
                x: r_screen * Math.cos(phi) + cx,
                y: -r_screen * Math.sin(phi) + cy,
                z: z
            };
        }
        case ProjectionType.PERSPECTIVE:
        default: {
            return { x: x * s + cx, y: -y * s + cy, z: z };
        }
    }
  };

  const drawTrail = (ctx: CanvasRenderingContext2D, trail: Point[], origin: Point, w: number, h: number, color: string, volume: number) => {
      if (trail.length < 2) return;
      const proj = projectionRef.current;

      const mercatorZoom = scale.current * 20;
      const mercatorWrapThreshold = (2 * Math.PI * mercatorZoom) * 0.5;
      
      ctx.lineWidth = 1;
      
      const minX = -100, maxX = w + 100;
      const minY = -100, maxY = h + 100;

      for (let i = 0; i < trail.length - 1; i++) {
          const alpha = Math.pow(i / trail.length, 3) * volume; 
          
          if (alpha < 0.05) continue;

          ctx.strokeStyle = color.replace('ALPHA', alpha.toFixed(3));
          
          const p1 = project(trail[i], origin, w, h, proj);
          const p2 = project(trail[i+1], origin, w, h, proj);
          
          if (!p1 || !p2) continue;
          
          if ((p1.x < minX && p2.x < minX) || (p1.x > maxX && p2.x > maxX) ||
              (p1.y < minY && p2.y < minY) || (p1.y > maxY && p2.y > maxY)) continue;

          if (proj === ProjectionType.MERCATOR && Math.abs(p1.x - p2.x) > mercatorWrapThreshold) continue;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
      }
  };

  const drawLabel = (ctx: CanvasRenderingContext2D, point: Point, origin: Point, w: number, h: number, color: string) => {
      const p = project(point, origin, w, h, projectionRef.current);
      if (!p) return;

      if (p.x < -100 || p.x > w + 100 || p.y < -100 || p.y > h + 100) return;
      
      const solidColor = color.replace('ALPHA', '1.0');
      ctx.fillStyle = solidColor;
      ctx.font = '10px Inter';
      ctx.fillText(`x:${point.x.toFixed(1)} y:${point.y.toFixed(1)} z:${point.z.toFixed(1)}`, p.x + 8, p.y + 3);
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number, dt: number) => {
    // Clear the canvas completely each frame to prevent ghosting/afterimages on text and moving objects
    ctx.clearRect(0, 0, width, height);

    const head1 = state.current.trail1[state.current.trail1.length - 1] || {x:0, y:0, z:0};
    const head2 = state.current.trail2[state.current.trail2.length - 1] || {x:0, y:0, z:0};
    const head3 = state.current.trail3[state.current.trail3.length - 1] || {x:0, y:0, z:0};
    
    let targetOrigin = { x: 0, y: 0, z: 30 }; 
    
    // Auto-follow if enabled OR if using Fish Eye (to keep subjects in the lens)
    const proj = projectionRef.current;
    if (cameraFollowsRef.current || proj === ProjectionType.FISHEYE) {
        const cx = (head1.x + head2.x + head3.x) / 3;
        const cy = (head1.y + head2.y + head3.y) / 3;
        const cz = (head1.z + head2.z + head3.z) / 3;
        
        const zOffset = proj === ProjectionType.FISHEYE ? 60 : 0;

        targetOrigin = {
            x: cx,
            y: cy,
            z: cz + zOffset,
        };
    }
    
    const lerp = 0.05;
    cameraPos.current.x += (targetOrigin.x - cameraPos.current.x) * lerp;
    cameraPos.current.y += (targetOrigin.y - cameraPos.current.y) * lerp;
    cameraPos.current.z += (targetOrigin.z - cameraPos.current.z) * lerp;

    const origin = cameraPos.current;
    
    // Grid Logic
    
    // 1. Scan Animation Logic (Once every 60 seconds)
    const minZ = 0, maxZ = 60;
    const gradientTail = 40; 
    const activeDistance = maxZ + gradientTail; // ~100 units visual range
    
    const visualScanDuration = 5.0; // The scan takes 5 seconds to pass through visually
    const cycleDuration = 60.0; // Repeats every 60 seconds
    
    const scanSpeed = activeDistance / visualScanDuration; 
    const period = scanSpeed * cycleDuration; // Total virtual distance

    scanZ.current += scanSpeed * dt; 
    if (scanZ.current > period) {
        scanZ.current -= period; 
    }

    const minX = -30, maxX = 30;
    const step = 12; // Sparse grid
    const minY = -30, maxY = 30;
    const minZGrid = minZ; // Start of grid
    const crossSize = 0.5;

    ctx.lineWidth = 1;

    // Calculate Mercator wrapping threshold for grid
    const mercatorZoom = scale.current * 20;
    const mercatorWrapThreshold = (2 * Math.PI * mercatorZoom) * 0.5;
    
    // Grid Loop
    ctx.beginPath();
    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        for (let z = minZGrid; z <= maxZ; z += step) {
            
          // LOOPING GRADIENT LOGIC
          let dist = (scanZ.current - z) % period;
          if (dist < 0) dist += period;

          // Highlight Calculation
          // If within the wave tail, calculate intensity. Otherwise 0.
          let highlight = 0;
          if (dist <= gradientTail) {
              highlight = 1.0 - (dist / gradientTail);
          }
          
          let strokeColor;
          if (themeRef.current === Theme.DARK) {
              // Dark Mode: 
              // Base White (0.2) -> Highlight increases opacity to 1.0
              const baseAlpha = 0.2;
              const a = Math.min(1.0, baseAlpha + highlight);
              // stroke brightness 100 (grayscale)
              strokeColor = `rgba(100, 100, 100, ${a.toFixed(2)})`;
          } else {
              // Light Mode: 
              // Base Dark Gray (0.1) -> Highlight brightens to White and increases opacity
              const startC = 255; // White (Highlight)
              const endC = 28;    // Dark Gray (Base)
              
              // Color Interpolation
              const c = Math.floor(endC + (startC - endC) * highlight);
              
              // Alpha Interpolation
              const baseAlpha = 0.1;
              const a = Math.min(1.0, baseAlpha + highlight * 0.9);
              strokeColor = `rgba(${c}, ${c}, ${c}, ${a.toFixed(2)})`;
          }
          
          ctx.strokeStyle = strokeColor;

          const p = project({x, y, z}, origin, width, height, proj);
          
          if (p && p.x > -50 && p.x < width + 50 && p.y > -50 && p.y < height + 50) {
             
             ctx.stroke(); // Draw previous batch
             ctx.beginPath(); // Start new
             ctx.strokeStyle = strokeColor;

             const px1 = project({x: x - crossSize, y, z}, origin, width, height, proj);
             const px2 = project({x: x + crossSize, y, z}, origin, width, height, proj);
             if (px1 && px2 && px1.x > -50 && px2.x < width + 50 && !(proj === ProjectionType.MERCATOR && Math.abs(px1.x - px2.x) > mercatorWrapThreshold)) { 
                 ctx.moveTo(px1.x, px1.y); ctx.lineTo(px2.x, px2.y); 
             }

             const py1 = project({x, y: y - crossSize, z}, origin, width, height, proj);
             const py2 = project({x, y: y + crossSize, z}, origin, width, height, proj);
             if (py1 && py2 && py1.x > -50 && py2.x < width + 50 && !(proj === ProjectionType.MERCATOR && Math.abs(py1.x - py2.x) > mercatorWrapThreshold)) { 
                 ctx.moveTo(py1.x, py1.y); ctx.lineTo(py2.x, py2.y); 
             }

             const pz1 = project({x, y, z: z - crossSize}, origin, width, height, proj);
             const pz2 = project({x, y, z: z + crossSize}, origin, width, height, proj);
             if (pz1 && pz2 && pz1.x > -50 && pz2.x < width + 50 && !(proj === ProjectionType.MERCATOR && Math.abs(pz1.x - pz2.x) > mercatorWrapThreshold)) { 
                 ctx.moveTo(pz1.x, pz1.y); ctx.lineTo(pz2.x, pz2.y); 
             }
          }
        }
      }
    }
    ctx.stroke(); // Final stroke

    // Colors: Violet, Green, Red
    const isDark = themeRef.current === Theme.DARK;
    
    // Violet (Layer 1) - Replaces Cyan
    const c1 = isDark ? 'rgba(167, 139, 250, ALPHA)' : 'rgba(124, 58, 237, ALPHA)'; // Violet 400 / 600
    // Green (Layer 2)
    const c2 = isDark ? 'rgba(134, 239, 172, ALPHA)' : 'rgba(22, 163, 74, ALPHA)'; // Green 300 / 600
    // Red (Layer 3)
    const c3 = isDark ? 'rgba(252, 165, 165, ALPHA)' : 'rgba(220, 38, 38, ALPHA)'; // Red 300 / 600

    const vols = volumesRef.current;
    
    drawTrail(ctx, state.current.trail1, origin, width, height, c1, vols[0]);
    drawTrail(ctx, state.current.trail2, origin, width, height, c2, vols[1]);
    drawTrail(ctx, state.current.trail3, origin, width, height, c3, vols[2]);

    if (vols[0] > 0.1) drawLabel(ctx, head1, origin, width, height, c1);
    if (vols[1] > 0.1) drawLabel(ctx, head2, origin, width, height, c2);
    if (vols[2] > 0.1) drawLabel(ctx, head3, origin, width, height, c3);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastMouse.current.x;
    const deltaY = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    rotation.current.y += deltaX * 0.005; 
    rotation.current.x += deltaY * 0.005; 
  };

  const handleMouseUp = () => { isDragging.current = false; };
  const handleWheel = (e: React.WheelEvent) => {
    const ZOOM_SPEED = scale.current * 0.001; 
    scale.current -= e.deltaY * ZOOM_SPEED;
    scale.current = Math.max(1, Math.min(scale.current, 500));
  };

  // Main Loop - Dependent ONLY on isPlaying
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Initialize time
    lastTime.current = performance.now();

    const render = () => {
      // Delta Time Calc
      const now = performance.now();
      const dt = Math.min((now - lastTime.current) / 1000, 0.1); // Cap at 100ms
      lastTime.current = now;

      if (isPlaying) simulate();
      
      // Auto-rotation (horizontal/Y-axis)
      if (!isDragging.current) {
         rotation.current.y += 0.1 * dt; 
      }

      if (canvas) {
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
        draw(ctx, canvas.width, canvas.height, dt);
      }
      requestRef.current = requestAnimationFrame(render);
    };
    requestRef.current = requestAnimationFrame(render);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying]); 

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block cursor-move"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
};
