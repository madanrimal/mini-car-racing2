import React, { useEffect, useState, useRef } from 'react';

interface TouchControlsProps {
  onSteerLeft: (active: boolean) => void;
  onSteerRight: (active: boolean) => void;
  onGas: (active: boolean) => void;
  onBrake: (active: boolean) => void;
  onNitro: (active: boolean) => void;
  nitroCharged: number;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onSteerLeft,
  onSteerRight,
  onGas,
  onBrake,
  onNitro,
  nitroCharged,
}) => {
  const [showInstructions, setShowInstructions] = useState(true);

  // Fade out instruction after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Track active pointer/touch ids
  const activeTouchesRef = useRef<Map<number, { x: number; isLeft: boolean; isRight: boolean }>>(new Map());

  // Function to update steering based on all active touch points
  const updateControls = () => {
    let anyLeft = false;
    let anyRight = false;
    let anyTouch = false;

    activeTouchesRef.current.forEach((t) => {
      anyTouch = true;
      if (t.isLeft) anyLeft = true;
      if (t.isRight) anyRight = true;
    });

    onSteerLeft(anyLeft);
    onSteerRight(anyRight);
    
    // Auto-gas whenever touching the screen!
    onGas(anyTouch);

    // Auto-nitro boost if ready!
    if (anyTouch && nitroCharged >= 30) {
      onNitro(true);
    } else {
      onNitro(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only capture target pointer actions on the main screen area, avoiding UI clicks
    if ((e.target as HTMLElement).closest('button, a, #floating-route-speed, #game-hud-overlay')) {
      return;
    }
    
    const width = window.innerWidth;
    const clickX = e.clientX;
    const pct = clickX / width;

    // Define Left (0 to 45%), Right (55% to 100%), Center/Forward (45% to 55%)
    const isLeft = pct < 0.45;
    const isRight = pct > 0.55;

    activeTouchesRef.current.set(e.pointerId, { x: clickX, isLeft, isRight });
    
    // Request pointer capture safely
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}

    updateControls();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeTouchesRef.current.has(e.pointerId)) return;

    const width = window.innerWidth;
    const clickX = e.clientX;
    const pct = clickX / width;

    const isLeft = pct < 0.45;
    const isRight = pct > 0.55;

    activeTouchesRef.current.set(e.pointerId, { x: clickX, isLeft, isRight });
    updateControls();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activeTouchesRef.current.delete(e.pointerId);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
    updateControls();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    activeTouchesRef.current.delete(e.pointerId);
    updateControls();
  };

  return (
    <div
      className="absolute inset-0 z-10 select-none touch-none pointer-events-auto"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: 'none' }}
    >
      {/* 100% Invisible full-screen interactive overlay */}
      
      {/* Elegantly styled, auto-fading instructions at start of race */}
      {showInstructions && (
        <div className="absolute inset-x-0 bottom-24 flex justify-between px-8 sm:px-16 pointer-events-none transition-opacity duration-1000 animate-pulse">
          <div className="bg-zinc-950/80 backdrop-blur-md border border-cyan-500/20 px-4 py-2 rounded-xl text-cyan-400 font-extrabold text-xs sm:text-sm shadow-lg flex items-center gap-2">
            <span>⬅️</span>
            <span>HOLD LEFT TO TURN LEFT</span>
          </div>
          <div className="bg-zinc-950/80 backdrop-blur-md border border-cyan-500/20 px-4 py-2 rounded-xl text-cyan-400 font-extrabold text-xs sm:text-sm shadow-lg flex items-center gap-2">
            <span>HOLD RIGHT TO TURN RIGHT</span>
            <span>➡️</span>
          </div>
        </div>
      )}
    </div>
  );
};
