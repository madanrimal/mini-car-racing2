import React from 'react';
import { CarConfig, UpgradeState } from '../types';
import { Play, Sparkles, ShieldAlert, Zap, Compass, ChevronLeft, Coins, Check } from 'lucide-react';
import { RacingCarSVG } from './RacingCarSVG';

interface CarShopProps {
  cars: CarConfig[];
  coins: number;
  activeCarId: string;
  onSelectCar: (id: string) => void;
  onBuyCar: (id: string) => void;
  onUpgradeCar: (id: string, stat: keyof UpgradeState) => void;
  onClose: () => void;
}

export const CarShop: React.FC<CarShopProps> = ({
  cars,
  coins,
  activeCarId,
  onSelectCar,
  onBuyCar,
  onUpgradeCar,
  onClose,
}) => {
  const activeCar = cars.find(c => c.id === activeCarId) || cars[0];

  const getUpgradeCost = (currentLevel: number) => {
    if (currentLevel >= 5) return 0;
    return (currentLevel + 1) * 75; // 150, 225, 300, 375 coins
  };

  const getStatTotal = (base: number, upgradeLevel: number, multiplier: number) => {
    return base + upgradeLevel * multiplier;
  };

  return (
    <div id="car-shop-overlay" className="absolute inset-0 z-40 bg-zinc-950/95 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto font-sans text-zinc-100">
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
        <button
          id="btn-close-shop"
          onClick={onClose}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Menu
        </button>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
          MINI CAR GARAGE
        </h1>
        <div className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-lg border border-cyan-500/20 text-sm font-semibold">
          <Coins className="w-4 h-4 animate-bounce" />
          <span>{coins}</span>
        </div>
      </div>

      {/* Grid Content */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left column: Car Selection Carousel */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-400 tracking-wider uppercase px-1">Choose Car</h2>
          <div className="flex flex-col gap-2.5 max-h-[450px] overflow-y-auto pr-1">
            {cars.map((car) => {
              const isActive = car.id === activeCarId;
              const isSelected = activeCar.id === car.id;
              return (
                <div
                  key={car.id}
                  onClick={() => car.unlocked ? onSelectCar(car.id) : null}
                  className={`relative p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between group ${
                    isActive
                      ? 'bg-zinc-900 border-cyan-500/70 shadow-lg shadow-cyan-950/20'
                      : car.unlocked
                      ? 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                      : 'bg-zinc-950 border-zinc-900/60 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Tiny Render of Car */}
                    <div className="w-14 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center relative overflow-hidden">
                      <div className="scale-75 origin-center">
                        <RacingCarSVG color={car.color} accentColor={car.accentColor} />
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm tracking-wide">{car.name}</h3>
                      <p className="text-xs text-zinc-500">
                        {car.unlocked ? (isActive ? 'Active Racer' : 'Unlocked') : 'Locked'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {car.unlocked ? (
                      isActive ? (
                        <div className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 p-1.5 rounded-lg">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <button
                          id={`btn-select-car-${car.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCar(car.id);
                          }}
                          className="bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 py-1.5 px-3 rounded-lg border border-zinc-700 transition-colors"
                        >
                          Select
                        </button>
                      )
                    ) : (
                      <button
                        id={`btn-buy-car-${car.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (coins >= car.cost) {
                            onBuyCar(car.id);
                          }
                        }}
                        disabled={coins < car.cost}
                        className={`text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 border transition-all ${
                          coins >= car.cost
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-600 font-bold'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700/50 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>{car.cost}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Detailed Car Specs & Upgrades */}
        <div className="md:col-span-7 flex flex-col gap-4 bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-20 h-12 rounded-lg flex items-center justify-center relative overflow-hidden bg-zinc-950 border border-zinc-800">
              <RacingCarSVG color={activeCar.color} accentColor={activeCar.accentColor} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-wide text-white">{activeCar.name}</h2>
              <p className="text-xs text-zinc-400">Spec Tuning & Part Upgrades</p>
            </div>
          </div>

          <div className="space-y-4 my-2 border-y border-zinc-800/60 py-4">
            {/* SPEED STAT */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1 text-red-400">
                  <Zap className="w-3.5 h-3.5" /> Top Speed
                </span>
                <span className="text-zinc-400">
                  Lvl {activeCar.upgrades.speed}/5 (
                  {Math.round(getStatTotal(activeCar.baseMaxSpeed, activeCar.upgrades.speed, 35) / 2)} mph)
                </span>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-8 flex gap-1 h-2 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-full flex-1 rounded-sm transition-all duration-300 ${
                        lvl <= activeCar.upgrades.speed
                          ? 'bg-gradient-to-r from-red-500 to-orange-400'
                          : 'bg-zinc-800/50'
                      }`}
                    />
                  ))}
                </div>
                <div className="col-span-4">
                  {activeCar.upgrades.speed >= 5 ? (
                    <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 block text-center font-bold">MAXED</span>
                  ) : (
                    <button
                      id={`btn-upgrade-speed-${activeCar.id}`}
                      onClick={() => onUpgradeCar(activeCar.id, 'speed')}
                      disabled={coins < getUpgradeCost(activeCar.upgrades.speed)}
                      className={`w-full text-[10px] py-1 px-1.5 rounded flex items-center justify-center gap-1 font-bold transition-all ${
                        coins >= getUpgradeCost(activeCar.upgrades.speed)
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700'
                          : 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3 h-3" />
                      {getUpgradeCost(activeCar.upgrades.speed)}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ACCELERATION STAT */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1 text-green-400">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Acceleration
                </span>
                <span className="text-zinc-400">
                  Lvl {activeCar.upgrades.acceleration}/5
                </span>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-8 flex gap-1 h-2 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-full flex-1 rounded-sm transition-all duration-300 ${
                        lvl <= activeCar.upgrades.acceleration
                          ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                          : 'bg-zinc-800/50'
                      }`}
                    />
                  ))}
                </div>
                <div className="col-span-4">
                  {activeCar.upgrades.acceleration >= 5 ? (
                    <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 block text-center font-bold">MAXED</span>
                  ) : (
                    <button
                      id={`btn-upgrade-accel-${activeCar.id}`}
                      onClick={() => onUpgradeCar(activeCar.id, 'acceleration')}
                      disabled={coins < getUpgradeCost(activeCar.upgrades.acceleration)}
                      className={`w-full text-[10px] py-1 px-1.5 rounded flex items-center justify-center gap-1 font-bold transition-all ${
                        coins >= getUpgradeCost(activeCar.upgrades.acceleration)
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700'
                          : 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3 h-3" />
                      {getUpgradeCost(activeCar.upgrades.acceleration)}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* GRIP / HANDLING STAT */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="flex items-center gap-1 text-cyan-400">
                  <Compass className="w-3.5 h-3.5" /> Grip & Steering
                </span>
                <span className="text-zinc-400">
                  Lvl {activeCar.upgrades.grip}/5
                </span>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-8 flex gap-1 h-2 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-full flex-1 rounded-sm transition-all duration-300 ${
                        lvl <= activeCar.upgrades.grip
                          ? 'bg-gradient-to-r from-cyan-500 to-indigo-400'
                          : 'bg-zinc-800/50'
                      }`}
                    />
                  ))}
                </div>
                <div className="col-span-4">
                  {activeCar.upgrades.grip >= 5 ? (
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 block text-center font-bold">MAXED</span>
                  ) : (
                    <button
                      id={`btn-upgrade-grip-${activeCar.id}`}
                      onClick={() => onUpgradeCar(activeCar.id, 'grip')}
                      disabled={coins < getUpgradeCost(activeCar.upgrades.grip)}
                      className={`w-full text-[10px] py-1 px-1.5 rounded flex items-center justify-center gap-1 font-bold transition-all ${
                        coins >= getUpgradeCost(activeCar.upgrades.grip)
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700'
                          : 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3 h-3" />
                      {getUpgradeCost(activeCar.upgrades.grip)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Drifting Mechanic Info */}
          <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/50 text-xs leading-relaxed text-zinc-400">
            <strong className="text-zinc-200 block mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Drifting Mechanic
            </strong>
            When turning sharply at high speed, your tires lose lateral grip and initiate a slide. Slide around curves to charge your <span className="text-cyan-400 font-bold">Nitro Booster</span>! Tap the Nitro pedal to trigger raw warp-speed acceleration!
          </div>

          <button
            id="btn-confirm-active-car"
            onClick={onClose}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 text-zinc-950 font-black tracking-widest uppercase py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-500/15"
          >
            <Play className="w-4 h-4 fill-zinc-950" /> SELECT</button>
        </div>
      </div>
    </div>
  );
};
