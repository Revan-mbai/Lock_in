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
    desc: 'Deep warm rumble',
    icon: Wind,
    accent: 'text-accent-box',
  },
  {
    id: 'rain',
    label: 'Rain',
    desc: 'Steady rainfall',
    icon: CloudRain,
    accent: 'text-sound-rain',
  },
  {
    id: 'waves',
    label: 'Waves',
    desc: 'Coastal surf',
    icon: Waves,
    accent: 'text-sound-waves',
  },
  {
    id: 'fireplace',
    label: 'Campfire',
    desc: 'Gentle crackle',
    icon: Flame,
    accent: 'text-sound-fire',
  },
  {
    id: 'cafe',
    label: 'Cafe',
    desc: 'Room murmur',
    icon: Coffee,
    accent: 'text-sound-cafe',
  },
  {
    id: 'pink',
    label: 'Pink Noise',
    desc: 'Balanced stream',
    icon: Sparkles,
    accent: 'text-sound-pink',
  },
  {
    id: 'binaural',
    label: 'Alpha Wave',
    desc: '10Hz binaural tone',
    icon: Headphones,
    accent: 'text-sound-alpha',
  },
  {
    id: 'white',
    label: 'White Noise',
    desc: 'Clean static',
    icon: Radio,
    accent: 'text-sound-white',
  },
];

export function AmbientSoundPlayer({ isPlaying, onTogglePlay }: AmbientSoundPlayerProps) {
  // Seeded from the audio singleton rather than from constants: entering Zen mode unmounts
  // this component while the sound keeps playing, so local defaults would come back showing
  // "Brown Noise" at 20% no matter what is actually audible.
  const [soundType, setSoundType] = useState<AmbientSoundType>(() => ambientPlayer.getType());
  const [volume, setVolume] = useState(() => ambientPlayer.getVolume());
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectType = (type: AmbientSoundType) => {
    setSoundType(type);
    if (isPlaying) {
      ambientPlayer.start(type, volume);
    } else {
      // Record the choice even while paused. This component unmounts whenever Zen mode is
      // entered and re-seeds itself from the singleton, so a selection made while paused was
      // otherwise silently reverted.
      ambientPlayer.setPendingType(type);
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
              ? 'bg-line text-ink-body shadow-xs'
              : 'text-ink-muted hover:text-ink-body hover:bg-surface-hover'
          }`}
        >
          {isPlaying ? (
            <Volume2 className="w-4 h-4 text-accent-focus animate-pulse" />
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
          className="p-2 rounded-xl text-ink-muted hover:text-ink-body hover:bg-surface-hover transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover */}
      {isOpen && (
        <div
          id="ambient-sound-popover"
          className="absolute right-0 top-full mt-2 w-72 p-4 rounded-2xl bg-surface border border-line shadow-xl z-50 space-y-3.5 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-track pb-2.5">
            <div>
              <span className="font-serif text-sm font-semibold text-ink block">
                Ambient Sound
              </span>
              <span className="text-[10px] text-ink-muted">
                Background noise generator
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-ink-faint hover:text-ink-body text-base leading-none p-1"
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
                      ? 'bg-surface-muted text-ink font-medium border border-line'
                      : 'text-ink-secondary hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? opt.accent : 'text-ink-muted'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{opt.label}</div>
                      <div className="text-[10px] text-ink-muted truncate">{opt.desc}</div>
                    </div>
                  </div>
                  {isSelected && isPlaying && (
                    <span className="w-1.5 h-1.5 rounded-full bg-ink shrink-0 ml-1.5 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Volume slider */}
          <div className="space-y-1.5 pt-2.5 border-t border-track">
            <div className="flex justify-between text-[11px] text-ink-muted">
              <span>Volume</span>
              <span className="font-mono text-[10px]">{Math.round(volume * 250)}%</span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.4"
              step="0.02"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg bg-surface-muted accent-ink cursor-pointer"
            />
          </div>

          <div className="pt-1">
            <button
              id="ambient-popover-toggle-btn"
              onClick={toggleSound}
              className={`w-full py-2 rounded-xl font-medium text-xs text-center transition-colors ${
                isPlaying
                  ? 'bg-surface-muted text-ink-body hover:bg-surface-active'
                  : 'bg-ink text-canvas hover:bg-ink-hover'
              }`}
            >
              {isPlaying ? 'Pause Sound' : 'Play Sound'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
