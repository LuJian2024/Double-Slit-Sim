

import './App.css'
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

/**
 * PHYSICS FORMULAS REFERENCE
 * ===========================
 * 1. Interference Intensity: I = 4*I₀*cos²(Δφ/2)
 * 2. Phase Difference: Δφ = (2π/λ)*Δr
 * 3. Path Difference: Δr ≈ d*sinθ
 * 4. Fringe Spacing: Δy ≈ λL/d
 * 5. Complementarity: V² + D² ≤ 1
 */

/* ========================================
   LAYER 1: PHYSICS CORE (Pure Functions)
======================================== */

function calculateIntensity(y, params) {
  const { wavelength, slitDistance, screenDistance, observed } = params;
  const centerY = 200;
  const slit1Y = centerY - slitDistance / 2;
  const slit2Y = centerY + slitDistance / 2;
  
  if (observed) {
    const diff1 = y - slit1Y;
    const diff2 = y - slit2Y;
    const width = slitDistance * 0.3;
    const blob1 = Math.exp(-Math.pow(diff1 / width, 2));
    const blob2 = Math.exp(-Math.pow(diff2 / width, 2));
    return blob1 + blob2;
  } else {
    const y1 = y - slit1Y;
    const y2 = y - slit2Y;
    const r1 = Math.sqrt(screenDistance * screenDistance + y1 * y1);
    const r2 = Math.sqrt(screenDistance * screenDistance + y2 * y2);
    const k = (2 * Math.PI) / wavelength;
    const pathDiff = r2 - r1;
    const phaseDiff = k * pathDiff;
    const interference = 4 * Math.pow(Math.cos(phaseDiff / 2), 2);
    const envelope = Math.exp(-Math.pow((y - centerY) / 100, 2));
    return interference * envelope;
  }
}

function calculateWaveAmplitude(x, y, t, params) {
  const { wavelength, slitDistance, sourceX, slitX } = params;
  const centerY = 200;
  
  if (x < slitX) {
    const d = Math.sqrt((x - sourceX) ** 2 + (y - centerY) ** 2);
    const k = (2 * Math.PI) / wavelength;
    return Math.cos(k * d - t * 0.1) * Math.exp(-d * 0.005);
  } else {
    const slit1Y = centerY - slitDistance / 2;
    const slit2Y = centerY + slitDistance / 2;
    const d1 = Math.sqrt((x - slitX) ** 2 + (y - slit1Y) ** 2);
    const d2 = Math.sqrt((x - slitX) ** 2 + (y - slit2Y) ** 2);
    const k = (2 * Math.PI) / wavelength;
    const a1 = Math.exp(-d1 * 0.003) / (d1 * 0.01 + 1);
    const a2 = Math.exp(-d2 * 0.003) / (d2 * 0.01 + 1);
    return a1 * Math.cos(k * d1 - t * 0.1) + a2 * Math.cos(k * d2 - t * 0.1);
  }
}

function samplePositionByIntensity(params, height = 400) {
  const samples = [];
  let total = 0;
  
  for (let y = 0; y < height; y++) {
    const I = Math.max(0, calculateIntensity(y, params));
    samples[y] = I;
    total += I;
  }
  
  let random = Math.random() * total;
  for (let y = 0; y < height; y++) {
    random -= samples[y];
    if (random <= 0) return y;
  }
  return height / 2;
}

/* ========================================
   LAYER 2: WORLD STATE (Not in React)
======================================== */

function createWorld() {
  return {
    particles: [],
    screenHits: [],
    time: 0
  };
}

function createParticle(params) {
  const { sourceX, slitDistance, observed } = params;
  const centerY = 200;
  
  let whichSlit = null;
  let targetSlitY;
  
  if (observed) {
    whichSlit = Math.random() < 0.5 ? 1 : 2;
    targetSlitY = whichSlit === 1 
      ? centerY - slitDistance / 2 
      : centerY + slitDistance / 2;
  } else {
    targetSlitY = Math.random() < 0.5 
      ? centerY - slitDistance / 2 
      : centerY + slitDistance / 2;
  }
  
  return {
    x: sourceX,
    y: centerY,
    vx: 3.5,
    vy: 0,
    targetSlitY,
    finalY: samplePositionByIntensity(params),
    whichSlit,
    phase: 0,
    id: Math.random()
  };
}

function stepParticle(particle, params, dt) {
  const { slitX, screenX } = params;
  const centerY = 200;
  const slitDistance = params.slitDistance;
  
  if (particle.phase === 0) {
    const dx = slitX - particle.x;
    const dy = particle.targetSlitY - particle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < particle.vx * dt) {
      const slit1Y = centerY - slitDistance / 2;
      const slit2Y = centerY + slitDistance / 2;
      const atSlit1 = Math.abs(particle.targetSlitY - slit1Y) < 2;
      const atSlit2 = Math.abs(particle.targetSlitY - slit2Y) < 2;
      
      if (atSlit1 || atSlit2) {
        particle.phase = 1;
        particle.x = slitX + 5;
        particle.y = particle.targetSlitY;
        return true;
      } else {
        return false;
      }
    }
    
    particle.x += (dx / dist) * particle.vx * dt;
    particle.y += (dy / dist) * particle.vx * dt;
    return true;
    
  } else {
    const dx = screenX - particle.x;
    const dy = particle.finalY - particle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (particle.x >= screenX || dist < particle.vx * dt) {
      return false;
    }
    
    particle.x += (dx / dist) * particle.vx * dt;
    particle.y += (dy / dist) * particle.vx * dt;
    return true;
  }
}

function stepWorld(world, params, dt) {
  if (Math.random() < 0.2) {
    world.particles.push(createParticle(params));
  }
  
  const survivors = [];
  world.particles.forEach(p => {
    const alive = stepParticle(p, params, dt);
    if (alive) {
      survivors.push(p);
    } else if (p.phase === 1) {
      world.screenHits.push({
        y: p.finalY,
        x: Math.random() * 80 + 10,
        age: 0,
        id: Math.random()
      });
    }
  });
  world.particles = survivors;
  world.screenHits.forEach(hit => hit.age++);
  world.time += dt;
}

/* ========================================
   LAYER 3: RENDERERS (Pure Drawing)
======================================== */

function drawApparatus(ctx, params) {
  const { sourceX, slitX, slitDistance, slitWidth, screenX } = params;
  const height = ctx.canvas.height;
  const centerY = 200;
  
  ctx.fillStyle = '#ffff00';
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#ffff00';
  ctx.beginPath();
  ctx.arc(sourceX, centerY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  
  ctx.fillStyle = '#666';
  const slit1Top = centerY - slitDistance / 2 - slitWidth / 2;
  const slit2Bottom = centerY + slitDistance / 2 + slitWidth / 2;
  ctx.fillRect(slitX - 5, 0, 10, slit1Top);
  ctx.fillRect(slitX - 5, centerY - slitDistance / 2 + slitWidth / 2, 10, slitDistance - slitWidth);
  ctx.fillRect(slitX - 5, slit2Bottom, 10, height - slit2Bottom);
  
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(screenX, 0);
  ctx.lineTo(screenX, height);
  ctx.stroke();
}

function drawDetectors(ctx, params) {
  if (!params.observed) return;
  
  const { slitX, slitDistance } = params;
  const centerY = 200;
  const slit1Y = centerY - slitDistance / 2;
  const slit2Y = centerY + slitDistance / 2;
  
  ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
  ctx.beginPath();
  ctx.arc(slitX + 15, slit1Y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(slitX + 15, slit2Y, 8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.fillText('Detector', slitX + 26, slit1Y - 10);
  ctx.fillText('Detector', slitX + 26, slit2Y - 10);
}

function drawParticles(ctx, particles) {
  const { sourceX } = { sourceX: 30 };
  const slitX = 200;
  
  particles.forEach(p => {
    const color = p.whichSlit 
      ? (p.whichSlit === 1 ? '#ff6b6b' : '#4dabf7') 
      : '#ffff00';
    
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = p.whichSlit 
      ? (p.whichSlit === 1 ? 'rgba(255, 107, 107, 0.4)' : 'rgba(77, 171, 247, 0.4)')
      : 'rgba(255, 255, 100, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sourceX, 200);
    if (p.phase === 0) {
      ctx.lineTo(p.x, p.y);
    } else {
      ctx.lineTo(slitX, p.targetSlitY);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  });
}

function drawWaveField(ctx, params, time) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  for (let x = 0; x < width; x += 3) {
    for (let y = 0; y < height; y += 3) {
      const amplitude = calculateWaveAmplitude(x, y, time, params);
      const brightness = Math.abs(amplitude) * 100;
      const color = amplitude > 0 
        ? `rgb(${brightness}, ${brightness}, 255)` 
        : `rgb(255, ${brightness}, ${brightness})`;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 3, 3);
    }
  }
}

function drawScreenPattern(ctx, params, time) {
  const height = ctx.canvas.height;
  const width = ctx.canvas.width;
  
  let maxI = 0;
  const intensities = [];
  
  for (let y = 0; y < height; y++) {
    const amplitude = calculateWaveAmplitude(params.screenX, y, time, params);
    const I = amplitude * amplitude;
    intensities[y] = I;
    maxI = Math.max(maxI, I);
  }
  
  for (let y = 0; y < height; y++) {
    const brightness = Math.min(255, (intensities[y] / (maxI + 0.01)) * 255);
    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.fillRect(0, y, width, 2);
  }
}

function drawScreenHits(ctx, screenHits) {
  screenHits.forEach(hit => {
    const brightness = hit.age < 10 ? 255 : 180;
    const size = hit.age < 10 ? 2.5 : 1.5;
    
    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, size, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ========================================
   LAYER 4: REACT UI (Minimal Orchestration)
======================================== */

const DoubleSlitSimulator = () => {
  const mainCanvasRef = useRef(null);
  const screenCanvasRef = useRef(null);
  const worldRef = useRef(createWorld());
  
  const [mode, setMode] = useState('wave');
  const [isPlaying, setIsPlaying] = useState(false);
  const [slitDistance, setSlitDistance] = useState(80);
  const [slitWidth, setSlitWidth] = useState(20);
  const [wavelength, setWavelength] = useState(20);
  
  const params = {
    wavelength,
    slitDistance,
    slitWidth,
    screenDistance: 350,
    sourceX: 30,
    slitX: 200,
    screenX: 550,
    observed: mode === 'quantum_observed'
  };
  
  const reset = () => {
    worldRef.current = createWorld();
    setIsPlaying(false);
  };
  
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const screenCanvas = screenCanvasRef.current;
    if (!mainCanvas || !screenCanvas) return;
    
    const mainCtx = mainCanvas.getContext('2d');
    const screenCtx = screenCanvas.getContext('2d');
    const world = worldRef.current;
    
    let animationId;
    
    function animate() {
      if (!isPlaying) return;
      
      mainCtx.fillStyle = '#000';
      mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
      screenCtx.fillStyle = '#000';
      screenCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
      
      if (mode === 'wave') {
        drawWaveField(mainCtx, params, world.time);
        drawApparatus(mainCtx, params);
        drawScreenPattern(screenCtx, params, world.time);
        world.time += 1;
        
        screenCtx.fillStyle = '#fff';
        screenCtx.font = '11px sans-serif';
        screenCtx.fillText('Interference', 10, 20);
        screenCtx.fillText('Pattern', 10, 35);
      } else {
        stepWorld(world, params, 1);
        drawApparatus(mainCtx, params);
        drawDetectors(mainCtx, params);
        drawParticles(mainCtx, world.particles);
        drawScreenHits(screenCtx, world.screenHits);
        
        screenCtx.fillStyle = '#fff';
        screenCtx.font = '11px sans-serif';
        screenCtx.fillText('Photon', 10, 20);
        screenCtx.fillText('Hits', 10, 35);
        screenCtx.fillText(`${world.screenHits.length}`, 10, 370);
        
        if (world.screenHits.length < 200) {
          screenCtx.fillStyle = '#ffaa00';
          screenCtx.font = '10px sans-serif';
          screenCtx.fillText('Building...', 5, 385);
        }
      }
      
      animationId = requestAnimationFrame(animate);
    }
    
    if (isPlaying) {
      animate();
    }
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isPlaying, mode, wavelength, slitDistance, slitWidth]);
  
  const getDescription = () => {
    const total = worldRef.current.screenHits.length;
    if (mode === 'quantum_unobserved') {
      if (total < 200) {
        return '⏳ Building up... Each photon seems random, but a pattern will emerge';
      }
      return '✅ See the interference fringes? Multiple bright and dark bands - wave behavior!';
    } else if (mode === 'quantum_observed') {
      if (total < 200) {
        return '⏳ Building up... Observing the path will destroy interference';
      }
      return '✅ See? Only two blobs, no interference fringes - pure particle behavior!';
    }
    return '';
  };
  
  return (
    <div className="w-full min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Quantum Double-Slit Experiment</h1>
        <p className="text-gray-400 mb-6">Bohr's Complementarity Principle</p>
        
        <div className="grid grid-cols-3 gap-6">
          {/* Left 2/3 */}
          <div className="col-span-2 space-y-4">
            {/* Canvas */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex gap-4">
                <canvas ref={mainCanvasRef} width={600} height={400} className="flex-1 border border-gray-600 rounded bg-black" />
                <canvas ref={screenCanvasRef} width={100} height={400} className="border border-gray-600 rounded bg-black" style={{width: '100px'}} />
              </div>
              <p className="mt-3 text-sm text-gray-400">🟡 Light Source | ⬜ Double Slits | 🔴 Detectors | 📊 Screen</p>
            </div>
            
            {/* Status */}
            {mode !== 'wave' && (
              <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
                <p className="text-sm">{getDescription()}</p>
              </div>
            )}
            
            {/* How to Tell + Physics - Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">🔍 How to Tell Interference?</h3>
                <div className="space-y-3">
                  <div className="bg-green-900/30 border border-green-600 p-3 rounded">
                    <h4 className="font-semibold text-green-400 mb-1 text-sm">✅ Interference</h4>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>• 3-5 bright bands</li>
                      <li>• Dark bands between</li>
                      <li>• Regular pattern</li>
                    </ul>
                  </div>
                  <div className="bg-red-900/30 border border-red-600 p-3 rounded">
                    <h4 className="font-semibold text-red-400 mb-1 text-sm">❌ No Interference</h4>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>• Only TWO blobs</li>
                      <li>• Aligned with slits</li>
                      <li>• Clear gap in middle</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">📐 Physics Core</h3>
                <div className="bg-gray-900 p-3 rounded font-mono text-xs space-y-1 text-gray-300 mb-3">
                  <p>I = 4I₀cos²(Δφ/2)</p>
                  <p>Δφ = (2π/λ)Δr</p>
                  <p>Δy ≈ λL/d</p>
                  <p className="pt-2 text-yellow-400">V² + D² ≤ 1</p>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>• I: Intensity</p>
                  <p>• Δφ: Phase difference</p>
                  <p>• λ: Wavelength, d: Slit distance</p>
                  <p>• V: Visibility, D: Distinguishability</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right 1/3 */}
          <div className="col-span-1 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Mode</h3>
              <div className="space-y-2">
                <button onClick={() => { setMode('wave'); reset(); }} className={`w-full py-2 px-3 rounded text-sm ${mode === 'wave' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  🌊 Classical Wave
                </button>
                <button onClick={() => { setMode('quantum_unobserved'); reset(); }} className={`w-full py-2 px-3 rounded text-sm ${mode === 'quantum_unobserved' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  ⚛️ Quantum - Unobserved
                </button>
                <button onClick={() => { setMode('quantum_observed'); reset(); }} className={`w-full py-2 px-3 rounded text-sm ${mode === 'quantum_observed' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  🔍 Quantum - Observed Path
                </button>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Controls</h3>
              <div className="space-y-2">
                <button onClick={() => setIsPlaying(!isPlaying)} className="w-full py-2 px-3 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center gap-2 text-sm">
                  {isPlaying ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
                </button>
                <button onClick={reset} className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 rounded flex items-center justify-center gap-2 text-sm">
                  <RotateCcw size={18} /> Reset
                </button>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Parameters</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1">Slit Distance (d): {slitDistance}px</label>
                  <input type="range" min="40" max="140" value={slitDistance} onChange={(e) => setSlitDistance(Number(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-500 mt-1">↑ d → closer fringes</p>
                </div>
                <div>
                  <label className="block text-xs mb-1">Slit Width (a): {slitWidth}px</label>
                  <input type="range" min="10" max="50" value={slitWidth} onChange={(e) => setSlitWidth(Number(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-500 mt-1">Diffraction spread</p>
                </div>
                <div>
                  <label className="block text-xs mb-1">Wavelength (λ): {wavelength}px</label>
                  <input type="range" min="12" max="40" value={wavelength} onChange={(e) => setWavelength(Number(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-500 mt-1">↑ λ → wider fringes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoubleSlitSimulator;