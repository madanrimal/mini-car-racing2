import React, { useState } from 'react';
import { GeneratorConfig } from '../utils/trackGenerator';
import { Settings, RefreshCw, Sparkles, MapPin, Sliders, Info } from 'lucide-react';

interface TrackConfiguratorProps {
  currentConfig: GeneratorConfig;
  onGenerate: (newConfig: GeneratorConfig) => void;
  onClose: () => void;
}

export const TrackConfigurator: React.FC<TrackConfiguratorProps> = ({
  currentConfig,
  onGenerate,
  onClose,
}) => {
  const [config, setConfig] = useState<GeneratorConfig>({ ...currentConfig });

  const handleSliderChange = (key: keyof GeneratorConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRandomize = () => {
    setConfig({
      pointsCount: Math.floor(8 + Math.random() * 8), // 8 to 16
      radius: Math.floor(900 + Math.random() * 500), // 900 to 1400
      turniness: Math.round((0.15 + Math.random() * 0.25) * 100) / 100, // 0.15 to 0.40
      trackWidth: Math.floor(150 + Math.random() * 80), // 150 to 230
      obstacleDensity: Math.round((0.3 + Math.random() * 0.5) * 100) / 100, // 0.3 to 0.8
      coinDensity: Math.round((0.4 + Math.random() * 0.5) * 100) / 100, // 0.4 to 0.9
    });
  };

  const handleApply = () => {
    onGenerate(config);
    onClose();
  };

  return (
    <div id="track-configurator-overlay" className="absolute inset-0 z-40 bg-zinc-950/95 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto font-sans text-zinc-100">
      {/* Header */}
      <div className="w-full max-w-xl flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-wider flex items-center gap-2 text-cyan-400">
          <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
          <span>CIRCUIT GENERATOR</span>
        </h1>
        <button
          id="btn-close-config"
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 text-sm"
        >
          Cancel
        </button>
      </div>

      <div className="w-full max-w-xl bg-zinc-900/50 border border-zinc-800/80 p-5 rounded-2xl flex flex-col gap-5">
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950/80 p-3 rounded-xl border border-zinc-850">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Adjust the parameters below to trigger spline deformation, spawning algorithms, and custom asphalt scale in our high-performance procedural generation engine.</span>
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          {/* Points Count */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-indigo-400" /> Curve Points (Shape Complexity)</span>
              <span className="text-cyan-400">{config.pointsCount} anchor nodes</span>
            </div>
            <input
              id="slider-points-count"
              type="range"
              min="6"
              max="18"
              step="1"
              value={config.pointsCount}
              onChange={(e) => handleSliderChange('pointsCount', parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[10px] text-zinc-500">Higher numbers generate more turns and complex zigzag shapes.</p>
          </div>

          {/* Track Radius */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-indigo-400" /> Track Span / Radius</span>
              <span className="text-cyan-400">{config.radius} px</span>
            </div>
            <input
              id="slider-track-radius"
              type="range"
              min="800"
              max="1800"
              step="50"
              value={config.radius}
              onChange={(e) => handleSliderChange('radius', parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[10px] text-zinc-500">Overall size of the track loop. Larger values create massive, speedy circuits.</p>
          </div>

          {/* Turniness */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-indigo-400" /> Curve Aggressiveness</span>
              <span className="text-cyan-400">{Math.round(config.turniness * 100)}% deviation</span>
            </div>
            <input
              id="slider-turniness"
              type="range"
              min="0.05"
              max="0.45"
              step="0.05"
              value={config.turniness}
              onChange={(e) => handleSliderChange('turniness', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[10px] text-zinc-500">Controls deviation of radial points. High values produce sharp, winding curves.</p>
          </div>

          {/* Track Width */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-indigo-400" /> Asphalt Track Width</span>
              <span className="text-cyan-400">{config.trackWidth} meters</span>
            </div>
            <input
              id="slider-track-width"
              type="range"
              min="140"
              max="240"
              step="10"
              value={config.trackWidth}
              onChange={(e) => handleSliderChange('trackWidth', parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[10px] text-zinc-500">Narrower widths are challenging and demand absolute precision drifting.</p>
          </div>

          {/* Obstacle Density */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-indigo-400" /> Obstacle Density (Oil, Barricades)</span>
              <span className="text-cyan-400">{Math.round(config.obstacleDensity * 100)}% spawn rate</span>
            </div>
            <input
              id="slider-obstacle-density"
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              value={config.obstacleDensity}
              onChange={(e) => handleSliderChange('obstacleDensity', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Coin Density */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-300">
              <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-indigo-400" /> Gold Coin Density</span>
              <span className="text-cyan-400">{Math.round(config.coinDensity * 100)}% spawn rate</span>
            </div>
            <input
              id="slider-coin-density"
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={config.coinDensity}
              onChange={(e) => handleSliderChange('coinDensity', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4 border-t border-zinc-800 pt-4">
          <button
            id="btn-randomize-config"
            type="button"
            onClick={handleRandomize}
            className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 rounded-xl border border-zinc-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Randomize
          </button>
          <button
            id="btn-apply-config"
            type="button"
            onClick={handleApply}
            className="flex items-center justify-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black tracking-wider uppercase py-2.5 rounded-xl transition-all text-sm shadow-md shadow-cyan-950"
          >
            <Sparkles className="w-4 h-4 fill-zinc-950" /> Generate Road
          </button>
        </div>
      </div>
    </div>
  );
};
