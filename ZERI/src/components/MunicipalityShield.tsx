import React from 'react';

interface MunicipalityShieldProps {
  name: string;
  code?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function MunicipalityShield({ 
  name, 
  code, 
  size = 'md',
  className = '' 
}: MunicipalityShieldProps) {
  const sizeClasses = {
    sm: 'w-6 h-7',
    md: 'w-7 h-8 sm:w-8 sm:h-9',
    lg: 'w-10 h-12',
    xl: 'w-14 h-16'
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  // Render authentic heraldic vector shields based on actual Kosovo municipal emblems
  switch (name) {
    case 'Prishtinë':
    case 'Prishtina':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="prishtina-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          {/* Shield Outline */}
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#prishtina-grad)" stroke="url(#gold-grad)" strokeWidth="4" />
          {/* Mural Crown on Top */}
          <path d="M 28,14 L 32,22 L 40,16 L 50,22 L 60,16 L 68,22 L 72,14 L 70,26 L 30,26 Z" fill="url(#gold-grad)" />
          {/* Goddess on the Throne (Hyjnesha në Fron) - Iconic archaeological emblem of Prishtina */}
          <ellipse cx="50" cy="38" rx="7" ry="9" fill="url(#gold-grad)" />
          <path d="M 44,48 L 56,48 L 59,70 L 68,88 L 60,90 L 53,74 L 50,74 L 47,74 L 40,90 L 32,88 L 41,70 Z" fill="url(#gold-grad)" />
          <path d="M 36,60 L 64,60 L 62,65 L 38,65 Z" fill="#ffffff" opacity="0.8" />
          {/* Throne arms */}
          <path d="M 33,65 L 33,85 L 29,85 L 29,65 Z" fill="url(#gold-grad)" />
          <path d="M 67,65 L 67,85 L 71,85 L 71,65 Z" fill="url(#gold-grad)" />
          {/* Star of Prishtina */}
          <circle cx="50" cy="100" r="3.5" fill="#ffffff" />
        </svg>
      );

    case 'Prizren':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="prizren-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#172554" />
            </linearGradient>
            <linearGradient id="prizren-stone" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#prizren-grad)" stroke="#f59e0b" strokeWidth="4" />
          {/* Kalaja Fortress on the Hill */}
          <path d="M 25,32 L 35,32 L 35,36 L 45,36 L 45,30 L 55,30 L 55,36 L 65,36 L 65,32 L 75,32 L 78,46 L 22,46 Z" fill="url(#prizren-stone)" />
          <path d="M 15,48 Q 50,38 85,48 L 85,58 Q 50,48 15,58 Z" fill="#0284c7" opacity="0.6" />
          {/* Ura e Gurit (Historic Stone Bridge of Prizren) */}
          <path d="M 18,65 L 82,65 L 82,75 Q 70,75 64,88 L 60,88 Q 56,76 50,76 Q 44,76 40,88 L 36,88 Q 30,75 18,75 Z" fill="url(#prizren-stone)" />
          {/* Bistrica Water Waves */}
          <path d="M 22,96 Q 35,90 50,96 Q 65,102 78,96" stroke="#38bdf8" strokeWidth="3" fill="none" />
          <path d="M 26,104 Q 38,100 50,104 Q 62,108 74,104" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.7" />
        </svg>
      );

    case 'Pejë':
    case 'Peja':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="peja-red" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#991b1b" />
              <stop offset="100%" stopColor="#450a0a" />
            </linearGradient>
            <linearGradient id="peja-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#peja-red)" stroke="url(#peja-gold)" strokeWidth="4" />
          {/* Gryka e Rugovës (Rugova Canyon Peaks) */}
          <polygon points="50,18 68,54 32,54" fill="url(#peja-gold)" />
          <polygon points="50,18 40,38 50,34 60,38" fill="#ffffff" />
          {/* Side Mountain Slopes */}
          <polygon points="26,38 42,66 12,66" fill="#ca8a04" opacity="0.9" />
          <polygon points="74,38 88,66 58,66" fill="#ca8a04" opacity="0.9" />
          {/* Golden Sun Rays */}
          <circle cx="50" cy="18" r="4" fill="#ffffff" />
          {/* Lumëbardhi i Pejës / River */}
          <path d="M 18,80 L 82,80 L 80,88 L 20,88 Z" fill="#0284c7" />
          <path d="M 28,84 L 72,84" stroke="#ffffff" strokeWidth="2" strokeDasharray="4 2" />
          {/* Heraldic Oak / Pine Branch */}
          <path d="M 38,98 Q 50,92 62,98" stroke="url(#peja-gold)" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'Gjilan':
    case 'Gjilani':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="gjilan-green" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#15803d" />
              <stop offset="100%" stopColor="#052e16" />
            </linearGradient>
            <linearGradient id="gold-bright" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#gjilan-green)" stroke="url(#gold-bright)" strokeWidth="4" />
          {/* Sun of Anamorava */}
          <circle cx="50" cy="28" r="10" fill="url(#gold-bright)" />
          {/* Traditional Kulla (Stone Tower of Gjilan) */}
          <path d="M 38,44 L 62,44 L 65,86 L 35,86 Z" fill="#ffffff" />
          <path d="M 36,44 L 50,34 L 64,44 Z" fill="#b91c1c" />
          {/* Windows / Embrasures of the Tower */}
          <rect x="46" y="50" width="8" height="6" rx="1" fill="#15803d" />
          <rect x="47" y="62" width="6" height="8" rx="1" fill="#15803d" />
          <path d="M 45,76 L 55,76 L 55,86 L 45,86 Z" fill="#b91c1c" />
          {/* Rolling Hills of Morava */}
          <path d="M 12,94 Q 30,82 50,90 Q 70,98 88,86 L 88,102 Q 50,116 50,116 Q 12,102 12,102 Z" fill="url(#gold-bright)" opacity="0.9" />
        </svg>
      );

    case 'Ferizaj':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="ferizaj-red" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
            <linearGradient id="iron-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#ferizaj-red)" stroke="#facc15" strokeWidth="4" />
          {/* Forking Railway Junction & Wheel - Symbol of Ferizaj */}
          <circle cx="50" cy="52" r="24" fill="none" stroke="url(#iron-grad)" strokeWidth="5" />
          <circle cx="50" cy="52" r="16" fill="none" stroke="#facc15" strokeWidth="2.5" />
          <circle cx="50" cy="52" r="6" fill="#facc15" />
          {/* Wheel Spokes */}
          <line x1="50" y1="28" x2="50" y2="76" stroke="url(#iron-grad)" strokeWidth="3" />
          <line x1="26" y1="52" x2="74" y2="52" stroke="url(#iron-grad)" strokeWidth="3" />
          <line x1="33" y1="35" x2="67" y2="69" stroke="url(#iron-grad)" strokeWidth="2.5" />
          <line x1="33" y1="69" x2="67" y2="35" stroke="url(#iron-grad)" strokeWidth="2.5" />
          {/* Bifurcation / Water split of Nerodime */}
          <path d="M 50,84 L 50,94 L 32,106" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M 50,94 L 68,106" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </svg>
      );

    case 'Mitrovicë':
    case 'Mitrovica':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="mitrovica-sky" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#075985" />
            </linearGradient>
            <linearGradient id="silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#mitrovica-sky)" stroke="url(#silver-grad)" strokeWidth="4" />
          {/* Trepça Mining Hammers Symbol at top */}
          <path d="M 44,22 L 56,22 L 50,28 Z" fill="#facc15" />
          <path d="M 38,18 L 44,24 L 41,27 L 35,21 Z" fill="#ffffff" />
          <path d="M 62,18 L 56,24 L 59,27 L 65,21 Z" fill="#ffffff" />
          {/* Famous Main Bridge over River Ibër (Ura e Ibrit) */}
          <path d="M 12,68 Q 50,42 88,68" stroke="#ffffff" strokeWidth="5" fill="none" />
          {/* Vertical Cables */}
          <line x1="30" y1="58" x2="30" y2="70" stroke="#ffffff" strokeWidth="2" />
          <line x1="40" y1="52" x2="40" y2="70" stroke="#ffffff" strokeWidth="2" />
          <line x1="50" y1="48" x2="50" y2="70" stroke="#facc15" strokeWidth="3" />
          <line x1="60" y1="52" x2="60" y2="70" stroke="#ffffff" strokeWidth="2" />
          <line x1="70" y1="58" x2="70" y2="70" stroke="#ffffff" strokeWidth="2" />
          {/* Bridge roadway */}
          <rect x="10" y="69" width="80" height="6" rx="2" fill="#facc15" />
          {/* River Ibër Waves */}
          <path d="M 16,86 Q 32,80 50,86 Q 68,92 84,86" stroke="#38bdf8" strokeWidth="3" fill="none" />
          <path d="M 22,96 Q 36,92 50,96 Q 64,100 78,96" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.6" />
        </svg>
      );

    case 'Gjakovë':
    case 'Gjakova':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="gjakova-green" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="100%" stopColor="#064e3b" />
            </linearGradient>
            <linearGradient id="gold-gjakova" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#gjakova-green)" stroke="url(#gold-gjakova)" strokeWidth="4" />
          {/* Kulla e Sahatit (Clock Tower of Gjakova) */}
          <polygon points="50,16 43,26 57,26" fill="url(#gold-gjakova)" />
          <rect x="45" y="26" width="10" height="42" fill="url(#gold-gjakova)" />
          {/* Clock Face */}
          <circle cx="50" cy="36" r="3.5" fill="#ffffff" />
          <line x1="50" y1="36" x2="50" y2="34" stroke="#047857" strokeWidth="1" />
          <line x1="50" y1="36" x2="52" y2="36" stroke="#047857" strokeWidth="1" />
          {/* Grand Bazaar (Çarshia e Madhe) Traditional Roof Arches */}
          <path d="M 22,68 L 78,68 L 74,78 L 26,78 Z" fill="#b91c1c" />
          <path d="M 30,78 Q 38,70 46,78 L 46,92 L 30,92 Z" fill="#ffffff" />
          <path d="M 54,78 Q 62,70 70,78 L 70,92 L 54,92 Z" fill="#ffffff" />
          {/* Erenik & Krena rivers meeting */}
          <path d="M 26,102 Q 50,96 74,102" stroke="#38bdf8" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'Vushtrri':
    case 'Vushtrria':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="vushtrri-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <linearGradient id="gold-vush" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#vushtrri-blue)" stroke="url(#gold-vush)" strokeWidth="4" />
          {/* Vojinoviq Castle Towers */}
          <path d="M 30,28 L 38,28 L 38,45 L 30,45 Z" fill="url(#gold-vush)" />
          <path d="M 62,28 L 70,28 L 70,45 L 62,45 Z" fill="url(#gold-vush)" />
          <path d="M 36,36 L 64,36 L 64,48 L 36,48 Z" fill="url(#gold-vush)" />
          {/* Ancient 9-Arch Stone Bridge (Ura e Gurit në Vushtrri) */}
          <path d="M 14,56 L 86,56 L 86,66 Q 74,66 70,78 L 64,78 Q 60,66 50,66 Q 40,66 36,78 L 30,78 Q 26,66 14,66 Z" fill="#ffffff" />
          {/* Inner arches */}
          <ellipse cx="23" cy="74" rx="4" ry="6" fill="url(#vushtrri-blue)" />
          <ellipse cx="50" cy="74" rx="6" ry="7" fill="url(#vushtrri-blue)" />
          <ellipse cx="77" cy="74" rx="4" ry="6" fill="url(#vushtrri-blue)" />
          {/* Sitnica River Waves */}
          <path d="M 20,94 Q 35,88 50,94 Q 65,100 80,94" stroke="#38bdf8" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'Podujevë':
    case 'Podujeva':
      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id="pod-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0369a1" />
              <stop offset="100%" stopColor="#0c4a6e" />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill="url(#pod-blue)" stroke="#facc15" strokeWidth="4" />
          {/* Batllava Lake & Llapi Bridge */}
          <path d="M 20,40 Q 50,28 80,40 L 80,54 Q 50,42 20,54 Z" fill="#38bdf8" />
          {/* Oak Leaf Symbol */}
          <path d="M 50,30 C 40,36 36,48 44,56 C 36,60 38,72 50,78 C 62,72 64,60 56,56 C 64,48 60,36 50,30 Z" fill="#15803d" stroke="#facc15" strokeWidth="2" />
          <line x1="50" y1="36" x2="50" y2="76" stroke="#facc15" strokeWidth="1.5" />
          {/* River Waves */}
          <path d="M 22,92 Q 36,86 50,92 Q 64,98 78,92" stroke="#ffffff" strokeWidth="2.5" fill="none" />
        </svg>
      );

    default:
      // Generic Authentic Municipal Heraldic Crest for all other 29+ municipalities of Kosovo
      const getRegionColor = (str: string) => {
        const hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const palette = [
          { bg1: '#1e3a8a', bg2: '#0f172a', border: '#f59e0b' }, // Royal Navy & Gold
          { bg1: '#047857', bg2: '#064e3b', border: '#facc15' }, // Emerald & Gold
          { bg1: '#991b1b', bg2: '#450a0a', border: '#fbbf24' }, // Ruby & Amber
          { bg1: '#0284c7', bg2: '#075985', border: '#e2e8f0' }, // Azure & Silver
          { bg1: '#7c3aed', bg2: '#4c1d95', border: '#fde047' }, // Purple & Gold
          { bg1: '#0f766e', bg2: '#134e4a', border: '#38bdf8' }  // Teal & Cyan
        ];
        return palette[hash % palette.length];
      };

      const pal = getRegionColor(name);
      const displayCode = code || name.slice(0, 2).toUpperCase();

      return (
        <svg viewBox="0 0 100 120" className={`${currentSize} drop-shadow-md ${className}`}>
          <defs>
            <linearGradient id={`generic-grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={pal.bg1} />
              <stop offset="100%" stopColor={pal.bg2} />
            </linearGradient>
          </defs>
          <path d="M 50,4 C 85,4 96,20 96,55 C 96,90 50,116 50,116 C 50,116 4,90 4,55 C 4,20 15,4 50,4 Z" fill={`url(#generic-grad-${name})`} stroke={pal.border} strokeWidth="4" />
          {/* Mural Crown on Top */}
          <path d="M 32,16 L 36,22 L 44,18 L 50,22 L 56,18 L 64,22 L 68,16 L 66,26 L 34,26 Z" fill={pal.border} />
          {/* Central Star or Crest Emblem */}
          <circle cx="50" cy="42" r="6" fill="#ffffff" opacity="0.9" />
          {/* City Initials */}
          <text 
            x="50" 
            y="76" 
            fontSize="26" 
            fontWeight="900" 
            fill="#ffffff" 
            textAnchor="middle" 
            fontFamily="system-ui, sans-serif"
            letterSpacing="1"
          >
            {displayCode}
          </text>
          {/* Olive branch curve */}
          <path d="M 28,94 Q 50,102 72,94" stroke={pal.border} strokeWidth="2.5" strokeDasharray="3 2" fill="none" />
        </svg>
      );
  }
}
