import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { TouchControls } from './components/TouchControls';
import { CarShop } from './components/CarShop';
import { TrackConfigurator } from './components/TrackConfigurator';
import { RacingCarSVG } from './components/RacingCarSVG';
import { CarConfig, GameStats, UpgradeState } from './types';
import { generateProceduralTrack, GeneratorConfig } from './utils/trackGenerator';
import { getCarColorForLevel, getCarAccentForLevel } from './utils/carColorHelper';
import { Play, Trophy, Settings, Wrench, RefreshCw, Sparkles, Coins, Zap } from 'lucide-react';
import { audio } from './utils/audio';

const LEVEL_DATA = [
  { id: 1, name: "Green Hills & Valley", desc: "Sunny meadows, green hills, pine trees" },
  { id: 2, name: "Dusty Desert Dunes", desc: "Warm desert sand, cacti, dust wind" },
  { id: 3, name: "Neon Cyber City", desc: "Futuristic skyscrapers, laser lines" },
  { id: 4, name: "Snowy Alpine Pass", desc: "Frosty snow peaks, frozen pines" },
  { id: 5, name: "Volcanic Lava Ash", desc: "Cracked stone, burning magma pools" },
  { id: 6, name: "Autumn Maple Woods", desc: "Rich auburn trees, copper forest floor" },
  { id: 7, name: "Midnight Ocean Beach", desc: "Crashing ocean wave ripples, night stars" },
  { id: 8, name: "Cherry Blossom Sakura", desc: "Rose-petal wind, beautiful pink trees" },
  { id: 9, name: "Stormy Thunder Wasteland", desc: "Lightning strikes, gray stone columns" },
  { id: 10, name: "Cosmic Space Nebula", desc: "Galactic void, pink nebula starfield" },
];

const INITIAL_CARS: CarConfig[] = [
  {
    id: 'rocket',
    name: 'POCKET ROCKET',
    baseMaxSpeed: 380,
    baseAcceleration: 180,
    baseGrip: 0.84,
    driftFactor: 0.5,
    color: '#ef4444', // Hot Red
    accentColor: '#0ea5e9', // Sky Blue spoiler
    cost: 0,
    unlocked: true,
    upgrades: { speed: 1, acceleration: 1, grip: 1 },
  },
  {
    id: 'drifter',
    name: 'NEON DRIFTER',
    baseMaxSpeed: 420,
    baseAcceleration: 220,
    baseGrip: 0.88,
    driftFactor: 0.35, // highly slippery drift booster
    color: '#06b6d4', // Cyan
    accentColor: '#ec4899', // Hot Pink
    cost: 150,
    unlocked: false,
    upgrades: { speed: 1, acceleration: 1, grip: 1 },
  },
  {
    id: 'beetle',
    name: 'HYPER BEETLE',
    baseMaxSpeed: 390,
    baseAcceleration: 280, // insane torque
    baseGrip: 0.82,
    driftFactor: 0.55,
    color: '#10b981', // Emerald Green
    accentColor: '#1e1b4b', // Deep indigo
    cost: 320,
    unlocked: false,
    upgrades: { speed: 1, acceleration: 1, grip: 1 },
  },
  {
    id: 'formula',
    name: 'FORMULA MINI',
    baseMaxSpeed: 460, // insane speeds
    baseAcceleration: 250,
    baseGrip: 0.94, // maximum cornering suction
    driftFactor: 0.45,
    color: '#ef4444', // Red (as requested, player's car in red colour!)
    accentColor: '#38bdf8', // Vibrant Light Blue spoiler
    cost: 650,
    unlocked: false,
    upgrades: { speed: 1, acceleration: 1, grip: 1 },
  },
];

const DEFAULT_TRACK_CONFIG: GeneratorConfig = {
  pointsCount: 11,
  radius: 1200,
  turniness: 0.22,
  trackWidth: 170,
  obstacleDensity: 0.45,
  coinDensity: 0.65,
};

export default function App() {
  // 1. Persistent state loading from localStorage
  const [coins, setCoins] = useState<number>(() => {
    const saved = localStorage.getItem('minicars_coins');
    return saved ? parseInt(saved) : 100; // start with a small bonus of 100 gold
  });

  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('minicars_highscore');
    return saved ? parseInt(saved) : 0;
  });

  const [activeCarId, setActiveCarId] = useState<string>(() => {
    const saved = localStorage.getItem('minicars_active_car');
    return saved || 'rocket';
  });

  const [cars, setCars] = useState<CarConfig[]>(() => {
    const saved = localStorage.getItem('minicars_unlocked_cars');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_CARS;
      }
    }
    return INITIAL_CARS;
  });

  const [trackConfig, setTrackConfig] = useState<GeneratorConfig>(DEFAULT_TRACK_CONFIG);
  const [track, setTrack] = useState(() => generateProceduralTrack(DEFAULT_TRACK_CONFIG));

  // Game UI/HUD screens
  const [screen, setScreen] = useState<'menu' | 'playing' | 'shop' | 'config' | 'gameover' | 'level_completed'>('menu');

  const [stats, setStats] = useState<GameStats>({
    score: 0,
    coinsCollected: 0,
    timeRemaining: 68, // Increased to 68 seconds (8 seconds more) to complete one lap as requested
    totalTime: 0,
    lapsCompleted: 0,
    currentCheckpoint: -1,
    isGameOver: false,
    isWon: false,
    highScore: 0,
    currentLevel: 1,
    lives: 3,
    maxLives: 3,
  });

  // Touch button states (relayed directly to GameCanvas)
  const [inputs, setInputs] = useState({
    steerLeft: false,
    steerRight: false,
    gas: false,
    brake: false,
    nitro: false,
  });

  const [nitroCharged, setNitroCharged] = useState<number>(100);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [routeProgress, setRouteProgress] = useState<number>(0);
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);

  // Daily Login Bonus State
  const [showDailyBonusModal, setShowDailyBonusModal] = useState<boolean>(false);
  const [dailyBonusAmount] = useState<number>(150); // Generous 150 G daily login reward!

  // Check and trigger daily login bonus when entering the main menu screen
  useEffect(() => {
    if (screen === 'menu') {
      const lastClaim = localStorage.getItem('minicars_last_claim_date');
      const today = new Date().toDateString();
      if (lastClaim !== today) {
        setShowDailyBonusModal(true);
      }
    }
  }, [screen]);

  // Sync state mutations to LocalStorage
  useEffect(() => {
    localStorage.setItem('minicars_coins', coins.toString());
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('minicars_highscore', highScore.toString());
  }, [highScore]);

  useEffect(() => {
    localStorage.setItem('minicars_active_car', activeCarId);
  }, [activeCarId]);

  useEffect(() => {
    localStorage.setItem('minicars_unlocked_cars', JSON.stringify(cars));
  }, [cars]);

  // Handle Game Victory & Game Over conditions
  useEffect(() => {
    if (stats.isGameOver || stats.isWon) {
      setScreen('gameover');
      audio.stopEngine();

      // persist coins and evaluate highscores
      if (stats.coinsCollected > 0) {
        setCoins(prev => prev + stats.coinsCollected);
      }
      if (stats.score > highScore) {
        setHighScore(stats.score);
      }
    }
  }, [stats.isGameOver, stats.isWon]);

  // Methods
  // Helper to generate level-specific track configurations
  const getTrackConfigForLevel = (levelNum: number): GeneratorConfig => {
    return {
      pointsCount: 11,
      radius: 1320 + (levelNum - 1) * 90, // increased slightly to provide "a little bit" more distance (e.g., 10% more)
      turniness: 0.22,
      trackWidth: Math.max(130, 170 - (levelNum - 1) * 4), // tracks get narrower!
      obstacleDensity: 0.0, // Set to 0.0 to completely prevent non-vehicle obstacles from being spawned on the road
      coinDensity: Math.min(0.8, 0.60 + (levelNum - 1) * 0.015),
    };
  };

  const handleGenerateNewTrack = (newConfig: GeneratorConfig) => {
    setTrackConfig(newConfig);
    setTrack(generateProceduralTrack(newConfig));
  };

  const handleStartRace = () => {
    // Resume/init Web Audio on first user interaction
    audio.init();

    // Regenerate track for Level 1 to reset all coins and obstacles procedurally
    const initialLvlConfig = getTrackConfigForLevel(1);
    setTrackConfig(initialLvlConfig);
    setTrack(generateProceduralTrack(initialLvlConfig));

    // Reset game parameters
    setStats({
      score: 0,
      coinsCollected: 0,
      timeRemaining: 68, // Increased to 68 seconds (8 seconds more) as requested
      totalTime: 0,
      lapsCompleted: 0,
      currentCheckpoint: -1,
      isGameOver: false,
      isWon: false,
      highScore,
      currentLevel: 1,
      lives: 3,
      maxLives: 3,
    });
    setNitroCharged(50); // start partially charged
    setInputs({ steerLeft: false, steerRight: false, gas: false, brake: false, nitro: false });
    setScreen('playing');
  };

  const handleLevelCompleted = () => {
    // Add rewards: nice bonus!
    const bonusCoins = 100;
    const bonusScore = 1500 + Math.floor(stats.timeRemaining * 50); // bonus score for leftover time!

    setCoins(prev => prev + bonusCoins);
    setStats(prev => ({
      ...prev,
      score: prev.score + bonusScore,
      coinsCollected: prev.coinsCollected + bonusCoins,
      lapsCompleted: prev.lapsCompleted + 1,
    }));

    audio.stopEngine();
    setScreen('level_completed');
  };

  const handleStartNextLevel = () => {
    // Increment level
    const nextLvl = stats.currentLevel + 1;
    if (nextLvl > 10) {
      // Completed all 10 levels! Set isWon to true so they see Grand Champ victory!
      setStats(prev => ({ ...prev, isWon: true }));
      setScreen('gameover');
      return;
    }

    // Regenerate track for the next level with dynamic difficulty progression
    const nextLvlConfig = getTrackConfigForLevel(nextLvl);
    setTrackConfig(nextLvlConfig);
    setTrack(generateProceduralTrack(nextLvlConfig));

    setStats(prev => ({
      ...prev,
      currentLevel: nextLvl,
      timeRemaining: 68, // Increased to 68 seconds (8 seconds more) for this level as requested
      currentCheckpoint: -1,
      isGameOver: false,
      isWon: false,
      lives: 3,
      maxLives: 3,
    }));

    audio.init();
    setNitroCharged(50);
    setInputs({ steerLeft: false, steerRight: false, gas: false, brake: false, nitro: false });
    setScreen('playing');
  };

  const handleBuyCar = (carId: string) => {
    const target = cars.find(c => c.id === carId);
    if (!target || target.unlocked || coins < target.cost) return;

    setCoins(prev => prev - target.cost);
    setCars(prev => prev.map(c => c.id === carId ? { ...c, unlocked: true } : c));
    setActiveCarId(carId);
  };

  const handleUpgradeCar = (carId: string, stat: keyof UpgradeState) => {
    const target = cars.find(c => c.id === carId);
    if (!target) return;

    const currentLvl = target.upgrades[stat];
    if (currentLvl >= 5) return; // already maxed

    const cost = (currentLvl + 1) * 75;
    if (coins < cost) return;

    setCoins(prev => prev - cost);
    setCars(prev => prev.map(c => {
      if (c.id === carId) {
        return {
          ...c,
          upgrades: {
            ...c.upgrades,
            [stat]: currentLvl + 1,
          },
        };
      }
      return c;
    }));
  };

  const handleResetProgress = () => {
    if (window.confirm("Are you sure you want to completely reset your garage and coins progress?")) {
      localStorage.clear();
      setCoins(100);
      setHighScore(0);
      setActiveCarId('rocket');
      setCars(INITIAL_CARS);
      setTrackConfig(DEFAULT_TRACK_CONFIG);
      setTrack(generateProceduralTrack(DEFAULT_TRACK_CONFIG));
      setScreen('menu');
    }
  };

  const handleClaimDailyBonus = () => {
    setCoins(prev => prev + dailyBonusAmount);
    localStorage.setItem('minicars_last_claim_date', new Date().toDateString());
    setShowDailyBonusModal(false);
    audio.playCoinSound();
  };

  const currentCar = cars.find(c => c.id === activeCarId) || cars[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-zinc-950 flex flex-col justify-center items-center">
      
      {/* 1. Main Background Live Game Canvas (always rendering behind menu for dynamic depth effect) */}
      <div className="absolute inset-0 w-full h-full">
        <GameCanvas
          track={track}
          car={currentCar}
          stats={stats}
          onUpdateStats={(upd) => setStats(prev => ({ ...prev, ...upd }))}
          onAddCoins={(amount) => {}} // handled dynamically via game over
          inputs={inputs}
          onNitroActive={(charged) => setNitroCharged(charged)}
          nitroCharged={nitroCharged}
          onSpeedUpdate={(speed, progress, distRemaining) => {
            setCurrentSpeed(speed);
            setRouteProgress(progress);
            setDistanceRemaining(distRemaining);
          }}
          screen={screen}
          onLevelCompleted={handleLevelCompleted}
        />
      </div>

      {/* 2. MAIN MENU SCREEN OVERLAY */}
      {screen === 'menu' && (
        <div id="main-menu-overlay" className="absolute inset-0 z-40 bg-zinc-950/50 backdrop-blur-[2px] flex flex-col justify-between items-center p-6 text-zinc-100 font-sans">
          
          {/* Header Row */}
          <div className="w-full max-w-4xl flex justify-between items-center mt-2">
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-400 shadow-lg">
              🏆 High Score: <span className="text-cyan-400 font-mono ml-1">{highScore}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-lg">
              <Coins className="w-4 h-4 animate-bounce" />
              <span>{coins} G</span>
            </div>
          </div>

          {/* Core Branding Panel */}
          <div className="text-center flex flex-col items-center max-w-xl my-auto gap-4">
            
            {/* Red Racing Car Picture above 'MINI CAR RACING' */}
            <div className="w-24 h-14 flex items-center justify-center animate-bounce-slow filter drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              <RacingCarSVG color="#ef4444" accentColor="#38bdf8" />
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter leading-none bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent flex flex-col items-center">
              MINI CAR RACING
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noreferrer" 
                className="block text-[10px] sm:text-xs font-bold tracking-normal text-cyan-400 hover:text-cyan-300 transition-colors mt-2 underline pointer-events-auto"
              >
                {window.location.hostname || "ais-dev-wurkz2cwadjzdmdfc63d5e-514427024190.asia-east1.run.app"}
              </a>
            </h1>
            
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md px-4">
              Race through dynamically generated procedural asphalt circuits. Slide around tight bends, charge your nitro boost, and upgrade your miniature fleet!
            </p>

            {/* Current Selected Car Preview Card */}
            <div className="mt-4 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 w-72 flex flex-col items-center gap-3 shadow-2xl relative group">
              <div className="absolute top-2.5 right-2.5 text-[8px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">READY TO DRAG</div>
              <div className="w-20 h-12 rounded-lg flex items-center justify-center bg-zinc-950 border border-zinc-850 relative overflow-hidden mt-1 shadow-inner">
                <RacingCarSVG 
                  color={getCarColorForLevel(stats.currentLevel || 1, currentCar.color)} 
                  accentColor={getCarAccentForLevel(stats.currentLevel || 1, currentCar.accentColor)} 
                />
              </div>
              <div className="text-center">
                <div className="text-xs font-extrabold text-white leading-none">{currentCar.name}</div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  Speed: Lvl {currentCar.upgrades.speed} • Accel: Lvl {currentCar.upgrades.acceleration} • Handling: Lvl {currentCar.upgrades.grip}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Navigation Buttons Grid */}
          <div className="w-full max-w-md flex flex-col gap-3.5 mb-4">
            <button
              id="btn-play-game"
              onClick={handleStartRace}
              className="w-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-indigo-600 text-zinc-950 font-black tracking-widest uppercase py-4 rounded-2xl hover:opacity-95 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-950/40"
            >
              <Play className="w-4 h-4 fill-zinc-950" /> START GRAND PRIX
            </button>

            <button
              id="btn-open-shop"
              onClick={() => setScreen('shop')}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 font-bold py-3.5 rounded-xl border border-zinc-800 transition-colors text-xs"
            >
              <Wrench className="w-4 h-4 text-cyan-400" /> GARAGE & SHOP
            </button>

            <button
              id="btn-reset-career"
              onClick={handleResetProgress}
              className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors mt-2 text-center"
            >
              Reset Garage Progress
            </button>
          </div>
        </div>
      )}

      {/* 3. CAR GARAGE / UPGRADES MODAL OVERLAY */}
      {screen === 'shop' && (
        <CarShop
          cars={cars}
          coins={coins}
          activeCarId={activeCarId}
          onSelectCar={setActiveCarId}
          onBuyCar={handleBuyCar}
          onUpgradeCar={handleUpgradeCar}
          onClose={() => setScreen('menu')}
        />
      )}

      {/* 4.5 LEVEL COMPLETED SCREEN OVERLAY */}
      {screen === 'level_completed' && (() => {
        const currentLvlIdx = (stats.currentLevel || 1) - 1;
        const currentLvlInfo = LEVEL_DATA[currentLvlIdx] || LEVEL_DATA[0];
        const nextLvlInfo = LEVEL_DATA[currentLvlIdx + 1];

        return (
          <div id="level-completed-overlay" className="absolute inset-0 z-40 bg-zinc-950/95 flex flex-col justify-center items-center p-6 text-zinc-100 font-sans backdrop-blur-md">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col items-center gap-5 shadow-2xl relative overflow-hidden">
              
              {/* Dynamic Cheer Banner */}
              <div className="w-full text-center py-4 px-6 rounded-2xl border bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-400 shadow-lg shadow-emerald-950/20">
                <span className="text-2xl">🎉</span>
                <h2 className="text-xl font-extrabold tracking-widest text-white uppercase mt-1">
                  CONGRATULATIONS!
                </h2>
                <p className="text-[11px] text-emerald-100 uppercase tracking-wider font-semibold mt-1">
                  Level {stats.currentLevel}: {currentLvlInfo.name} Completed!
                </p>
              </div>

              {/* Stats Summary */}
              <div className="w-full space-y-3 my-1 text-sm bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
                <div className="flex justify-between text-zinc-400">
                  <span>Level Completed:</span>
                  <span className="font-extrabold text-white">Level {stats.currentLevel} / 10</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Time Remaining:</span>
                  <span className="font-mono font-bold text-cyan-400">{Math.max(0, Math.floor(stats.timeRemaining))}s</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Level Score:</span>
                  <span className="font-mono font-black text-cyan-400">{stats.score}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Gold Reward:</span>
                  <span className="font-mono font-black text-emerald-400 flex items-center gap-1">
                    <Coins className="w-4 h-4 animate-bounce" /> +100 G
                  </span>
                </div>
              </div>

              {/* Next Level details and Start Button */}
              {nextLvlInfo ? (
                <div className="w-full bg-zinc-950/30 border border-zinc-800 p-4 rounded-xl flex flex-col items-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Option: Next Level</p>
                    <h4 className="text-base font-extrabold text-teal-400 mt-0.5">
                      Level {nextLvlInfo.id}: {nextLvlInfo.name}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 italic">
                      "{nextLvlInfo.desc}"
                    </p>
                  </div>

                  <button
                    id="btn-start-next-level"
                    onClick={handleStartNextLevel}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black tracking-widest uppercase py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" /> START
                  </button>
                </div>
              ) : (
                <div className="w-full bg-zinc-950/30 border border-zinc-800 p-4 rounded-xl flex flex-col items-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Ultimate Achievement</p>
                    <h4 className="text-lg font-extrabold text-cyan-400 mt-0.5">
                      🏆 GRAND PRIX CHAMPION!
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      You have successfully conquered all 10 lap levels!
                    </p>
                  </div>

                  <button
                    id="btn-win-restart"
                    onClick={handleStartRace}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black tracking-widest uppercase py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> RACE AGAIN FROM LVL 1
                  </button>
                </div>
              )}

              {/* Main Menu Button */}
              <button
                id="btn-go-menu-complete"
                onClick={() => setScreen('menu')}
                className="w-full bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-medium py-2.5 rounded-xl border border-zinc-850 transition-colors text-xs"
              >
                Main Menu
              </button>
            </div>
          </div>
        );
      })()}

      {/* 5. MATCH OUTCOME (GAME OVER / VICTORY) SCREEN OVERLAY */}
      {screen === 'gameover' && (
        <div id="game-over-overlay" className="absolute inset-0 z-40 bg-zinc-950/90 flex flex-col justify-center items-center p-6 text-zinc-100 font-sans backdrop-blur-md">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col items-center gap-5 shadow-2xl relative overflow-hidden">
            
            {/* Dynamic Win/Loss styling banner */}
            <div className={`w-full text-center py-3.5 px-6 rounded-2xl border ${
              stats.isWon
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400 shadow-lg shadow-emerald-950/20'
                : 'bg-gradient-to-r from-red-950 to-red-900 border-red-500/30'
            }`}>
              <h2 className="text-xl font-extrabold tracking-widest text-white uppercase">
                {stats.isWon
                  ? '🏆 GRAND PRIX CHAMP'
                  : (stats.lives === 0 ? '💀 OUT OF LIVES' : '💀 TIME OUT!')}
              </h2>
              <p className="text-[10px] text-zinc-300 mt-1 uppercase tracking-wider">
                {stats.isWon
                  ? 'Course record shattered!'
                  : (stats.lives === 0 ? 'Wrecked your vehicle!' : 'Out of fuel before checkpoint!')}
              </p>
            </div>

            {/* Run Recap details */}
            <div className="w-full space-y-2.5 my-1 text-sm bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
              <div className="flex justify-between text-zinc-400">
                <span>Laps Completed:</span>
                <span className="font-extrabold text-white">{stats.lapsCompleted} / 10</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Run Score:</span>
                <span className="font-mono font-black text-cyan-400">{stats.score}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Gold Earned:</span>
                <span className="font-mono font-black text-cyan-400 flex items-center gap-1">
                  <Coins className="w-4 h-4 animate-bounce" /> +{stats.coinsCollected}
                </span>
              </div>
              <div className="h-px bg-zinc-800/80 my-2" />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Personal Best Score:</span>
                <span className="font-mono">{highScore}</span>
              </div>
            </div>

            {/* Buttons Row */}
            <div className="w-full flex flex-col gap-2.5 mt-2">
              <button
                id="btn-restart-gp"
                onClick={handleStartRace}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black tracking-widest uppercase py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> RACE AGAIN
              </button>

              <button
                id="btn-go-garage"
                onClick={() => setScreen('shop')}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-3.5 rounded-xl border border-zinc-700 transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Wrench className="w-4 h-4 text-cyan-400" /> VISIT GARAGE
              </button>

              <button
                id="btn-go-menu"
                onClick={() => setScreen('menu')}
                className="w-full bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-medium py-2.5 rounded-xl border border-zinc-850 transition-colors text-xs"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. LIVE IN-GAME HUD & TOUCH CONTROLS PANEL */}
      {screen === 'playing' && (
        <>
          <GameHUD
            stats={stats}
            car={currentCar}
            onRestart={handleStartRace}
            onOpenShop={() => setScreen('shop')}
            onOpenConfig={() => setScreen('config')}
            nitroCharged={nitroCharged}
            speed={currentSpeed}
            maxSpeed={currentCar.baseMaxSpeed + currentCar.upgrades.speed * 35}
            routeProgress={routeProgress}
            distanceRemaining={distanceRemaining}
            totalCoins={coins}
          />

          <TouchControls
            onSteerLeft={(val) => setInputs(prev => ({ ...prev, steerLeft: val }))}
            onSteerRight={(val) => setInputs(prev => ({ ...prev, steerRight: val }))}
            onGas={(val) => setInputs(prev => ({ ...prev, gas: val }))}
            onBrake={(val) => setInputs(prev => ({ ...prev, brake: val }))}
            onNitro={(val) => setInputs(prev => ({ ...prev, nitro: val }))}
            nitroCharged={nitroCharged}
          />
        </>
      )}

      {/* 7. DAILY LOGIN BONUS POPUP OVERLAY */}
      {showDailyBonusModal && (
        <div id="daily-bonus-overlay" className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-md select-none">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-sm w-[90%] text-center shadow-2xl flex flex-col items-center gap-5 relative overflow-hidden animate-fade-in font-sans">
            {/* Ambient cyber cyan/blue radial glow */}
            <div className="absolute -inset-10 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-3xl animate-bounce">
              🎁
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-cyan-400 font-extrabold tracking-widest uppercase bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20 mx-auto">
                DAILY CLAIM READY
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white mt-1 uppercase">
                WELCOME BACK!
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed px-4">
                Here is your daily free coin grant to upgrade your fleet and fuel your drifting career!
              </p>
            </div>

            {/* Coin reward value */}
            <div className="flex items-center gap-2 bg-zinc-950/80 px-5 py-3 rounded-2xl border border-zinc-850 shadow-inner my-1">
              <Coins className="w-6 h-6 text-cyan-400 animate-pulse" />
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-mono">
                +{dailyBonusAmount}
              </span>
              <span className="text-xs font-bold text-zinc-500 self-end mb-1">G</span>
            </div>

            <button
              id="btn-claim-bonus"
              onClick={handleClaimDailyBonus}
              className="w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 text-zinc-950 font-black tracking-widest uppercase py-3.5 rounded-xl hover:brightness-110 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/20 cursor-pointer pointer-events-auto"
            >
              CLAIM FREE COINS
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
