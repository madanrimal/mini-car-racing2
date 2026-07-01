import React from 'react';

interface RacingCarSVGProps {
  color: string;
  accentColor: string;
}

export const RacingCarSVG: React.FC<RacingCarSVGProps> = ({ color, accentColor }) => (
  <svg 
    viewBox="0 0 100 60" 
    className="w-20 h-12 drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] overflow-visible"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Ambient Under-Car Shadow */}
    <rect x="12" y="10" width="76" height="40" rx="8" fill="rgba(0,0,0,0.55)" filter="blur(2px)" />

    {/* Front Suspension Wishbones (Professional F1 look) */}
    <line x1="28" y1="18" x2="40" y2="24" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
    <line x1="28" y1="42" x2="40" y2="36" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
    <line x1="24" y1="18" x2="35" y2="25" stroke="#334155" strokeWidth="1.5" />
    <line x1="24" y1="42" x2="35" y2="35" stroke="#334155" strokeWidth="1.5" />

    {/* Rear Suspension Wishbones */}
    <line x1="78" y1="16" x2="68" y2="24" stroke="#475569" strokeWidth="2.5" />
    <line x1="78" y1="44" x2="68" y2="36" stroke="#475569" strokeWidth="2.5" />

    {/* Front Wheels (Racing Slicks) */}
    <rect x="20" y="10" width="14" height="8" rx="2.5" fill="#09090b" stroke="#27272a" strokeWidth="1" />
    {/* Alloy Rims and Red Brake Calipers (Detail!) */}
    <circle cx="27" cy="14" r="3.5" fill="#94a3b8" />
    <circle cx="27" cy="14" r="2" fill="#475569" />
    <path d="M 24 12 A 3.5 3.5 0 0 1 27 10.5" stroke="#ef4444" strokeWidth="1.2" fill="none" /> {/* Caliper */}
    <circle cx="27" cy="14" r="0.8" fill="#f8fafc" />

    {/* Front Wheels Right Side */}
    <rect x="20" y="42" width="14" height="8" rx="2.5" fill="#09090b" stroke="#27272a" strokeWidth="1" />
    <circle cx="27" cy="46" r="3.5" fill="#94a3b8" />
    <circle cx="27" cy="46" r="2" fill="#475569" />
    <path d="M 24 44 A 3.5 3.5 0 0 1 27 42.5" stroke="#ef4444" strokeWidth="1.2" fill="none" />
    <circle cx="27" cy="46" r="0.8" fill="#f8fafc" />

    {/* Rear Wheels (Extra Wide Slick Tires) */}
    <rect x="74" y="8" width="16" height="10" rx="3" fill="#09090b" stroke="#27272a" strokeWidth="1" />
    <circle cx="82" cy="13" r="4.5" fill="#cbd5e1" />
    <circle cx="82" cy="13" r="2.5" fill="#64748b" />
    <path d="M 78 11 A 4.5 4.5 0 0 1 82 8.5" stroke="#ef4444" strokeWidth="1.5" fill="none" />
    <circle cx="82" cy="13" r="1" fill="#f8fafc" />

    {/* Rear Wheels Right Side */}
    <rect x="74" y="42" width="16" height="10" rx="3" fill="#09090b" stroke="#27272a" strokeWidth="1" />
    <circle cx="82" cy="47" r="4.5" fill="#cbd5e1" />
    <circle cx="82" cy="47" r="2.5" fill="#64748b" />
    <path d="M 78 45 A 4.5 4.5 0 0 1 82 42.5" stroke="#ef4444" strokeWidth="1.5" fill="none" />
    <circle cx="82" cy="47" r="1" fill="#f8fafc" />

    {/* Front Aerodynamic Splitter / Wing */}
    <path d="M 10 20 L 16 16 L 18 20 L 18 40 L 16 44 L 10 40 Z" fill={accentColor} stroke="#09090b" strokeWidth="1" />
    {/* Splitter Endplates */}
    <rect x="10" y="16" width="6" height="2.5" rx="0.5" fill={color} />
    <rect x="10" y="41.5" width="6" height="2.5" rx="0.5" fill={color} />

    {/* F1 Barge boards (Aero Turning Vanes) */}
    <path d="M 38 18 L 44 20 L 42 24 L 36 22 Z" fill="#0f172a" />
    <path d="M 38 42 L 44 40 L 42 36 L 36 38 Z" fill="#0f172a" />

    {/* Main Aerodynamic Body Monocoque */}
    <path d="M 16 26 L 30 20 L 50 18 L 68 20 L 76 24 L 84 25 L 84 35 L 76 36 L 68 40 L 50 42 L 30 40 L 16 34 Z" fill={color} stroke="#09090b" strokeWidth="1.5" />

    {/* Sidepods with Carbon Intake mesh openings */}
    <path d="M 38 21 C 42 21 46 19 50 20 L 54 26 L 46 25 Z" fill="#1e293b" />
    <path d="M 38 21 C 42 21 46 19 50 20 L 54 26 L 46 25 Z" fill={color} opacity="0.85" />
    <path d="M 38 39 C 42 39 46 41 50 40 L 54 34 L 46 35 Z" fill="#1e293b" />
    <path d="M 38 39 C 42 39 46 41 50 40 L 54 34 L 46 35 Z" fill={color} opacity="0.85" />
    {/* Dark Air Intake vents */}
    <ellipse cx="37" cy="22" rx="1.5" ry="1.2" fill="#020617" />
    <ellipse cx="37" cy="38" rx="1.5" ry="1.2" fill="#020617" />

    {/* Carbon Fiber Engine Cover Spine */}
    <path d="M 52 26 L 76 28 L 76 32 L 52 34 Z" fill="#0f172a" />

    {/* Professional Racing stripes (Dual Centerlines) */}
    <rect x="18" y="28.2" width="34" height="1.4" fill="#ffffff" />
    <rect x="18" y="30.4" width="34" height="1.4" fill="#ffffff" />

    {/* Cockpit Safety Cell Halo Protection System */}
    <path d="M 34 26 L 40 25 L 48 26 L 48 34 L 40 35 L 34 34 L 38 30 Z" fill="#020617" stroke="#334155" strokeWidth="0.8" />
    
    {/* Cockpit Canopy Windshield glass */}
    <rect x="42" y="27" width="10" height="6" rx="1.5" fill="#1e293b" />
    <path d="M 43 28 L 48 28 L 45 32 L 43 32 Z" fill="rgba(255,255,255,0.25)" /> {/* Glare */}

    {/* Miniature Racing Driver Helmet */}
    <circle cx="45" cy="30" r="2.8" fill="#f1f5f9" />
    <path d="M 45 27.2 A 2.8 2.8 0 0 1 47.8 30 L 45 30 Z" fill="#0f172a" /> {/* Black Visor */}
    <rect x="42.5" y="29.5" width="2.5" height="1" rx="0.3" fill="#ef4444" /> {/* Red Helmet Stripe */}

    {/* Racing Number Emblem Badge */}
    <circle cx="30" cy="30" r="4.5" fill="#ffffff" stroke="#000000" strokeWidth="0.8" />
    <text x="30" y="30" fill="#0f172a" fontSize="6.5" fontWeight="black" textAnchor="middle" dominantBaseline="central" fontFamily="monospace">7</text>

    {/* Rear Wing Endplates */}
    <rect x="80" y="11" width="5" height="3" rx="0.5" fill={color} stroke="#000000" strokeWidth="0.5" />
    <rect x="80" y="46" width="5" height="3" rx="0.5" fill={color} stroke="#000000" strokeWidth="0.5" />

    {/* Large Rear Carbon Wing spoiler blade */}
    <rect x="82" y="13" width="4" height="34" rx="1" fill="#1e293b" stroke="#000000" strokeWidth="1" />
    <rect x="84" y="13.5" width="1.5" height="33" fill={accentColor} />

    {/* Chrome Dual Exhaust Outlets */}
    <rect x="84" y="27" width="3" height="1.8" rx="0.4" fill="#64748b" />
    <rect x="84" y="31.2" width="3" height="1.8" rx="0.4" fill="#64748b" />
    <circle cx="87" cy="27.9" r="0.6" fill="#09090b" />
    <circle cx="87" cy="32.1" r="0.6" fill="#09090b" />
  </svg>
);
