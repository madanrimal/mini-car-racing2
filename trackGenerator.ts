export interface Vector2D {
  x: number;
  y: number;
}

export interface UpgradeState {
  speed: number; // 1 to 5
  acceleration: number; // 1 to 5
  grip: number; // 1 to 5
}

export interface CarConfig {
  id: string;
  name: string;
  baseMaxSpeed: number; // px/s
  baseAcceleration: number; // px/s^2
  baseGrip: number; // side friction coefficient (0.8 - 0.98)
  driftFactor: number; // how much traction is lost during drift (0.3 - 0.6)
  color: string;
  accentColor: string;
  cost: number;
  unlocked: boolean;
  upgrades: UpgradeState;
}

export interface TrackPoint {
  pos: Vector2D;
  tangent: Vector2D;
  normal: Vector2D;
  left: Vector2D;
  right: Vector2D;
  index: number;
}

export interface Checkpoint {
  pos: Vector2D;
  width: number;
  angle: number;
  passed: boolean;
  index: number;
}

export interface Coin {
  pos: Vector2D;
  collected: boolean;
  id: string;
  isTimeControl?: boolean;
  timeStyle?: number;
  isLifeControl?: boolean;
}

export interface Obstacle {
  pos: Vector2D;
  type: 'cone' | 'barrier' | 'oil' | 'boost';
  id: string;
  radius: number;
  angle: number;
}

export interface TrafficVehicle {
  id: string;
  x: number;
  y: number;
  speed: number;
  lane: number;
  color: string;
  type: 'sedan' | 'truck' | 'sport' | 'taxi' | 'motorbike';
  width: number;
  height: number;
  laneChangeTimer: number;
  targetLane: number;
}

export interface Track {
  points: TrackPoint[];
  centerline: Vector2D[];
  checkpoints: Checkpoint[];
  coins: Coin[];
  obstacles: Obstacle[];
  width: number;
  startPoint: Vector2D;
  startAngle: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  type: 'smoke' | 'spark' | 'skid';
}

export interface GameStats {
  score: number;
  coinsCollected: number;
  timeRemaining: number;
  totalTime: number;
  lapsCompleted: number;
  currentCheckpoint: number;
  isGameOver: boolean;
  isWon: boolean;
  highScore: number;
  currentLevel: number;
  lives?: number;
  maxLives?: number;
}
