import React, { useEffect, useRef, useState } from 'react';
import { Track, CarConfig, Particle, Vector2D, GameStats, TrafficVehicle } from '../types';
import { vecDistance, vecDot, vecNormalize, vecSub, vecAdd, vecScale } from '../utils/math';
import { audio } from '../utils/audio';
import { getCarColorForLevel, getCarAccentForLevel } from '../utils/carColorHelper';

interface GameCanvasProps {
  track: Track;
  car: CarConfig;
  stats: GameStats;
  onUpdateStats: (update: Partial<GameStats>) => void;
  onAddCoins: (amount: number) => void;
  inputs: {
    steerLeft: boolean;
    steerRight: boolean;
    gas: boolean;
    brake: boolean;
    nitro: boolean;
  };
  onNitroActive: (charged: number) => void;
  nitroCharged: number;
  onSpeedUpdate: (speed: number, progress: number, distanceRemaining: number) => void;
  screen: 'menu' | 'playing' | 'shop' | 'gameover' | 'level_completed';
  onLevelCompleted: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  track,
  car,
  stats,
  onUpdateStats,
  onAddCoins,
  inputs,
  onNitroActive,
  nitroCharged,
  onSpeedUpdate,
  screen,
  onLevelCompleted,
}) => {
  const currentLvl = stats.currentLevel || 1;
  const carColor = getCarColorForLevel(currentLvl, car.color);
  const carAccentColor = getCarAccentForLevel(currentLvl, car.accentColor);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Countdown & Lane tracking states & refs
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const countdownRef = useRef<number>(3.99);
  const lastBeepRef = useRef<number>(-1);

  const playerLaneRef = useRef<number>(1);
  const prevLeftActiveRef = useRef<boolean>(false);
  const prevRightActiveRef = useRef<boolean>(false);

  const awardedLife50Ref = useRef<boolean>(false);
  const awardedLife85Ref = useRef<boolean>(false);

  // Core physics states
  const carPosRef = useRef<Vector2D>({ ...track.startPoint });
  const carAngleRef = useRef<number>(track.startAngle);
  const carVelocityRef = useRef<Vector2D>({ x: 0, y: 0 });
  const hasInitializedStartSpeedRef = useRef<boolean>(false);
  const spinAngleRef = useRef<number>(0); // visual spin offset on obstacle collision

  // Hazards & Boost triggers
  const oilTimerRef = useRef<number>(0);
  const boostTimerRef = useRef<number>(0);
  const damageCooldownRef = useRef<number>(0);
  const checkpointTimersRef = useRef<{ [key: number]: boolean }>({});
  
  const isCompletingLevelRef = useRef<boolean>(false);
  const completingLevelTimerRef = useRef<number>(0);
  const [isCompletingLevel, setIsCompletingLevel] = useState<boolean>(false);
  const [showCongrats, setShowCongrats] = useState<boolean>(false);

  // Active track components
  const trackCoinsRef = useRef<any[]>([]);
  const trackObstaclesRef = useRef<any[]>([]);
  const checkpointsRef = useRef<any[]>([]);
  const trafficVehiclesRef = useRef<TrafficVehicle[]>([]);

  // Persistent visual elements (persists slightly across frames)
  const skidMarksRef = useRef<{ p1: Vector2D; p2: Vector2D; alpha: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Smooth camera offsets
  const cameraRef = useRef<Vector2D>({ ...track.startPoint });
  const cameraShakeRef = useRef<number>(0);

  // Time tracker for delta calculations
  const lastTimeRef = useRef<number>(0);

  // Initialize/Sync current track details
  useEffect(() => {
    carPosRef.current = { ...track.startPoint };
    carAngleRef.current = track.startAngle;
    carVelocityRef.current = { x: 0, y: 0 };
    cameraShakeRef.current = 0; // Clear any residual camera shakes/rumble!
    hasInitializedStartSpeedRef.current = false;
    spinAngleRef.current = 0;
    oilTimerRef.current = 0;
    boostTimerRef.current = 0;
    isCompletingLevelRef.current = false;
    completingLevelTimerRef.current = 0;
    awardedLife50Ref.current = false;
    awardedLife85Ref.current = false;
    setIsCompletingLevel(false);
    setShowCongrats(false);

    // Reset countdown & lane change values
    countdownRef.current = 3.99;
    lastBeepRef.current = -1;
    playerLaneRef.current = 1;
    prevLeftActiveRef.current = false;
    prevRightActiveRef.current = false;
    setCountdownText(null);

    // Deep copy track items so they reset correctly on new generation
    trackCoinsRef.current = track.coins.map(c => ({ ...c }));
    const hasSpecialLife = trackCoinsRef.current.some(c => c.isLifeControl);
    const normalCoins = trackCoinsRef.current.filter(c => !c.isLifeControl);
    if (normalCoins.length >= 2) {
      const idx1 = Math.floor(normalCoins.length * 0.33);
      const idx2 = Math.floor(normalCoins.length * 0.66);
      normalCoins[idx1].isTimeControl = true;
      normalCoins[idx1].timeStyle = 1;
      normalCoins[idx2].isTimeControl = true;
      normalCoins[idx2].timeStyle = 2;
    }
    if (!hasSpecialLife && trackCoinsRef.current.length >= 1) {
      trackCoinsRef.current[Math.floor(trackCoinsRef.current.length / 2)].isLifeControl = true;
    }
    const currentLvl = stats.currentLevel || 1;
    // Except cars, trucks and bikes, don't put any other distractions or hitting things on the road
    trackObstaclesRef.current = [];
    checkpointsRef.current = track.checkpoints.map(cp => ({ ...cp, passed: false }));

    // Generate traffic vehicles distributed along the highway
    const vehicles: TrafficVehicle[] = [];
    const trafficCount = 32; // Set to 32 to add a little bit more vehicles in the road (not too many) as requested!
    const colors = ['#3b82f6', '#10b981', '#ef4444', '#ec4899', '#8b5cf6', '#0ea5e9', '#64748b', '#a855f7', '#06b6d4', '#f97316'];
    const types: ('sedan' | 'truck' | 'sport' | 'taxi' | 'motorbike')[] = ['sedan', 'truck', 'sport', 'taxi', 'motorbike'];
    
    const laneWidth = track.width * 0.28;
    const laneOffsets = [-laneWidth, 0, laneWidth];

    const startCheckpointY = track.startPoint.y; // 1000
    const finishY = track.checkpoints[3]?.pos.y ?? -15632;
    const totalTrackDistance = startCheckpointY - finishY;
    
    // Position vehicles at least 1000px ahead of the start point so only player is visible at start
    const trafficStartBound = startCheckpointY - 1000; // e.g. 0
    const trafficEndBound = finishY + 500;
    const trafficSpan = trafficStartBound - trafficEndBound;

    for (let i = 0; i < trafficCount; i++) {
      const section = trafficSpan / trafficCount;
      const startY = trafficStartBound - (i * section) - (Math.random() * (section * 0.4));
      const lane = Math.floor(Math.random() * 3);

      // All traffic vehicles are sports racing cars similar-looking to the player's car
      const type = 'sport';
      const width = 20;
      const height = 31;

      // Speed variations for exciting and dynamic passing gameplay
      let speed = 80 + Math.random() * 35; // slow/heavy racer
      if (i % 3 === 1) {
        speed = 125 + Math.random() * 35; // medium racer
      } else if (i % 3 === 2) {
        speed = 165 + Math.random() * 45; // fast racer
      }

      vehicles.push({
        id: `traffic_${i}`,
        x: laneOffsets[lane],
        y: startY,
        lane,
        speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        type,
        width,
        height,
        laneChangeTimer: 2 + Math.random() * 5,
        targetLane: lane,
      });
    }
    trafficVehiclesRef.current = vehicles;

    skidMarksRef.current = [];
    particlesRef.current = [];
    const canvas = canvasRef.current;
    const h = canvas ? canvas.height : 600;
    cameraRef.current = { x: track.startPoint.x, y: track.startPoint.y - h * 0.12 };
    lastTimeRef.current = 0;
  }, [track, stats.currentLevel, screen]);

  // Handle key listeners for Keyboard triggers
  const localKeysRef = useRef<{ [key: string]: boolean }>({});
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'playing') return;
      const key = e.key.toLowerCase();
      const code = e.code;
      let matched = false;

      if (['w', 'arrowup'].includes(key) || ['KeyW', 'ArrowUp'].includes(code)) {
        localKeysRef.current['gas'] = true;
        matched = true;
      }
      if (['s', 'arrowdown'].includes(key) || ['KeyS', 'ArrowDown'].includes(code)) {
        localKeysRef.current['brake'] = true;
        matched = true;
      }
      if (['a', 'arrowleft'].includes(key) || ['KeyA', 'ArrowLeft'].includes(code)) {
        localKeysRef.current['left'] = true;
        matched = true;
      }
      if (['d', 'arrowright'].includes(key) || ['KeyD', 'ArrowRight'].includes(code)) {
        localKeysRef.current['right'] = true;
        matched = true;
      }
      if (code === 'Space' || key === ' ') {
        localKeysRef.current['nitro'] = true;
        matched = true;
      }

      if (matched) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;
      let matched = false;

      if (['w', 'arrowup'].includes(key) || ['KeyW', 'ArrowUp'].includes(code)) {
        localKeysRef.current['gas'] = false;
        matched = true;
      }
      if (['s', 'arrowdown'].includes(key) || ['KeyS', 'ArrowDown'].includes(code)) {
        localKeysRef.current['brake'] = false;
        matched = true;
      }
      if (['a', 'arrowleft'].includes(key) || ['KeyA', 'ArrowLeft'].includes(code)) {
        localKeysRef.current['left'] = false;
        matched = true;
      }
      if (['d', 'arrowright'].includes(key) || ['KeyD', 'ArrowRight'].includes(code)) {
        localKeysRef.current['right'] = false;
        matched = true;
      }
      if (code === 'Space' || key === ' ') {
        localKeysRef.current['nitro'] = false;
        matched = true;
      }

      if (matched) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [screen]);

  // Main high-performance Game Update & Render Loop
  useEffect(() => {
    let animId: number;

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      let dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // Cap dt to prevent massive simulation jumps on lag spikes
      if (dt > 0.1) dt = 0.1;

      if (screen === 'playing' && !stats.isGameOver && !stats.isWon) {
        // Handle countdown phase
        if (countdownRef.current > 0) {
          audio.stopEngine(); // Keep engine off during countdown!
          countdownRef.current -= dt;
          const ceilVal = Math.ceil(countdownRef.current);
          
          if (ceilVal !== lastBeepRef.current) {
            lastBeepRef.current = ceilVal;
            if (ceilVal >= 1) {
              audio.playCountdownBeep(false); // standard tick beep
            } else if (ceilVal === 0) {
              audio.playCountdownBeep(true); // high pitch GO beep
            }
          }

          if (countdownRef.current > 0) {
            setCountdownText(String(ceilVal));
          } else {
            setCountdownText("GO!");
          }
        } else {
          if (!hasInitializedStartSpeedRef.current) {
            hasInitializedStartSpeedRef.current = true;
            const startSpeedPhysical = 100 * 3.5;
            carVelocityRef.current = {
              x: Math.cos(carAngleRef.current) * startSpeedPhysical,
              y: Math.sin(carAngleRef.current) * startSpeedPhysical
            };
          }
          if (countdownText !== null && countdownRef.current <= -0.8) {
            setCountdownText(null);
          } else if (countdownRef.current > -0.8) {
            countdownRef.current -= dt;
          }
          updatePhysics(dt);
          updateTimer(dt);
        }
      } else if (screen === 'menu') {
        // Gentle background simulation drive (attract mode)
        const cruiseSpeed = 160; // physical pixels per second
        carPosRef.current.y -= cruiseSpeed * dt;

        // Make the car gently steer left/right in waves for organic motion
        const timeFactor = timestamp / 1500;
        const laneW = track.width * 0.28;
        carPosRef.current.x = Math.sin(timeFactor) * laneW * 0.8;
        carAngleRef.current = -Math.PI / 2 + Math.cos(timeFactor) * 0.15;

        // Endless road wrapping
        const startY = track.startPoint.y;
        const finishY = track.checkpoints[3]?.pos.y ?? -15632;
        if (carPosRef.current.y < finishY + 500) {
          const diff = startY - carPosRef.current.y;
          carPosRef.current.y = startY;
          trafficVehiclesRef.current.forEach(veh => {
            veh.y += diff;
          });
        }

        // Animate traffic vehicles in the menu!
        trafficVehiclesRef.current.forEach(veh => {
          veh.y -= veh.speed * dt;

          // Gentle lane changing for traffic vehicles on menu screen
          veh.laneChangeTimer -= dt;
          if (veh.laneChangeTimer <= 0) {
            const change = Math.random() < 0.5 ? -1 : 1;
            veh.targetLane = Math.max(0, Math.min(2, veh.lane + change));
            veh.laneChangeTimer = 3 + Math.random() * 4;
          }

          // Smooth slide to target lane
          const targetX = [-laneW, 0, laneW][veh.targetLane];
          const diffX = targetX - veh.x;
          if (Math.abs(diffX) > 1) {
            veh.x += Math.sign(diffX) * 60 * dt;
          } else {
            veh.lane = veh.targetLane;
            veh.x = targetX;
          }

          // Wrap traffic around player's position
          const relativeY = veh.y - carPosRef.current.y;
          if (relativeY < -400) {
            veh.y = carPosRef.current.y - (300 + Math.random() * 500);
            veh.lane = Math.floor(Math.random() * 3);
            veh.targetLane = veh.lane;
            veh.x = [-laneW, 0, laneW][veh.lane];
          } else if (relativeY > 800) {
            veh.y = carPosRef.current.y + (100 + Math.random() * 300);
            veh.lane = Math.floor(Math.random() * 3);
            veh.targetLane = veh.lane;
            veh.x = [-laneW, 0, laneW][veh.lane];
          }
        });

        // Set camera to follow
        const canvas = canvasRef.current;
        const h = canvas ? canvas.height : 600;
        cameraRef.current.y = carPosRef.current.y - h * 0.36;
        cameraRef.current.x = track.startPoint.x;
      }

      renderGame();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [screen, track, car, stats, inputs, nitroCharged]);

  // Physics Calculations
  const updatePhysics = (dt: number) => {
    const pos = carPosRef.current;
    let angle = carAngleRef.current;
    const velocity = carVelocityRef.current;

    if (damageCooldownRef.current > 0) {
      damageCooldownRef.current -= dt;
    }

    const handleTakeDamage = () => {
      if (damageCooldownRef.current > 0) return;
      damageCooldownRef.current = 1.5; // 1.5s invincibility/cooldown
      const currentLives = stats.lives ?? 3;
      const nextLives = Math.max(0, currentLives - 1);
      if (nextLives <= 0) {
        onUpdateStats({ lives: 0, isGameOver: true });
        audio.stopEngine();
      } else {
        onUpdateStats({ lives: nextLives });
      }
    };

    // 1. Force gasInput to true so the car moves automatically forward once started!
    // Ignore brakeInput, only steerLeft and steerRight are active.
    const gasInput = !isCompletingLevelRef.current;
    const brakeInput = isCompletingLevelRef.current;
    const leftInput = !isCompletingLevelRef.current && (inputs.steerLeft || localKeysRef.current['left']);
    const rightInput = !isCompletingLevelRef.current && (inputs.steerRight || localKeysRef.current['right']);
    // Re-enable forward key (gas) so player can manually increase speed when they want to!
    const manualGasPressed = !isCompletingLevelRef.current && (inputs.gas || localKeysRef.current['gas']);
    const nitroInput = !isCompletingLevelRef.current && (inputs.nitro || localKeysRef.current['nitro']) && nitroCharged >= 30;

    // Discrete edge-triggered lane change check
    const leftClicked = leftInput && !prevLeftActiveRef.current;
    const rightClicked = rightInput && !prevRightActiveRef.current;
    prevLeftActiveRef.current = !!leftInput;
    prevRightActiveRef.current = !!rightInput;

    if (leftClicked && !isCompletingLevelRef.current) {
      playerLaneRef.current = Math.max(0, playerLaneRef.current - 1);
    }
    if (rightClicked && !isCompletingLevelRef.current) {
      playerLaneRef.current = Math.min(2, playerLaneRef.current + 1);
    }

    const laneWidth = track.width * 0.28;
    const laneOffsets = [-laneWidth, 0, laneWidth];
    const targetX = laneOffsets[playerLaneRef.current];

    // Smoothly interpolate pos.x towards the target lane
    pos.x += (targetX - pos.x) * 11.5 * dt;

    // Strict road boundary clamping to satisfy "car should not go out of road"
    const maxRoadOffset = track.width / 2 - 10;
    pos.x = Math.max(-maxRoadOffset, Math.min(maxRoadOffset, pos.x));

    // Dynamic visual tilt angle proportional to horizontal sliding speed
    const lateralSpeed = (targetX - pos.x) * 11.5;
    const tiltAngle = lateralSpeed * 0.0016;
    angle = -Math.PI / 2 + tiltAngle;

    // Reduce timers
    if (oilTimerRef.current > 0) oilTimerRef.current -= dt;
    if (boostTimerRef.current > 0) boostTimerRef.current -= dt;

    const onOil = oilTimerRef.current > 0;
    const isBoosting = boostTimerRef.current > 0 || nitroInput;

    if (nitroInput) {
      // Burn nitro charge
      onNitroActive(Math.max(0, nitroCharged - 60 * dt));
    }

    // 2. Identify off-track (on grass) penalty
    // Since the straight track centerline is perfectly aligned with X = 0:
    const minDist = Math.abs(pos.x);
    let onGrass = false;
    if (minDist > track.width / 2) {
      onGrass = true;
    }

    // 3. Setup dynamic limits based on status
    // Speed dynamic limits based on track length
    const startY = track.startPoint.y; // 1000
    const finishY = track.checkpoints[3]?.pos.y ?? -15632;
    const totalTrackDistance = startY - finishY;
    const distanceTraveled = Math.max(0, startY - pos.y);
    const progress = Math.min(1.0, distanceTraveled / totalTrackDistance);

    // Auto-award 1 life when reaching 50% progress, and 1 life when reaching 85% progress
    if (progress >= 0.50 && !awardedLife50Ref.current) {
      awardedLife50Ref.current = true;
      const currentLives = stats.lives ?? 0;
      const nextLives = Math.min(stats.maxLives ?? 3, currentLives + 1);
      onUpdateStats({
        lives: nextLives,
        score: stats.score + 500,
      });
      audio.playCheckpointSound();
    }
    if (progress >= 0.85 && !awardedLife85Ref.current) {
      awardedLife85Ref.current = true;
      const currentLives = stats.lives ?? 0;
      const nextLives = Math.min(stats.maxLives ?? 3, currentLives + 1);
      onUpdateStats({
        lives: nextLives,
        score: stats.score + 500,
      });
      audio.playCheckpointSound();
    }

    // Speed increases slowly slowly as car moves forward
    const baseStartSpeed = 100 + car.upgrades.speed * 3.5; // Starts directly at 100 KM/H
    let maxSpeedKMH = Math.min(200, baseStartSpeed + progress * (200 - baseStartSpeed));

    // "you can increase the speed pressing forward key when you need to"
    if (manualGasPressed) {
      maxSpeedKMH = Math.min(200, maxSpeedKMH + 30); // Capped at 200 KM/H maximum when pressing forward!
    }

    let targetMaxSpeed = maxSpeedKMH * 3.5; // Convert to internal physical speed

    // "speed should increase slowly slowly as car move forward"
    // Scale up the player car acceleration rate so the speed builds up beautifully
    let acceleration = (car.baseAcceleration + car.upgrades.acceleration * 15) * 0.35;

    if (manualGasPressed) {
      acceleration *= 2.5; // accelerate even faster when manual forward gas is pressed!
    }

    if (onGrass) {
      // No grass penalty! Keep running forward at full speed!
    }

    if (isBoosting) {
      // nitro boost can exceed normal max speed but is capped at 230 KM/H (physical speed 805)
      targetMaxSpeed = Math.min(805, targetMaxSpeed * 1.25);
      acceleration *= 1.8;
    }

    // Ensure physical speed never exceeds 230 KM/H (physical speed 805)
    if (targetMaxSpeed > 805) {
      targetMaxSpeed = 805;
    }

    // 4. Calculate Vector Longitudinal forces (thrust, drag, rolling friction)
    const headingX = Math.cos(angle);
    const headingY = Math.sin(angle);
    const rightX = -Math.sin(angle);
    const rightY = Math.cos(angle);

    // Project velocity vector onto heading & side axis
    const fVel = velocity.x * headingX + velocity.y * headingY;
    const lVel = velocity.x * rightX + velocity.y * rightY;

    let acc = 0;
    if (gasInput) {
      acc = acceleration;
    } else if (brakeInput) {
      acc = -acceleration * 1.5; // strong deceleration
    }

    // Roll-back braking or passive engine braking
    let newFVel = fVel + acc * dt;
    const passiveDecel = onGrass ? 100 : 70;

    if (!gasInput && !brakeInput) {
      if (newFVel > 0) newFVel = Math.max(0, newFVel - passiveDecel * dt);
      else if (newFVel < 0) newFVel = Math.min(0, newFVel + passiveDecel * dt);
    }

    // Speed caps
    if (newFVel > targetMaxSpeed) {
      newFVel = Math.max(targetMaxSpeed, newFVel - 250 * dt);
    } else if (newFVel < -targetMaxSpeed * 0.3) {
      newFVel = -targetMaxSpeed * 0.3;
    }

    // 5. Calculate Lateral forces (side grip & drifting slides)
    const gripBase = car.baseGrip + car.upgrades.grip * 0.025;
    const activeGrip = onOil ? 0.04 : (onGrass ? 0.45 : gripBase);

    // Drift activation: side slip exceeds drift limits at velocity
    const driftThreshold = onGrass ? 100 : 160;
    const isDrifting = Math.abs(lVel) > driftThreshold && fVel > 130 && !onOil && !onGrass;

    let gripMultiplier = isDrifting ? car.driftFactor : 1.0;
    const lateralFriction = activeGrip * gripMultiplier;

    // Apply lateral damping (car attempts to snap velocity to heading)
    const newLVel = lVel * Math.max(0, 1 - (lateralFriction * 9.5 * dt));

    // Reconstruct 2D velocity vector
    velocity.x = headingX * newFVel + rightX * newLVel;
    velocity.y = headingY * newFVel + rightY * newLVel;

    // visual recovery spin
    if (spinAngleRef.current > 0) {
      spinAngleRef.current = Math.max(0, spinAngleRef.current - 4 * Math.PI * dt);
    }

    // Apply final translation
    // If we have crash horizontal speed from side crashes, apply it and decay it rapidly
    if (Math.abs(velocity.x) > 5) {
      pos.x += velocity.x * dt;
      velocity.x *= Math.max(0, 1 - 10 * dt);
    }

    pos.y += velocity.y * dt;
    carAngleRef.current = angle;

    // Update Speedometer and Route Progress Tracker
    const currentSpeedScalar = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    onSpeedUpdate(currentSpeedScalar, progress, Math.max(0, totalTrackDistance - distanceTraveled));

    // Sync Audio Engine pitches
    const maxPossSpeed = 1000;
    const speedRatio = Math.min(1, currentSpeedScalar / maxPossSpeed);
    audio.setEngineRPM(speedRatio, isDrifting, isBoosting);

    // 7. Spawning drift skids & tire visual particles
    if (isDrifting && Math.random() < 0.8) {
      // Spawn persistent skids from both wheels (left and right offsets)
      const wheelOffset = 12;
      const leftWheel = vecAdd(pos, vecScale({ x: rightX, y: rightY }, -wheelOffset));
      const rightWheel = vecAdd(pos, vecScale({ x: rightX, y: rightY }, wheelOffset));

      const lastSkid = skidMarksRef.current[skidMarksRef.current.length - 1];
      if (lastSkid) {
        skidMarksRef.current.push({ p1: { ...leftWheel }, p2: { ...leftWheel }, alpha: 0.65 });
        skidMarksRef.current.push({ p1: { ...rightWheel }, p2: { ...rightWheel }, alpha: 0.65 });
      }

      // Add to Nitro tank as drift reward!
      onNitroActive(Math.min(100, nitroCharged + 1.2));

      // Drift exhaust sparks!
      for (let s = 0; s < 2; s++) {
        particlesRef.current.push({
          id: Math.random().toString(),
          x: pos.x - headingX * 18 + (Math.random() * 2 - 1) * 6,
          y: pos.y - headingY * 18 + (Math.random() * 2 - 1) * 6,
          vx: -velocity.x * 0.4 + (Math.random() * 2 - 1) * 50,
          vy: -velocity.y * 0.4 + (Math.random() * 2 - 1) * 50,
          color: s === 0 ? 'rgba(251, 191, 36, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          alpha: 1,
          size: 1.5 + Math.random() * 2.5,
          life: 0,
          maxLife: 0.25 + Math.random() * 0.3,
          type: 'spark',
        });
      }
    }

    // Tire smoke puff (spawn slightly at speed or on grass)
    if ((isDrifting || onGrass) && Math.random() < 0.4) {
      particlesRef.current.push({
        id: Math.random().toString(),
        x: pos.x - headingX * 16,
        y: pos.y - headingY * 16,
        vx: -velocity.x * 0.2 + (Math.random() * 2 - 1) * 15,
        vy: -velocity.y * 0.2 + (Math.random() * 2 - 1) * 15,
        color: onGrass ? 'rgba(101, 163, 13, 0.45)' : 'rgba(228, 228, 231, 0.4)',
        alpha: 0.8,
        size: 5 + Math.random() * 10,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.6,
        type: 'smoke',
      });
    }

    // Speed streaks on Nitro Boost
    if (isBoosting && Math.random() < 0.6) {
      particlesRef.current.push({
        id: Math.random().toString(),
        x: pos.x - headingX * 22 + (Math.random() * 2 - 1) * 35,
        y: pos.y - headingY * 22 + (Math.random() * 2 - 1) * 35,
        vx: -headingX * (200 + Math.random() * 100),
        vy: -headingY * (200 + Math.random() * 100),
        color: 'rgba(56, 189, 248, 0.8)',
        alpha: 0.85,
        size: 1.5,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.3,
        type: 'smoke',
      });
    }

    // 8. Item & Obstacle collision sweeps
    // Coin picking
    const playerRadius = 15;
    trackCoinsRef.current.forEach(coin => {
      if (!coin.collected && vecDistance(pos, coin.pos) < playerRadius + 14) {
        coin.collected = true;
        if (coin.isTimeControl) {
          onUpdateStats({
            timeRemaining: Math.min(120, stats.timeRemaining + 18),
            score: stats.score + 250,
          });
          audio.playCheckpointSound();
        } else if (coin.isLifeControl) {
          const currentLives = stats.lives ?? 0;
          const nextLives = Math.min(stats.maxLives ?? 3, currentLives + 1);
          onUpdateStats({
            lives: nextLives,
            score: stats.score + 200,
          });
          audio.playCheckpointSound();
        } else {
          onAddCoins(1); // 1 coin per pickup
          onUpdateStats({ coinsCollected: stats.coinsCollected + 1, score: stats.score + 50 });
          audio.playCoinSound();
        }
      }
    });

    // Obstacle triggers
    trackObstaclesRef.current.forEach(obs => {
      const dist = vecDistance(pos, obs.pos);
      if (dist < playerRadius + obs.radius) {
        if (obs.type === 'boost') {
          // Glow boost pad trigger!
          boostTimerRef.current = 1.0; // 1 second massive boost
          onNitroActive(Math.min(100, nitroCharged + 12));
          audio.playBoostSound();
          // Remove boost node visually or flicker it
          obs.radius = 0; // effectively consume
          setTimeout(() => { obs.radius = 24; }, 4000); // respawn pad in 4 seconds
        } else if (obs.type === 'oil') {
          // Slide hazard spin!
          if (oilTimerRef.current <= 0) {
            oilTimerRef.current = 1.6;
            audio.playCrashSound();
            spinAngleRef.current = Math.PI * 1.5; // Visual spin-out
          }
        } else if (obs.type === 'cone' && obs.radius > 0) {
          // Cone collision - no speed deceleration penalty!
          spinAngleRef.current = Math.PI * 0.3;
          audio.playCrashSound();
          cameraShakeRef.current = 10;
          obs.radius = 0; // knock cone over
          handleTakeDamage();
        } else if (obs.type === 'barrier' && obs.radius > 0) {
          // Barrier collision - no speed deceleration penalty!
          spinAngleRef.current = Math.PI * 0.4;
          audio.playCrashSound();
          cameraShakeRef.current = 22;
          obs.radius = 0; // smash barrier
          handleTakeDamage();
        }
      }
    });

    // 8.5 Update Traffic Vehicles and Check Collisions
    const laneW = track.width * 0.28;
    const laneOffs = [-laneW, 0, laneW];
    const pW = 18;
    const pH = 29;

    const currentLvl = stats.currentLevel || 1;

    trafficVehiclesRef.current.forEach(veh => {
      // 1. Move traffic cars up
      veh.y -= veh.speed * dt;

      // 2. Wrap traffic cars around when they go past the finish line (with a bit of buffer)
      if (veh.y < finishY - 500) {
        veh.y = 1000 + Math.random() * 500;
        veh.lane = Math.floor(Math.random() * 3);
        veh.targetLane = veh.lane;
        veh.x = laneOffs[veh.lane];
      }

      // 3. Lane change AI behavior (Disabled in 1st and 2nd laps for easier play)
      veh.laneChangeTimer -= dt;
      if (currentLvl > 2) {
        if (veh.laneChangeTimer <= 0) {
          const change = Math.random() < 0.5 ? -1 : 1;
          const newLane = Math.max(0, Math.min(2, veh.lane + change));
          veh.targetLane = newLane;
          veh.laneChangeTimer = 4 + Math.random() * 6; // reset check timer
        }
      } else {
        // Keep them strictly in their lane in Lap 1 & Lap 2
        veh.targetLane = veh.lane;
      }

      // 4. Smooth lateral sliding to target lane
      const targetX = laneOffs[veh.targetLane];
      const diffX = targetX - veh.x;
      if (Math.abs(diffX) > 1) {
        veh.x += Math.sign(diffX) * 55 * dt; // slide at 55 px/s
        if (Math.abs(targetX - veh.x) < 3) {
          veh.lane = veh.targetLane;
          veh.x = targetX;
        }
      }

      // 5. Box AABB Collision with player car
      const halfW_player = pW / 2;
      const halfH_player = pH / 2;
      const halfW_traffic = veh.width / 2;
      const halfH_traffic = veh.height / 2;

      const overlapX = Math.abs(pos.x - veh.x) < (halfW_player + halfW_traffic - 1.5);
      const overlapY = Math.abs(pos.y - veh.y) < (halfH_player + halfH_traffic - 1.5);

      if (overlapX && overlapY) {
        // Crash audio and camera rumble
        audio.playCrashSound();
        cameraShakeRef.current = 14;
        handleTakeDamage();

        // Repositioning and momentum transfer physics
        const dx = pos.x - veh.x;
        const dy = pos.y - veh.y;

        if (Math.abs(dx) > Math.abs(dy)) {
          // Side Swipe collision: bounce horizontally, but do not slow down forward velocity
          pos.x += Math.sign(dx) * 12;
          velocity.x = Math.sign(dx) * 160;
          veh.x -= Math.sign(dx) * 8;
        } else {
          // Rear or front-end hit: push player slightly to the side to slide past smoothly without slowing down
          const pushDirection = dx !== 0 ? Math.sign(dx) : (pos.x > 0 ? -1 : 1);
          pos.x += pushDirection * 15;
          velocity.x = pushDirection * 120;
          veh.speed += 90; // push the civilian car forward
        }

        // Add fun recovery visual spin without slowing down
        spinAngleRef.current = Math.PI * 0.3;

        // Crash sparks!
        for (let s = 0; s < 5; s++) {
          particlesRef.current.push({
            id: Math.random().toString(),
            x: (pos.x + veh.x) / 2 + (Math.random() * 2 - 1) * 4,
            y: (pos.y + veh.y) / 2 + (Math.random() * 2 - 1) * 4,
            vx: (Math.random() * 2 - 1) * 160,
            vy: (Math.random() * 2 - 1) * 160,
            color: '#ef4444',
            alpha: 1,
            size: 2 + Math.random() * 2.5,
            life: 0,
            maxLife: 0.25 + Math.random() * 0.25,
            type: 'spark',
          });
        }
      }
    });

    // 9. Checkpoint & Lap processing
    checkpointsRef.current.forEach((cp, idx) => {
      if (!cp.passed) {
        // Evaluate if passing checkpoint line
        const d = vecDistance(pos, cp.pos);
        if (d < track.width / 2 + 10) {
          // Check if previous checkpoint was passed to force direction integrity
          const prevIdx = (idx - 1 + 4) % 4;
          const prevCp = checkpointsRef.current[prevIdx];
          // Allow passing first checkpoint (idx 0) or checking order sequence
          if (idx === 0 || prevCp.passed) {
            cp.passed = true;
            onUpdateStats({
              currentCheckpoint: idx,
              timeRemaining: Math.min(120, stats.timeRemaining + 18.0), // add +18s checkpoint limit (increased by 8s)
              score: stats.score + 200,
            });
            audio.playCheckpointSound();
          }
        }
      }
    });

    // Ticking level completion timer
    if (isCompletingLevelRef.current) {
      completingLevelTimerRef.current -= dt;
      
      // Delay congratulations overlay so the player sees the car cross and decelerate first
      if (completingLevelTimerRef.current <= 2.5) {
        setShowCongrats(true);
      }

      // Spawn extra celebratory particles!
      if (Math.random() < 0.25) {
        const colors = ['#facc15', '#f43f5e', '#10b981', '#3b82f6', '#a855f7', '#ff7849'];
        particlesRef.current.push({
          id: Math.random().toString(),
          x: pos.x + (Math.random() - 0.5) * 60,
          y: pos.y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 140,
          vy: -Math.random() * 100 - 80,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          size: 3 + Math.random() * 3.5,
          life: 0,
          maxLife: 1.2 + Math.random() * 1.2,
          type: 'spark',
        });
      }

      if (completingLevelTimerRef.current <= 0) {
        isCompletingLevelRef.current = false;
        setIsCompletingLevel(false);
        setShowCongrats(false);
        checkpointsRef.current.forEach(cp => cp.passed = false);
        if (onLevelCompleted) {
          onLevelCompleted();
        }
      }
    }

    // Check Finish/Start Line crossing
    const finishCP = checkpointsRef.current[3];
    if (finishCP && finishCP.passed && !isCompletingLevelRef.current) {
      isCompletingLevelRef.current = true;
      completingLevelTimerRef.current = 4.0; // 4 seconds total completion time
      setIsCompletingLevel(true);
      setShowCongrats(false); // start false: car first crosses checkpoint visually
      audio.playCheckpointSound();
      
      // Spawn a huge splash of celebratory colored confetti!
      for (let i = 0; i < 90; i++) {
        const randAngle = Math.random() * Math.PI * 2;
        const randSpeed = 140 + Math.random() * 220;
        const colors = ['#facc15', '#f43f5e', '#10b981', '#3b82f6', '#a855f7', '#ff7849'];
        particlesRef.current.push({
          id: Math.random().toString(),
          x: pos.x + (Math.random() - 0.5) * 60,
          y: pos.y + (Math.random() - 0.5) * 40,
          vx: Math.cos(randAngle) * randSpeed,
          vy: Math.sin(randAngle) * randSpeed,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          size: 3 + Math.random() * 4,
          life: 0,
          maxLife: 1.5 + Math.random() * 2.0,
          type: 'spark',
        });
      }
    }

    // 10. Process active visuals (fading skids & decaying particles)
    particlesRef.current.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    });
    // Cleanup expired particles
    particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);

    // Decay skids slowly so track doesn't build heavy memory leaks
    skidMarksRef.current.forEach(s => {
      s.alpha -= 0.012 * dt;
    });
    if (skidMarksRef.current.length > 350) {
      skidMarksRef.current.splice(0, skidMarksRef.current.length - 350);
    }
    skidMarksRef.current = skidMarksRef.current.filter(s => s.alpha > 0.05);

    // Smooth panning camera with bounds-free vector follow
    // Project camera target further ahead as forward speed increases, keeping car at the bottom
    const canvas = canvasRef.current;
    const h = canvas ? canvas.height : 600;
    // Lock camera X to track center so background does not slide left/right when changing lanes!
    const targetCamX = track.startPoint.x;
    
    // Y-velocity is negative when going forward (towards negative Y)
    const forwardSpeed = Math.max(0, -carVelocityRef.current.y);
    
    // Position the starting road point / car closer to the bottom edge.
    // At rest (speed = 0), the car is positioned at 86% of screen height (h * 0.36 offset from center).
    // As the speed increases, we look ahead further up to h * 0.42 offset (placing the car at 92% screen height),
    // giving the user a great view of the track while keeping the car near the bottom of the screen.
    const maxLookAheadSpeed = 500;
    const camSpeedRatio = Math.min(1, forwardSpeed / maxLookAheadSpeed);
    const lookAhead = h * (0.36 + camSpeedRatio * 0.06);
    const targetCamY = pos.y - lookAhead;

    cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.15;
    cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.15;

    // Camera rumble / Shake decay (Strictly lock shake to 0 during countdown to prevent any start buzzing)
    if (countdownRef.current > -0.8) {
      cameraShakeRef.current = 0;
    } else if (cameraShakeRef.current > 0) {
      cameraShakeRef.current = Math.max(0, cameraShakeRef.current - 40 * dt);
    }
  };

  const updateTimer = (dt: number) => {
    const nextTime = stats.timeRemaining - dt;
    if (nextTime <= 0) {
      onUpdateStats({ timeRemaining: 0, isGameOver: true });
      audio.stopEngine();
    } else {
      onUpdateStats({ timeRemaining: nextTime });
    }
  };

  // Rendering Functions
  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, w, h);

    // Coordinate space panning relative to car-follow camera center
    ctx.save();

    // Apply Camera Shake
    let shakeX = 0;
    let shakeY = 0;
    if (cameraShakeRef.current > 0) {
      shakeX = (Math.random() * 2 - 1) * cameraShakeRef.current;
      shakeY = (Math.random() * 2 - 1) * cameraShakeRef.current;
    }

    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

    // 1. Draw Ground Terrain (Grass/Sand/Cyber with soft grid lines to show movement relative to camera)
    const viewLeft = cameraRef.current.x - w / 2 - 100;
    const viewRight = cameraRef.current.x + w / 2 + 100;
    const viewTop = cameraRef.current.y - h / 2 - 100;
    const viewBottom = cameraRef.current.y + h / 2 + 100;

    const lvl = stats.currentLevel || 1;

    // Define color mappings for the 10 level environments
    let terrainColor = '#14532d'; // Level 1 green default
    let gridColor = '#15803d';

    if (lvl === 2) {
      terrainColor = '#090d16'; // Midnight New York Blue
      gridColor = '#1e3a8a'; // Neon blue
    } else if (lvl === 3) {
      terrainColor = '#111827'; // Cyber Midnight slate-900
      gridColor = '#4f46e5';
    } else if (lvl === 4) {
      terrainColor = '#f1f5f9'; // Snow Slate
      gridColor = '#cbd5e1';
    } else if (lvl === 5) {
      terrainColor = '#1c1917'; // Volcanic Dark Ash
      gridColor = '#dc2626';
    } else if (lvl === 6) {
      terrainColor = '#7c2d12'; // Autumn Maple Brown
      gridColor = '#9a3412';
    } else if (lvl === 7) {
      terrainColor = '#0f172a'; // Ocean beach sand
      gridColor = '#1e293b';
    } else if (lvl === 8) {
      terrainColor = '#4c0519'; // Sakura dark rose
      gridColor = '#be185d';
    } else if (lvl === 9) {
      terrainColor = '#1e1b4b'; // Storm indigo
      gridColor = '#312e81';
    } else if (lvl === 10) {
      terrainColor = '#030712'; // Cosmic Space
      gridColor = '#ec4899';
    }

    ctx.fillStyle = terrainColor;
    ctx.fillRect(viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);

    // Soft checker grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1.0;
    const gridSize = 160;
    const startGridX = Math.floor(viewLeft / gridSize) * gridSize;
    const startGridY = Math.floor(viewTop / gridSize) * gridSize;

    for (let gx = startGridX; gx < viewRight; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, viewTop);
      ctx.lineTo(gx, viewBottom);
      ctx.stroke();
    }
    for (let gy = startGridY; gy < viewBottom; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(viewLeft, gy);
      ctx.lineTo(viewRight, gy);
      ctx.stroke();
    }

    // 1.5 Draw Lakes and Rivers outside the road
    ctx.save();
    // Deterministic water color based on current environment
    let waterColor = '#0284c7'; // deep blue
    let waterShoreColor = '#38bdf8'; // light blue
    let waterRippleColor = '#e0f2fe'; // white-blue

    if (lvl === 2) {
      waterColor = '#1e293b'; // Hudson river deep blue
      waterShoreColor = '#3b82f6'; // Bright electric blue shore
      waterRippleColor = '#93c5fd'; // Cool blue ripples
    } else if (lvl === 3) {
      waterColor = '#1e1b4b'; // Cyber Neon Indigo
      waterShoreColor = '#6366f1';
      waterRippleColor = '#a5b4fc';
    } else if (lvl === 4) {
      waterColor = '#bae6fd'; // Ice Blue
      waterShoreColor = '#f1f5f9';
      waterRippleColor = '#ffffff';
    } else if (lvl === 5) {
      waterColor = '#450a0a'; // Dark Lava Red (no yellow!)
      waterShoreColor = '#991b1b'; // Crimson
      waterRippleColor = '#ef4444'; // Bright Lava Red
    } else if (lvl === 6) {
      waterColor = '#0f5257'; // Autumn deep teal
      waterShoreColor = '#0b9b8a';
      waterRippleColor = '#99f6e4';
    } else if (lvl === 7) {
      waterColor = '#0891b2'; // Turquoise lagoon
      waterShoreColor = '#22d3ee';
      waterRippleColor = '#ecfeff';
    } else if (lvl === 8) {
      waterColor = '#1d4ed8'; // Sakura garden deep lake
      waterShoreColor = '#f472b6'; // pink shore!
      waterRippleColor = '#fdf2f8';
    } else if (lvl === 9) {
      waterColor = '#1e293b'; // Stormy deep slate
      waterShoreColor = '#475569';
      waterRippleColor = '#94a3b8';
    } else if (lvl === 10) {
      waterColor = '#4c1d95'; // Cosmic magenta/purple
      waterShoreColor = '#ec4899';
      waterRippleColor = '#f472b6';
    }

    const waterInterval = 400;
    const startWaterY = Math.floor(viewTop / waterInterval) * waterInterval;

    for (let wy = startWaterY; wy < viewBottom + waterInterval; wy += waterInterval) {
      // Create a deterministic hash using sin of the water coordinate
      const hash1 = Math.sin(wy * 0.01) * 10000;
      const hash = hash1 - Math.floor(hash1); // value between 0 and 1

      // Decide if we draw a lake, a river, or both
      const side = hash > 0.5 ? 1 : -1; // 1 = right side, -1 = left side
      const roadWidthOffset = track.width / 2 + 130; // distance from road center to water center to avoid road overlaps

      // --- DRAW LAKE ---
      if (hash < 0.45 || hash > 0.75) {
        // Position of the lake
        const lakeX = side * (roadWidthOffset + hash * 120);
        const lakeY = wy + (hash * 100);
        const radiusX = 65 + hash * 50;
        const radiusY = 45 + hash * 35;
        const lakeAngle = hash * Math.PI;

        // Draw shadow/shore glow
        ctx.fillStyle = waterShoreColor;
        ctx.beginPath();
        ctx.ellipse(lakeX, lakeY, radiusX + 6, radiusY + 6, lakeAngle, 0, Math.PI * 2);
        ctx.fill();

        // Draw deep water body
        ctx.fillStyle = waterColor;
        ctx.beginPath();
        ctx.ellipse(lakeX, lakeY, radiusX, radiusY, lakeAngle, 0, Math.PI * 2);
        ctx.fill();

        // Draw beautiful animated/interactive ripples in the lake
        ctx.strokeStyle = waterRippleColor;
        ctx.lineWidth = 1.5;
        const waveTimer = (Date.now() / 1200) % 1; // 0 to 1 loop
        
        // Inner ripple 1
        ctx.beginPath();
        ctx.ellipse(lakeX, lakeY, radiusX * (0.3 + waveTimer * 0.3), radiusY * (0.3 + waveTimer * 0.3), lakeAngle, 0, Math.PI * 2);
        ctx.globalAlpha = 1 - waveTimer;
        ctx.stroke();
        
        // Inner ripple 2
        ctx.beginPath();
        ctx.ellipse(lakeX, lakeY, radiusX * (0.15 + ((waveTimer + 0.5) % 1) * 0.3), radiusY * (0.15 + ((waveTimer + 0.5) % 1) * 0.3), lakeAngle, 0, Math.PI * 2);
        ctx.globalAlpha = 1 - ((waveTimer + 0.5) % 1);
        ctx.stroke();
        ctx.globalAlpha = 1.0; // reset
      }

      // --- DRAW RIVER ---
      // Draw continuous long winding rivers on BOTH the left and right background sides as requested
      [-1, 1].forEach((riverSide) => {
        const riverBaseX = riverSide * (roadWidthOffset + 50);

        ctx.strokeStyle = waterShoreColor;
        ctx.lineWidth = 34; // Shore boundary thickness
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        // Start point winding nicely
        const sx = riverBaseX + Math.sin(wy * 0.02) * 50 * riverSide;
        const sy = wy - 50;
        // Control point winding
        const cx = riverBaseX + Math.sin((wy + 200) * 0.02) * 90 * riverSide;
        const cy = wy + 200;
        // End point winding
        const ex = riverBaseX + Math.sin((wy + waterInterval) * 0.02) * 50 * riverSide;
        const ey = wy + waterInterval + 50;

        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(cx - 20 * riverSide, cy, cx + 20 * riverSide, cy, ex, ey);
        ctx.stroke();

        // Deep water core
        ctx.strokeStyle = waterColor;
        ctx.lineWidth = 24;
        ctx.stroke();

        // Draw inner flowing wave ripples
        ctx.strokeStyle = waterRippleColor;
        ctx.lineWidth = 1.5;
        ctx.lineDashOffset = (Date.now() / 30) % 80;
        ctx.setLineDash([15, 35]);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash
      });
    }
    ctx.restore();

    // Render unique background elements for each of the 10 levels
    ctx.save();
    if (lvl === 1) {
      // Level 1: Pine Trees, Spectator Chairs, Waving Spectator People
      for (let ty = Math.floor(viewTop / 55) * 55; ty < viewBottom; ty += 55) {
        const offsetHash = Math.abs(Math.sin(ty)) * 120 + 20;
        const leftX = -track.width / 2 - 25 - offsetHash;
        const rightX = track.width / 2 + 25 + offsetHash;

        // Draw Pines / Trees
        if (Math.abs(ty) % 110 === 0) {
          ctx.fillStyle = '#064e3b';
          ctx.beginPath();
          ctx.moveTo(leftX, ty);
          ctx.lineTo(leftX - 18, ty + 38);
          ctx.lineTo(leftX + 18, ty + 38);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(rightX, ty);
          ctx.lineTo(rightX - 18, ty + 38);
          ctx.lineTo(rightX + 18, ty + 38);
          ctx.closePath();
          ctx.fill();
        }

        // Draw Spectator folding chairs
        if (Math.abs(ty) % 165 === 0) {
          // Left chair
          ctx.fillStyle = '#2563eb'; // blue chair
          ctx.fillRect(leftX + 35, ty + 12, 12, 12);
          ctx.fillStyle = '#1e40af';
          ctx.fillRect(leftX + 35, ty + 12, 2.5, 15); // legs
          ctx.fillRect(leftX + 44, ty + 12, 2.5, 15);

          // Right chair
          ctx.fillStyle = '#dc2626'; // red chair
          ctx.fillRect(rightX - 45, ty + 12, 12, 12);
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(rightX - 45, ty + 12, 2.5, 15); // legs
          ctx.fillRect(rightX - 36, ty + 12, 2.5, 15);
        }

        // Draw Spectators (people) waving!
        if (Math.abs(ty) % 220 === 0) {
          const wave = Math.sin(Date.now() / 150 + ty) * 5;
          
          // Left waving spectator
          ctx.fillStyle = '#fbcfe8'; // head
          ctx.beginPath();
          ctx.arc(leftX + 55, ty - 6, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ec4899'; // pink shirt
          ctx.fillRect(leftX + 51, ty - 2, 8, 11);
          ctx.strokeStyle = '#fbcfe8'; // arm waving
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(leftX + 51, ty);
          ctx.lineTo(leftX + 46, ty - 6 + wave);
          ctx.stroke();

          // Right waving spectator
          ctx.fillStyle = '#fed7aa'; // head
          ctx.beginPath();
          ctx.arc(rightX - 65, ty - 6, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#06b6d4'; // cyan shirt
          ctx.fillRect(rightX - 69, ty - 2, 8, 11);
          ctx.strokeStyle = '#fed7aa'; // arm waving
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(rightX - 61, ty);
          ctx.lineTo(rightX - 56, ty - 6 - wave);
          ctx.stroke();
        }
      }
    } else if (lvl === 2) {
      // Level 2: New York City glowing skyscrapers, streets, and bridges!
      for (let ty = Math.floor(viewTop / 90) * 90; ty < viewBottom; ty += 90) {
        const offsetHash = Math.abs(Math.sin(ty)) * 80;
        const leftX = -track.width / 2 - 140 - offsetHash;
        const rightX = track.width / 2 + 50 + offsetHash;

        // Draw Skyscrapers (left & right)
        if (Math.abs(ty) % 180 === 0) {
          // Left building
          ctx.fillStyle = '#0f172a'; // Deep slate blue building
          ctx.fillRect(leftX, ty, 85, 150);
          ctx.strokeStyle = '#1d4ed8'; // blue glowing outline
          ctx.lineWidth = 1.5;
          ctx.strokeRect(leftX, ty, 85, 150);

          // Draw neon cyan/blue skyscraper windows
          ctx.fillStyle = '#38bdf8'; // Sky blue glowing windows
          for (let wx = leftX + 10; wx < leftX + 70; wx += 16) {
            for (let wy = ty + 15; wy < ty + 130; wy += 22) {
              if (Math.sin(wx + wy) > -0.2) { // semi-randomly lit windows
                ctx.fillRect(wx, wy, 8, 10);
              }
            }
          }

          // Right building
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(rightX, ty, 85, 150);
          ctx.strokeStyle = '#2563eb'; // blue glowing outline
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rightX, ty, 85, 150);

          // Draw neon windows on right
          ctx.fillStyle = '#60a5fa'; // Cool blue glowing windows
          for (let wx = rightX + 10; wx < rightX + 70; wx += 16) {
            for (let wy = ty + 15; wy < ty + 130; wy += 22) {
              if (Math.cos(wx - wy) > -0.2) {
                ctx.fillRect(wx, wy, 8, 10);
              }
            }
          }
        }

        // Draw streetlamps / light poles
        if (Math.abs(ty) % 270 === 0) {
          // Left light pole
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(leftX + 110, ty + 100);
          ctx.lineTo(leftX + 110, ty + 20);
          ctx.lineTo(leftX + 125, ty + 20);
          ctx.stroke();

          // Cyan/blue glowing lamp head
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(leftX + 125, ty + 20, 5, 0, Math.PI * 2);
          ctx.fill();

          // Right light pole
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(rightX - 25, ty + 100);
          ctx.lineTo(rightX - 25, ty + 20);
          ctx.lineTo(rightX - 40, ty + 20);
          ctx.stroke();

          // Cyan glowing lamp head right
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(rightX - 40, ty + 20, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (lvl === 3) {
      // Level 3: Cyber Skyscrapers & Glowing neon poles
      for (let ty = Math.floor(viewTop / 90) * 90; ty < viewBottom; ty += 90) {
        const offsetHash = Math.abs(Math.sin(ty)) * 80;
        const leftX = -track.width / 2 - 120 - offsetHash;
        const rightX = track.width / 2 + 30 + offsetHash;

        // Skyscrapers
        if (Math.abs(ty) % 180 === 0) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.lineWidth = 2.0;
          ctx.strokeRect(leftX, ty, 80, 160);
          ctx.strokeRect(rightX, ty, 80, 160);

          ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
          ctx.beginPath();
          for (let wy = ty + 15; wy < ty + 150; wy += 25) {
            ctx.moveTo(leftX + 8, wy);
            ctx.lineTo(leftX + 72, wy);
            ctx.moveTo(rightX + 8, wy);
            ctx.lineTo(rightX + 72, wy);
          }
          ctx.stroke();
        }

        // Neon cyber streetlights / chairs
        if (Math.abs(ty) % 270 === 0) {
          // Left streetlight
          ctx.fillStyle = '#4f46e5';
          ctx.fillRect(leftX + 90, ty, 4, 30);
          ctx.fillStyle = '#06b6d4'; // bright cyan glow
          ctx.beginPath();
          ctx.arc(leftX + 92, ty, 6, 0, Math.PI * 2);
          ctx.fill();

          // Right streetlight
          ctx.fillStyle = '#4f46e5';
          ctx.fillRect(rightX - 15, ty, 4, 30);
          ctx.fillStyle = '#ec4899'; // pink glow
          ctx.beginPath();
          ctx.arc(rightX - 13, ty, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (lvl === 4) {
      // Level 4: Snowy mountains, snowy pines, spectators in coats, camping benches
      for (let ty = Math.floor(viewTop / 55) * 55; ty < viewBottom; ty += 55) {
        const offsetHash = Math.abs(Math.sin(ty)) * 110;
        const leftX = -track.width / 2 - 35 - offsetHash;
        const rightX = track.width / 2 + 35 + offsetHash;

        // Draw snowy pines
        if (Math.abs(ty) % 110 === 0) {
          ctx.fillStyle = '#0f766e'; // green base
          ctx.beginPath();
          ctx.moveTo(leftX, ty);
          ctx.lineTo(leftX - 22, ty + 40);
          ctx.lineTo(leftX + 22, ty + 40);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff'; // snow caps
          ctx.beginPath();
          ctx.moveTo(leftX, ty);
          ctx.lineTo(leftX - 9, ty + 15);
          ctx.lineTo(leftX + 9, ty + 15);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#0f766e';
          ctx.beginPath();
          ctx.moveTo(rightX, ty);
          ctx.lineTo(rightX - 22, ty + 40);
          ctx.lineTo(rightX + 22, ty + 40);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(rightX, ty);
          ctx.lineTo(rightX - 9, ty + 15);
          ctx.lineTo(rightX + 9, ty + 15);
          ctx.closePath();
          ctx.fill();
        }

        // Snowy spectator benches
        if (Math.abs(ty) % 220 === 0) {
          ctx.fillStyle = '#78350f'; // wood bench
          ctx.fillRect(leftX + 25, ty + 10, 20, 5);
          ctx.fillStyle = '#f8fafc'; // snow on bench
          ctx.fillRect(leftX + 25, ty + 8, 20, 2);

          // Winter coat spectators
          ctx.fillStyle = '#2563eb'; // blue heavy coat
          ctx.fillRect(leftX + 28, ty - 2, 7, 10);
          ctx.fillStyle = '#ffedd5'; // face
          ctx.beginPath();
          ctx.arc(leftX + 31.5, ty - 5, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#facc15'; // yellow winter hat
          ctx.fillRect(leftX + 29, ty - 9, 5, 4);
        }
      }
    } else if (lvl === 5) {
      // Level 5: Volcanic Lava Rivers
      ctx.fillStyle = '#f97316'; // glowing orange lava
      ctx.fillRect(-track.width / 2 - 75, viewTop, 35, viewBottom - viewTop);
      ctx.fillRect(track.width / 2 + 40, viewTop, 35, viewBottom - viewTop);

      ctx.fillStyle = '#ef4444'; // molten red veins
      for (let ty = Math.floor(viewTop / 80) * 80; ty < viewBottom; ty += 80) {
        const flicker = Math.sin(Date.now() / 180 + ty) * 4;
        ctx.fillRect(-track.width / 2 - 70 + flicker, ty, 15, 65);
        ctx.fillRect(track.width / 2 + 45 + flicker, ty, 15, 65);
      }
    } else if (lvl === 6) {
      // Level 6: Autumn Maple Woods, red leaf piles, benches, cozy autumn spectators
      for (let ty = Math.floor(viewTop / 55) * 55; ty < viewBottom; ty += 55) {
        const offsetHash = Math.abs(Math.sin(ty)) * 110;
        const leftX = -track.width / 2 - 35 - offsetHash;
        const rightX = track.width / 2 + 35 + offsetHash;

        // Maple Trees
        if (Math.abs(ty) % 110 === 0) {
          ctx.fillStyle = '#b91c1c'; // Red crown
          ctx.beginPath();
          ctx.arc(leftX, ty, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ea580c'; // Orange inner crown
          ctx.beginPath();
          ctx.arc(leftX + 4, ty - 4, 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ea580c'; // Orange crown
          ctx.beginPath();
          ctx.arc(rightX, ty, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#eab308'; // Golden inner
          ctx.beginPath();
          ctx.arc(rightX - 4, ty - 4, 12, 0, Math.PI * 2);
          ctx.fill();
        }

        // Autumn leaf piles on grass
        if (Math.abs(ty) % 165 === 0) {
          ctx.fillStyle = '#c2410c'; // rust orange leaves
          ctx.beginPath();
          ctx.arc(leftX + 25, ty + 15, 8, 0, Math.PI * 2);
          ctx.arc(leftX + 30, ty + 18, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ca8a04'; // yellow piles
          ctx.beginPath();
          ctx.arc(rightX - 25, ty + 15, 8, 0, Math.PI * 2);
          ctx.arc(rightX - 30, ty + 18, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (lvl === 7) {
      // Level 7: Midnight Beach & Waves, sunbeds, beachgoers waving
      ctx.fillStyle = '#0369a1'; // Sky-ocean blue
      ctx.fillRect(viewLeft, viewTop, -track.width / 2 - viewLeft - 15, viewBottom - viewTop);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      for (let ty = Math.floor(viewTop / 70) * 70; ty < viewBottom; ty += 70) {
        const waveShift = Math.sin(Date.now() / 500 + ty) * 14;
        ctx.beginPath();
        ctx.arc(-track.width / 2 - 120 + waveShift, ty, 35, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        // Beach chairs on sand (right side)
        if (Math.abs(ty) % 140 === 0) {
          const rightX = track.width / 2 + 50 + Math.abs(Math.sin(ty)) * 50;
          ctx.fillStyle = '#fbbf24'; // yellow sunbed
          ctx.fillRect(rightX, ty, 16, 8);
          ctx.fillStyle = '#0284c7'; // beach umbrella
          ctx.beginPath();
          ctx.arc(rightX + 8, ty - 12, 12, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(rightX + 8, ty);
          ctx.lineTo(rightX + 8, ty - 12);
          ctx.stroke();
        }
      }
    } else if (lvl === 8) {
      // Level 8: Cherry Blossom Sakura Trees, pink petals, picnic blankets, sakura viewers
      for (let ty = Math.floor(viewTop / 50) * 50; ty < viewBottom; ty += 50) {
        const offsetHash = Math.abs(Math.sin(ty)) * 110;
        const leftX = -track.width / 2 - 35 - offsetHash;
        const rightX = track.width / 2 + 35 + offsetHash;

        // Sakura Blossom Trees
        if (Math.abs(ty) % 100 === 0) {
          ctx.fillStyle = '#f472b6'; // Pink cherry blossom base
          ctx.beginPath();
          ctx.arc(leftX, ty, 17, 0, Math.PI * 2);
          ctx.arc(leftX - 7, ty + 7, 13, 0, Math.PI * 2);
          ctx.arc(leftX + 7, ty - 7, 13, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f472b6';
          ctx.beginPath();
          ctx.arc(rightX, ty, 17, 0, Math.PI * 2);
          ctx.arc(rightX - 7, ty - 7, 13, 0, Math.PI * 2);
          ctx.arc(rightX + 7, ty + 7, 13, 0, Math.PI * 2);
          ctx.fill();
        }

        // Picnic blankets (Sakura viewing)
        if (Math.abs(ty) % 200 === 0) {
          ctx.fillStyle = '#fca5a5'; // pink/white checker blanket
          ctx.fillRect(leftX - 40, ty + 5, 20, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(leftX - 40, ty + 5, 5, 5);
          ctx.fillRect(leftX - 30, ty + 5, 5, 5);
          ctx.fillRect(leftX - 40, ty + 15, 5, 5);
          ctx.fillRect(leftX - 30, ty + 15, 5, 5);

          // Tiny sitting picnic observers
          ctx.fillStyle = '#312e81';
          ctx.fillRect(leftX - 34, ty + 10, 8, 8); // person body
          ctx.fillStyle = '#fed7aa';
          ctx.beginPath();
          ctx.arc(leftX - 30, ty + 7, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (lvl === 9) {
      // Level 9: Stormy Wasteland Rocky Columns
      ctx.fillStyle = '#4b5563'; // Dark Gray columns
      for (let ty = Math.floor(viewTop / 140) * 140; ty < viewBottom; ty += 140) {
        const offsetHash = Math.abs(Math.sin(ty)) * 90;
        ctx.fillRect(-track.width / 2 - 60 - offsetHash, ty, 24, 55);
        ctx.fillRect(track.width / 2 + 35 + offsetHash, ty, 24, 55);
      }

      // Lightning screen flashes!
      if (Math.random() < 0.007) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
        ctx.fillRect(viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);
      }
    } else if (lvl === 10) {
      // Level 10: Cosmic Nebula Starfield
      const grad = ctx.createRadialGradient(-100, -10000, 150, -100, -10000, 900);
      grad.addColorStop(0, 'rgba(236, 72, 153, 0.16)'); // pink nebula dust
      grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.12)'); // purple deep space
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);

      ctx.fillStyle = '#ffffff';
      for (let ty = Math.floor(viewTop / 80) * 80; ty < viewBottom; ty += 80) {
        const hashX = Math.abs(Math.sin(ty)) * (viewRight - viewLeft) + viewLeft;
        const size = (Math.sin(Date.now() / 250 + ty) + 1.2) * 1.5;
        ctx.fillRect(hashX, ty + 30, size, size);
      }
    }
    ctx.restore();

    // 2. Render Asphalt Track (Straight multi-lane highway)
    const endCheckpointY = track.checkpoints[3]?.pos.y ?? -15632;
    const roadTop = endCheckpointY - 500;
    const roadBottom = track.startPoint.y + 100;

    // Main dark asphalt base
    ctx.fillStyle = '#18181b'; // zinc-900 (deep black-gray charcoal)
    ctx.fillRect(-track.width / 2, roadTop, track.width, roadBottom - roadTop);

    // Subtle inner asphalt shading
    ctx.fillStyle = '#1e1e24'; // slightly lighter gray
    ctx.fillRect(-track.width / 2 + 6, roadTop, track.width - 12, roadBottom - roadTop);

    // Draw White dashed lane dividers
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([20, 25]); // dash patterns
    
    // Left lane divider
    const divLeftX = -track.width * 0.14;
    ctx.beginPath();
    ctx.moveTo(divLeftX, roadBottom);
    ctx.lineTo(divLeftX, roadTop);
    ctx.stroke();

    // Right lane divider
    const divRightX = track.width * 0.14;
    ctx.beginPath();
    ctx.moveTo(divRightX, roadBottom);
    ctx.lineTo(divRightX, roadTop);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Start & Finish checkered grids
    const drawCheckerLine = (yCoord: number) => {
      ctx.save();
      ctx.translate(0, yCoord);
      const checkW = 10;
      const checkH = track.width;
      ctx.fillStyle = '#000000';
      ctx.fillRect(-checkH / 2, -checkW, checkH, checkW * 2);

      ctx.fillStyle = '#ffffff';
      const squaresCount = Math.floor(track.width / 16);
      for (let s = 0; s < squaresCount; s++) {
        const xPos = -checkH / 2 + s * 16;
        if (s % 2 === 0) {
          ctx.fillRect(xPos, -checkW, 16, checkW);
          ctx.fillRect(xPos + 16, 0, 16, checkW);
        } else {
          ctx.fillRect(xPos, 0, 16, checkW);
          ctx.fillRect(xPos + 16, -checkW, 16, checkW);
        }
      }
      ctx.restore();
    };

    drawCheckerLine(1000); // Start Line
    const cp3 = checkpointsRef.current[3];
    if (cp3) {
      drawCheckerLine(cp3.pos.y); // Finish Line!
    }

    // 4. Draw persistent drift skid marks
    skidMarksRef.current.forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s.p1.x, s.p1.y);
      ctx.lineTo(s.p2.x, s.p2.y);
      ctx.strokeStyle = `rgba(9, 9, 11, ${s.alpha})`;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    });

    // 5. Draw active procedural checkpoints
    checkpointsRef.current.forEach((cp, idx) => {
      if (idx === 3) return; // index 3 is finish line
      ctx.save();
      ctx.translate(cp.pos.x, cp.pos.y);
      ctx.rotate(cp.angle);

      // Gate poles
      ctx.fillStyle = cp.passed ? '#10b981' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(-cp.width / 2, 0, 8, 0, Math.PI * 2);
      ctx.arc(cp.width / 2, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Dotted checkline
      ctx.strokeStyle = cp.passed ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(-cp.width / 2, 0);
      ctx.lineTo(cp.width / 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    // 6. Draw Hazards / Items (Coins and obstacles)
    // Coins
    trackCoinsRef.current.forEach(coin => {
      if (!coin.collected) {
        ctx.save();
        ctx.translate(coin.pos.x, coin.pos.y);
        // Spin animation over time
        const spin = (Date.now() / 150) % (Math.PI * 2);
        ctx.scale(Math.cos(spin), 1);

        if (coin.isTimeControl) {
          // Glow style for +10s Time Coin (two different looks!)
          if (coin.timeStyle === 1) {
            // LOOK 1: Glowing Hexagonal Cyan Clock
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#06b6d4'; // cyan glow
            ctx.fillStyle = '#06b6d4'; // bright cyan body
            ctx.strokeStyle = '#ffffff'; // white neon rim
            ctx.lineWidth = 2.0;
            
            ctx.beginPath();
            const sides = 6;
            const r = 11;
            for (let s = 0; s <= sides; s++) {
              const angle = (s * Math.PI * 2) / sides;
              const px = Math.cos(angle) * r;
              const py = Math.sin(angle) * r;
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0; // reset shadow

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('10s', 0, 0);
          } else {
            // LOOK 2: Glowing 8-Pointed Pink Starburst Clock
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ec4899'; // pink glow
            ctx.fillStyle = '#ec4899'; // vibrant pink body
            ctx.strokeStyle = '#ffffff'; // white neon rim
            ctx.lineWidth = 2.0;

            ctx.beginPath();
            const points = 8;
            const outerRadius = 12;
            const innerRadius = 7;
            for (let s = 0; s < points * 2; s++) {
              const angle = (s * Math.PI) / points;
              const r = s % 2 === 0 ? outerRadius : innerRadius;
              const px = Math.cos(angle) * r;
              const py = Math.sin(angle) * r;
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0; // reset shadow

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+10', 0, 0);
          }
        } else if (coin.isLifeControl) {
          // LOOK 3: Glowing Red Heart Life Coin with dynamic scaling pulse
          const pulse = 1 + 0.12 * Math.sin(Date.now() / 200);
          ctx.save();
          ctx.scale(pulse, pulse);

          ctx.shadowBlur = 16;
          ctx.shadowColor = '#f43f5e'; // Rose pink/red health glow
          ctx.fillStyle = '#ef4444'; // Hot red body
          ctx.strokeStyle = '#ffffff'; // White neon rim
          ctx.lineWidth = 2.0;

          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.shadowBlur = 0; // reset shadow

          // Draw heart symbol inside
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('♥', 0, 0.5); // Cute heart!
          ctx.restore();
        } else {
          ctx.fillStyle = '#fbbf24'; // beautiful amber gold coin
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Inner core details
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0);
        }
        ctx.restore();
      }
    });

    // Obstacles
    trackObstaclesRef.current.forEach(obs => {
      if (obs.radius <= 0) return; // consumed/smashed
      ctx.save();
      ctx.translate(obs.pos.x, obs.pos.y);

      if (obs.type === 'boost') {
        // Glowing Booster arrows
        ctx.rotate(obs.angle);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
        ctx.fill();

        // Chevron Arrow lines
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-10, -6);
        ctx.lineTo(6, 0);
        ctx.lineTo(-10, 6);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-2, -6);
        ctx.lineTo(14, 0);
        ctx.lineTo(-2, 6);
        ctx.stroke();
      } else if (obs.type === 'oil') {
        // Refractive oil spill puddle
        ctx.fillStyle = 'rgba(24, 24, 27, 0.75)';
        ctx.strokeStyle = 'rgba(63, 63, 70, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, obs.radius * 1.2, obs.radius * 0.8, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Shiny reflection streaks
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(-5, -2, 6, 2, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'cone') {
        // Orange and white sports pylons
        ctx.fillStyle = '#ea580c'; // solid orange base
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff'; // inner ring
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ea580c'; // peak center
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'barrier') {
        // Warning barrier block
        ctx.rotate(obs.angle);
        ctx.fillStyle = '#1e1b4b'; // deep indigo structure
        ctx.fillRect(-22, -8, 44, 16);

        // Red and black caution hazard stripes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-20, -6, 40, 12);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-14, -6); ctx.lineTo(-6, 6);
        ctx.moveTo(-4, -6); ctx.lineTo(4, 6);
        ctx.moveTo(6, -6); ctx.lineTo(14, 6);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 6.5 Draw Traffic Vehicles
    trafficVehiclesRef.current.forEach(veh => {
      // Check if vehicle is near view bounds before drawing for performance
      if (veh.y > viewBottom || veh.y < viewTop) return;

      ctx.save();
      ctx.translate(veh.x, veh.y);

      // 1. Shadow under the car
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.beginPath();
      ctx.roundRect(-20, -13, 38, 26, 4);
      ctx.fill();

      // 2. Wheels drawing function (Wide Racing Slicks with Alloy Rims)
      const drawRacerWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);
        // Tire body (black rubber)
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.roundRect(-5.5, -3.2, 11, 6.4, 1.8);
        ctx.fill();
        // Tire thread lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-5.5, -1); ctx.lineTo(5.5, -1);
        ctx.moveTo(-5.5, 1); ctx.lineTo(5.5, 1);
        ctx.stroke();

        // Alloy Rim Hub
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Red Brake Caliper
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-1.4, -1.8, 1, 1.4);

        ctx.restore();
      };

      // 3. Carbon suspension wishbone arms
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      // Front wheels wishbones
      ctx.moveTo(8, -13); ctx.lineTo(4, -5);
      ctx.moveTo(8, -13); ctx.lineTo(11, -5);
      ctx.moveTo(8, 13); ctx.lineTo(4, 5);
      ctx.moveTo(8, 13); ctx.lineTo(11, 5);
      // Rear wheels wishbones
      ctx.moveTo(-11, -13); ctx.lineTo(-7, -5);
      ctx.moveTo(-11, -13); ctx.lineTo(-14, -5);
      ctx.moveTo(-11, 13); ctx.lineTo(-7, 5);
      ctx.moveTo(-11, 13); ctx.lineTo(-14, 5);
      ctx.stroke();

      // Draw 4 racing wheels
      drawRacerWheel(8, -13);
      drawRacerWheel(8, 13);
      drawRacerWheel(-11, -13);
      drawRacerWheel(-11, 13);

      // 4. Front Splitter Wing
      ctx.fillStyle = veh.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(11, -14, 4, 28, 1);
      ctx.fill();
      ctx.stroke();

      // 5. Main Body Paint (sleek tapered nose cone)
      const bodyGrad = ctx.createLinearGradient(-18, 0, 15, 0);
      bodyGrad.addColorStop(0, '#1e293b'); // carbon rear
      bodyGrad.addColorStop(0.3, veh.color);
      bodyGrad.addColorStop(1, veh.color);
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.moveTo(-18, -10);
      ctx.lineTo(-12, -11);
      ctx.lineTo(6, -8);
      ctx.lineTo(13, -5);
      ctx.lineTo(13, 5);
      ctx.lineTo(6, 8);
      ctx.lineTo(-12, 11);
      ctx.lineTo(-18, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 6. Flared Sidepods
      ctx.fillStyle = '#1e293b'; // radiator carbon intake
      ctx.beginPath();
      ctx.roundRect(-6, -12.5, 9, 2.5, 1);
      ctx.roundRect(-6, 10, 9, 2.5, 1);
      ctx.fill();

      ctx.fillStyle = veh.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1;
      // Left sidepod
      ctx.beginPath();
      ctx.moveTo(-7, -10);
      ctx.lineTo(-1, -12.5);
      ctx.lineTo(5, -10);
      ctx.lineTo(2, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right sidepod
      ctx.beginPath();
      ctx.moveTo(-7, 10);
      ctx.lineTo(-1, 12.5);
      ctx.lineTo(5, 10);
      ctx.lineTo(2, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 7. Double racing stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-17, -2.5, 30, 1.2);
      ctx.fillRect(-17, 1.3, 30, 1.2);

      // 8. Hood number emblem
      const compId = veh.id.split('_')[1];
      const compNum = compId ? (parseInt(compId, 10) % 99) + 2 : 12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(5, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 4.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(compNum.toString(), 5, 0.2);

      // 9. Cockpit canopy glass
      const glassGrad = ctx.createLinearGradient(-4, -6, 8, 6);
      glassGrad.addColorStop(0, '#0f172a');
      glassGrad.addColorStop(0.5, '#1e293b');
      glassGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.roundRect(-5, -5.5, 12, 11, 2.5);
      ctx.fill();

      // Competitor Helmet
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(1, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Helmet Visor
      ctx.fillStyle = '#020617';
      ctx.fillRect(0.8, -1.8, 1.8, 3.6);

      // 10. Rear carbon spoiler/wing
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-22, -15, 3, 30);
      // Wing endplates
      ctx.fillStyle = veh.color;
      ctx.fillRect(-23, -15, 4, 1.5);
      ctx.fillRect(-23, 13.5, 4, 1.5);

      // 11. Headlights (Xenon ice-white)
      ctx.fillStyle = '#f0fdf4';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(12, -4, 1.2, 0, Math.PI * 2);
      ctx.arc(12, 4, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 12. Red tail lights
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-18, -8, 1.5, 3);
      ctx.fillRect(-18, 5, 1.5, 3);

      ctx.restore();
    });

    // 7. Draw Active Particles
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 8. Draw Player Car Vector Model - Realistic Racing Car
    const carPos = carPosRef.current;
    const finalRenderAngle = carAngleRef.current + spinAngleRef.current;

    ctx.save();
    ctx.translate(carPos.x, carPos.y);
    ctx.rotate(finalRenderAngle);

    // Headlight beams (casting ambient subtle light)
    const beamGrad = ctx.createLinearGradient(0, 0, 120, 0);
    beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.lineTo(130, -35);
    ctx.lineTo(130, 35);
    ctx.lineTo(12, 8);
    ctx.fill();

    // Side Wheels - Wide Racing Slicks with Alloy Rims, Treads, and Brake Calipers
    const drawRacingWheel = (wx: number, wy: number) => {
      ctx.save();
      ctx.translate(wx, wy);
      // Tire body (black rubber)
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.roundRect(-5.5, -3.2, 11, 6.4, 1.8);
      ctx.fill();
      // Tire thread lines for realistic racing slicks
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-5.5, -1); ctx.lineTo(5.5, -1);
      ctx.moveTo(-5.5, 1); ctx.lineTo(5.5, 1);
      ctx.stroke();

      // Outer rim edge
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Alloy Silver Rim Hub
      ctx.fillStyle = '#cbd5e1'; // polished aluminum silver
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Red Brake Caliper Detail (Premium racing touch!)
      ctx.fillStyle = '#ef4444'; // Hot race red caliper
      ctx.fillRect(-1.4, -1.8, 1, 1.4);

      // Alloy spoke details
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Shiny center cap
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Draw professional double-wishbone structural carbon suspension arms
    ctx.strokeStyle = '#334155'; // Dark carbon wishbones
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    // Front wheels wishbones
    ctx.moveTo(8, -13); ctx.lineTo(4, -5);
    ctx.moveTo(8, -13); ctx.lineTo(11, -5);
    ctx.moveTo(8, 13); ctx.lineTo(4, 5);
    ctx.moveTo(8, 13); ctx.lineTo(11, 5);
    // Rear wheels wishbones
    ctx.moveTo(-11, -13); ctx.lineTo(-7, -5);
    ctx.moveTo(-11, -13); ctx.lineTo(-14, -5);
    ctx.moveTo(-11, 13); ctx.lineTo(-7, 5);
    ctx.moveTo(-11, 13); ctx.lineTo(-14, 5);
    ctx.stroke();

    // Front-left, front-right, rear-left, rear-right
    drawRacingWheel(8, -13);
    drawRacingWheel(8, 13);
    drawRacingWheel(-11, -13);
    drawRacingWheel(-11, 13);

    // Main Chassis Base Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(-20, -13, 38, 26, 4);
    ctx.fill();

    // 1. Aerodynamic Front Splitter (Front Wing - F1 style)
    ctx.fillStyle = carAccentColor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(11, -14, 4, 28, 1);
    ctx.fill();
    ctx.stroke();
    // Front wing endplates (vertical flaps)
    ctx.fillStyle = carColor;
    ctx.fillRect(11, -15, 4, 1.5);
    ctx.fillRect(11, 13.5, 4, 1.5);

    // 2. Main Car Body Paint (Aero curved racing shell)
    const bodyGrad = ctx.createLinearGradient(-18, 0, 15, 0);
    bodyGrad.addColorStop(0, carAccentColor);
    bodyGrad.addColorStop(0.3, carColor);
    bodyGrad.addColorStop(1, carColor);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // Nose cone tapers down to front
    ctx.moveTo(-18, -10);
    ctx.lineTo(-12, -11);
    ctx.lineTo(6, -8);
    ctx.lineTo(13, -5);
    ctx.lineTo(13, 5);
    ctx.lineTo(6, 8);
    ctx.lineTo(-12, 11);
    ctx.lineTo(-18, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Flared Sidepods (Air Intakes for radiator cooling)
    ctx.fillStyle = '#1e293b'; // dark carbon intake opening
    ctx.beginPath();
    ctx.roundRect(-6, -12.5, 9, 2.5, 1);
    ctx.roundRect(-6, 10, 9, 2.5, 1);
    ctx.fill();

    ctx.fillStyle = carColor;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1;
    // Left sidepod body
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(-1, -12.5);
    ctx.lineTo(5, -10);
    ctx.lineTo(2, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right sidepod body
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.lineTo(-1, 12.5);
    ctx.lineTo(5, 10);
    ctx.lineTo(2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Center Dual Racing Stripes
    ctx.fillStyle = '#ffffff'; // beautiful pure white racing stripes
    ctx.fillRect(-17, -2.5, 30, 1.2);
    ctx.fillRect(-17, 1.3, 30, 1.2);

    // 5. Hood Racing Emblem (White circle with #7 racing number)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(5, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 4.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('7', 5, 0.2);

    // 6. Cockpit Canopy with visible Racing Helmet & Driver
    // Glass windshield base
    const glassGrad = ctx.createLinearGradient(-4, -6, 8, 6);
    glassGrad.addColorStop(0, '#0f172a');
    glassGrad.addColorStop(0.5, '#1e293b');
    glassGrad.addColorStop(1, '#3b4252');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.roundRect(-4, -6.5, 11, 13, 2.5);
    ctx.fill();

    // Miniature Racing Driver Helmet inside
    ctx.fillStyle = '#f8fafc'; // Helmet shell
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    // Dark Helmet Visor
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(1.2, 0, 1.8, -Math.PI/3, Math.PI/3);
    ctx.fill();
    // Red helmet detail stripe
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(-1, 0, 2.8, -Math.PI, Math.PI);
    ctx.stroke();

    // Shiny glass glare streak
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-1, -6);
    ctx.lineTo(2, -6);
    ctx.lineTo(-1, 6);
    ctx.lineTo(-4, 6);
    ctx.fill();

    // 7. Spoiler / Massive Rear Wing with endplates
    ctx.fillStyle = carAccentColor;
    // Left & Right endplates
    ctx.fillRect(-18, -14.5, 4, 2);
    ctx.fillRect(-18, 12.5, 4, 2);
    // Spoiler wing blade
    ctx.fillStyle = '#0f172a'; // carbon fiber look
    ctx.fillRect(-17.5, -13, 3, 26);
    ctx.fillStyle = carColor;
    ctx.fillRect(-18.5, -13.5, 1, 27);

    // Spoiler Struts (wing supports attaching to engine cover)
    ctx.fillStyle = '#475569';
    ctx.fillRect(-15, -4, 3.5, 1);
    ctx.fillRect(-15, 3, 3.5, 1);

    // 8. Headlight bulbs (warm xenon yellow-white)
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(12, -5, 1.8, 0, Math.PI * 2);
    ctx.arc(12, 5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 9. Brake Lights (Red, glows bright red on braking input)
    const isBraking = inputs.brake || localKeysRef.current['brake'];
    ctx.fillStyle = isBraking ? '#f87171' : '#991b1b';
    if (isBraking) {
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 8;
    }
    ctx.fillRect(-18.5, -8, 1.5, 3);
    ctx.fillRect(-18.5, 5, 1.5, 3);
    ctx.shadowBlur = 0; // reset shadow

    // 10. Exhaust pipes & flames (blue nitro glow if boosting, orange idle glow if moving)
    const nitroActive = (inputs.nitro || localKeysRef.current['nitro']) && nitroCharged >= 30;
    const isBoosting = boostTimerRef.current > 0 || nitroActive;
    if (isBoosting) {
      // Dynamic blue exhaust flame
      const flameLen = 8 + Math.random() * 8;
      const fGrad = ctx.createLinearGradient(-18, 0, -18 - flameLen, 0);
      fGrad.addColorStop(0, '#38bdf8');
      fGrad.addColorStop(0.5, '#0284c7');
      fGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(-18, -3);
      ctx.lineTo(-18 - flameLen, 0);
      ctx.lineTo(-18, 3);
      ctx.closePath();
      ctx.fill();
    } else {
      // Small orange exhaust heat glow
      ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.fillRect(-19, -2, 1, 1);
      ctx.fillRect(-19, 1, 1, 1);
    }

    ctx.restore(); // end car coordinate translate

    ctx.restore(); // end camera center coordinate translate

    // 9. Static Map Overlay (Mini-map showing full procedural spline in corner)
    // drawMinimap(ctx, w, h);
  };

  const drawMinimap = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const mapW = 100;
    const mapH = 120; // taller vertical minimap to fit the long highway!
    const padding = 16;
    const mapX = padding;
    const mapY = h - mapH - padding;

    // Draw Map backdrop panel
    ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapW, mapH, 12);
    ctx.fill();
    ctx.stroke();

    // Map content clipping
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mapX + 2, mapY + 2, mapW - 4, mapH - 4, 10);
    ctx.clip();

    // Scaling helpers
    const roadYStart = 1000;
    const roadYEnd = -23750;
    const roadHeight = roadYStart - roadYEnd; // 24750
    const scaleY = (mapH - 16) / roadHeight;

    const getMinimapCoords = (x: number, y: number) => {
      const mx = (mapX + mapW / 2) + x * 0.16;
      const my = (mapY + mapH - 8) - (roadYStart - y) * scaleY;
      return { x: mx, y: my };
    };

    // Draw straight track path
    const startM = getMinimapCoords(0, roadYStart);
    const endM = getMinimapCoords(0, roadYEnd);

    ctx.beginPath();
    ctx.moveTo(startM.x, startM.y);
    ctx.lineTo(endM.x, endM.y);
    ctx.strokeStyle = 'rgba(113, 113, 122, 0.55)';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Mark Checkpoint nodes
    checkpointsRef.current.forEach((cp, idx) => {
      const coords = getMinimapCoords(cp.pos.x, cp.pos.y);
      ctx.fillStyle = cp.passed ? '#10b981' : (idx === 3 ? '#38bdf8' : '#f59e0b');
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Mark active civilian traffic cars as grey small dots
    trafficVehiclesRef.current.forEach(veh => {
      const coords = getMinimapCoords(veh.x, veh.y);
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Mark current player position as pulsing neon dot
    const pCoords = getMinimapCoords(carPosRef.current.x, carPosRef.current.y);
    const blipSize = 4 + Math.sin(Date.now() / 90) * 1.5;

    ctx.fillStyle = carColor;
    ctx.shadowColor = carColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(pCoords.x, pCoords.y, blipSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Keep canvas matching parent layout bounds perfectly
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Intercept and disable navigator.vibrate while the countdown is active to prevent any device buzzes
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        const originalVibrate = navigator.vibrate.bind(navigator);
        (navigator as any).vibrate = (pattern: any) => {
          if (countdownText !== null || (countdownRef && countdownRef.current > 0)) {
            console.log("Vibration blocked during countdown");
            return false;
          }
          return originalVibrate(pattern);
        };
        return () => {
          (navigator as any).vibrate = originalVibrate;
        };
      } catch (e) {
        console.warn("Could not override navigator.vibrate", e);
      }
    }
  }, [countdownText]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-zinc-950 flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 block touch-none" />
      
      {/* Centered Arcade Countdown Overlay */}
      {countdownText && (
        <div id="arcade-countdown" className="absolute z-50 text-center select-none pointer-events-none transform -translate-y-6">
          <div className="text-8xl sm:text-9xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.35)] select-none scale-in">
            {countdownText}
          </div>
          <div className="text-sm font-black tracking-widest text-cyan-400/90 mt-2 uppercase select-none font-sans">
            {countdownText === "GO!" ? "SPEED UP SLOWLY!" : "READY TO RACE"}
          </div>
        </div>
      )}

      {/* Celebratory congratulations overlay with neon/metallic arcade style */}
      {showCongrats && (
        <div id="congratulations-overlay" className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/45 backdrop-blur-xs select-none pointer-events-none animate-fade-in font-sans">
          <div className="bg-zinc-900/95 border border-zinc-800 rounded-3xl p-8 max-w-sm text-center shadow-2xl flex flex-col items-center gap-4 scale-in relative overflow-hidden">
            {/* Ambient neon radial glow */}
            <div className="absolute -inset-10 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-full blur-2xl" />
            
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl animate-bounce">
              🏆
            </div>
            
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 bg-clip-text text-transparent uppercase animate-pulse">
                CONGRATULATIONS!
              </h2>
              <p className="text-xs text-zinc-400 font-bold tracking-widest uppercase mt-0.5">
                Finish Line Crossed!
              </p>
            </div>
            
            <p className="text-sm font-semibold text-zinc-300 px-4">
              Excellent run! Braking to a stop...
            </p>
            
            <div className="flex gap-2 items-center justify-center text-xs font-bold text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-xl border border-yellow-400/20 mt-1">
              <span>🌟 LAP COMPLETED!</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
