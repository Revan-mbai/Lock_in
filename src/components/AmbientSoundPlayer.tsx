import { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Sliders,
  Wind,
  CloudRain,
  Waves,
  Flame,
  Coffee,
  Headphones,
  Sparkles,
  Radio,
} from 'lucide-react';
import { AmbientSoundType } from '../types';
import { ambientPlayer } from '../utils/audio';

interface AmbientSoundPlayerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
}

interface SoundOption {
  id: AmbientSoundType;
  label: string;
  desc: string;
  icon: typeof Wind;
  accent: string;
}

const SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'brown',
    label: 'Brown Noise',
    desc: 'Deep warm rumble for cognitive masking',
    icon: Wind,
    accent: 'text-[#B45309]',
  },
  {
    id: 'rain',
    label: 'Gentle Rain',
    desc: 'Soft steady window rainfall',
    icon: CloudRain,
    accent: 'text-[#3B82F6]',
  },
  {
    id: 'waves',
    label: 'Ocean Waves',
    desc: 'Rhythmic coastal surf swell',
    icon: Waves,
    accent: 'text-[#0D9488]',
  },
  {
    id: 'fireplace',
    label: 'Campfire Hearth',
    desc: 'Warm embers & cozy subtle crackle',
    icon: Flame,
    accent: 'text-[#EA580C]',
  },
  {
    id: 'cafe',
    label: 'Coffeehouse',
    desc: 'Muffled ambient room murmur',
    icon: Coffee,
    accent: 'text-[#92400E]',
  },
  {
    id: 'pink',
    label: 'Pink Noise',
    desc: 'Balanced 1/f steady stream',
    icon: Sparkles,
    accent: 'text-[#D97706]',
  },
  {
    id: 'binaural',
    label: 'Alpha Wave Drone',
    desc: '10Hz relaxed alertness binaural tone',
    icon: Headphones,
    accent: 'text-[#10B981]',
  },
  {
    id: 'white',
    label: 'Crisp White Noise',
    desc: 'Broad-spectrum background mask',
    icon: Radio,
    accent: 'text-[#6B7280]',
  },
];

export function AmbientSoundPlayer({ isPlaying, onTogglePlay }: AmbientSoundPlayerProps) {
  const [soundType, setSoundType] = useState<AmbientSoundType>('brown');
  const [volume, setVolume] = useState(0.2);
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectType = (type: AmbientSoundType) => {
    setSoundType(type);
    if (isPlaying) {
      ambientPlayer.start(type, volume);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    ambientPlayer.setVolume(newVol);
  };

  const toggleSound = () => {
    if (isPlaying) {
      ambientPlayer.stop();
      onTogglePlay();
    } else {
      ambientPlayer.start(soundType, volume);
      onTogglePlay();
    }
  };

  const currentOption = SOUND_OPTIONS.find((s) => s.id === soundType) || SOUND_OPTIONS[0];

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          id="ambient-sound-toggle-btn"
          onClick={toggleSound}
          title={isPlaying ? `Playing ${currentOption.label} - Click to pause` : 'Play ambient focus noise'}
          className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            isPlaying
              ? 'bg-[#EAE5DC] text-[#292524] shadow-xs'
              : 'text-[#78716C] hover:text-[#292524] hover:bg-[#F2EFE9]'
          }`}
        >
          {isPlaying ? (
            <Volume2 className="w-4 h-4 text-[#C86D51] animate-pulse" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
          <span className="hidden sm:inline text-xs font-medium">
            {isPlaying ? currentOption.label : 'Ambient'}
          </span>
        </button>

        <button
          id="ambient-sound-options-btn"
          onClick={() => setIsOpen(!isOpen)}
          title="Ambient soundscapes & volume"
          className="p-2 rounded-xl text-[#78716C] hover:text-[#292524] hover:bg-[#F2EFE9] transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover */}
      {isOpen && (
        <div
          id="ambient-sound-popover"
          className="absolute right-0 top-full mt-2 w-72 p-4 rounded-2xl bg-[#FFFFFF] border border-[#E7E3DC] shadow-xl z-50 space-y-3.5 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-[#F0ECE4] pb-2.5">
            <div>
              <span className="font-serif text-sm font-semibold text-[#1C1917] block">
                Focus Soundscapes
              </span>
              <span className="text-[10px] text-[#8C827A]">
                8 procedurally synthesized audio masks
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#A8A29E] hover:text-[#292524] text-base leading-none p-1"
            >
              &times;
            </button>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {SOUND_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = soundType === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectType(opt.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#FAF5EE] text-[#1C1917] font-medium border border-[#E7DFD4]'
                      : 'text-[#57534E] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? opt.accent : 'text-[#8C827A]'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{opt.label}</div>
                      <div className="text-[10px] text-[#8C827A] truncate">{opt.desc}</div>
                    </div>
                  </div>
                  {isSelected && isPlaying && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1C1917] shrink-0 ml-1.5 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Volume slider */}
          <div className="space-y-1.5 pt-2.5 border-t border-[#F0ECE4]">
            <div className="flex justify-between text-[11px] text-[#78716C]">
              <span>Master Volume</span>
              <span className="font-mono text-[10px]">{Math.round(volume * 250)}%</span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.4"
              step="0.02"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg bg-[#EFECE6] accent-[#1C1917] cursor-pointer"
            />
          </div>

          <div className="pt-1">
            <button
              id="ambient-popover-toggle-btn"
              onClick={toggleSound}
              className={`w-full py-2 rounded-xl font-medium text-xs text-center transition-colors ${
                isPlaying
                  ? 'bg-[#EFECE6] text-[#292524] hover:bg-[#E5E0D8]'
                  : 'bg-[#1C1917] text-[#FAF8F5] hover:bg-[#2E2A27]'
              }`}
            >
              {isPlaying ? `Pause ${currentOption.label}` : `Play ${currentOption.label}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
