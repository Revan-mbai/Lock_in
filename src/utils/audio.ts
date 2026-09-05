/**
 * Synthesized Web Audio API sounds for calm focus transitions
 * Zero external audio file dependencies to ensure 100% reliability
 */

import { AmbientSoundType } from '../types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {
      // Resuming is only permitted after a user gesture; the unlock listener below retries.
    });
  }
  return audioCtx;
}

// Browsers refuse to start an AudioContext without a user gesture. A completion chime fires
// from a timer, which has no gesture of its own, so unless the context was already unlocked
// the chime is silently dropped. Create and resume it on the first interaction instead.
if (typeof window !== 'undefined') {
  const unlockEvents = ['pointerdown', 'keydown', 'touchstart'] as const;

  const unlock = () => {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return; // Not unlocked yet — keep listening.
    unlockEvents.forEach((event) => window.removeEventListener(event, unlock));
  };

  unlockEvents.forEach((event) => window.addEventListener(event, unlock, { passive: true }));
}

/**
 * Play a soothing, warm meditation bell chime when a focus session completes
 */
export function playFocusCompleteChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Harmonic frequencies for a warm singing bowl tone (F4 root ~349Hz with gentle harmonics)
    const freqs = [349.23, 523.25, 698.46, 880.0];
    const gains = [0.25, 0.15, 0.08, 0.04];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gains[idx], now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 3.5);
    });
  } catch (err) {
    console.warn('Audio playback not permitted or unavailable:', err);
  }
}

/**
 * Play an uplifting gentle two-tone chime when break ends and it's time to refocus
 */
export function playBreakCompleteChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Gentle upward two-tone (D5 to G5)
    const tones = [
      { freq: 587.33, time: now, duration: 0.9 },
      { freq: 783.99, time: now + 0.35, duration: 1.8 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, tone.time);

      gain.gain.setValueAtTime(0.0001, tone.time);
      gain.gain.exponentialRampToValueAtTime(0.18, tone.time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, tone.time + tone.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(tone.time);
      osc.stop(tone.time + tone.duration + 0.1);
    });
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

/**
 * Procedural Web Audio Ambient Noise Engine
 * Supports: Brown Noise, Pink Noise, White Noise, Soft Rain, Ocean Waves, Alpha Drone, Campfire, and Coffeehouse
 */
// Long enough to smooth the cut, short enough that pausing still feels instant.
const FADE_OUT_SECONDS = 0.08;

export class AmbientNoiseGenerator {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private activeIntervals: number[] = [];
  private isRunning = false;
  private currentType: AmbientSoundType = 'brown';
  // Kept on the singleton so the UI can recover the selection after it unmounts — entering
  // Zen mode unmounts the player while the audio graph keeps running.
  private currentVolume = 0.2;

  public start(type: AmbientSoundType, volume: number): void {
    this.stop();
    this.currentType = type;
    this.currentVolume = volume;

    try {
      this.ctx = getAudioContext();
      if (!this.ctx) return;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(volume, 0.4)), this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);

      // Must be set before building the graph: the fireplace/cafe schedulers below
      // bail out early unless the generator is already marked as running.
      this.isRunning = true;

      if (type === 'brown') {
        // Brown noise (deep, comforting rumble for focus)
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 3.5;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;

        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 450;

        noiseSource.connect(lowpass);
        lowpass.connect(this.gainNode);
        noiseSource.start();

        this.activeNodes.push(noiseSource, lowpass);
      } else if (type === 'pink') {
        // Pink noise (1/f natural noise - balanced, waterfall texture)
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.1;
          b6 = white * 0.115926;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 3200;

        source.connect(filter);
        filter.connect(this.gainNode);
        source.start();

        this.activeNodes.push(source, filter);
      } else if (type === 'white') {
        // Pure White Noise with high frequency smoothing
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.08;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 6000;

        source.connect(filter);
        filter.connect(this.gainNode);
        source.start();

        this.activeNodes.push(source, filter);
      } else if (type === 'rain') {
        // Soft rain: Pink noise through dual bandpass & high-frequency drizzle
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
          b6 = white * 0.115926;
        }

        const rainSource = this.ctx.createBufferSource();
        rainSource.buffer = buffer;
        rainSource.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 950;
        filter.Q.value = 0.7;

        rainSource.connect(filter);
        filter.connect(this.gainNode);
        rainSource.start();

        this.activeNodes.push(rainSource, filter);
      } else if (type === 'waves') {
        // Ocean Waves: modulated pink/brown noise with periodic surf surge
        const bufferSize = this.ctx.sampleRate * 3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.03 * white) / 1.03;
          data[i] = lastOut * 2.8;
        }

        const waveSource = this.ctx.createBufferSource();
        waveSource.buffer = buffer;
        waveSource.loop = true;

        const waveFilter = this.ctx.createBiquadFilter();
        waveFilter.type = 'lowpass';
        waveFilter.frequency.value = 500;

        // LFO for surf cycle (~9s swell)
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.11; // ~9s period
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 350; // Sweeps filter between 150Hz and 850Hz

        lfo.connect(lfoGain);
        lfoGain.connect(waveFilter.frequency);

        const waveAmp = this.ctx.createGain();
        waveAmp.gain.value = 0.7;

        const ampLfo = this.ctx.createOscillator();
        ampLfo.frequency.value = 0.11;
        const ampLfoGain = this.ctx.createGain();
        ampLfoGain.gain.value = 0.3;

        ampLfo.connect(ampLfoGain);
        ampLfoGain.connect(waveAmp.gain);

        waveSource.connect(waveFilter);
        waveFilter.connect(waveAmp);
        waveAmp.connect(this.gainNode);

        lfo.start();
        ampLfo.start();
        waveSource.start();

        this.activeNodes.push(waveSource, waveFilter, lfo, lfoGain, waveAmp, ampLfo, ampLfoGain);
      } else if (type === 'fireplace') {
        // Campfire Hearth: Warm low rumble with gentle intermittent crackles
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.015 * white) / 1.015;
          data[i] = lastOut * 2.2;
        }

        const fireSource = this.ctx.createBufferSource();
        fireSource.buffer = buffer;
        fireSource.loop = true;

        const fireFilter = this.ctx.createBiquadFilter();
        fireFilter.type = 'lowpass';
        fireFilter.frequency.value = 380;

        fireSource.connect(fireFilter);
        fireFilter.connect(this.gainNode);
        fireSource.start();

        this.activeNodes.push(fireSource, fireFilter);

        // Intermittent procedural crackle pops
        const scheduleCrackle = () => {
          if (!this.isRunning || !this.ctx || !this.gainNode) return;
          try {
            const crackleGain = this.ctx.createGain();
            crackleGain.gain.value = 0.04 + Math.random() * 0.06;

            const osc = this.ctx.createOscillator();
            osc.type = Math.random() > 0.5 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(800 + Math.random() * 1600, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.04);

            osc.connect(crackleGain);
            crackleGain.connect(this.gainNode);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.04);
          } catch {
            // Ignore
          }

          const nextDelay = 120 + Math.random() * 450;
          const timerId = window.setTimeout(scheduleCrackle, nextDelay);
          this.activeIntervals.push(timerId);
        };

        scheduleCrackle();
      } else if (type === 'cafe') {
        // Coffeehouse Ambience: warm room diffuse murmur with soft ambient filtering
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99 * b0 + white * 0.05;
          b1 = 0.95 * b1 + white * 0.08;
          b2 = 0.90 * b2 + white * 0.12;
          data[i] = (b0 + b1 + b2) * 0.12;
        }

        const cafeSource = this.ctx.createBufferSource();
        cafeSource.buffer = buffer;
        cafeSource.loop = true;

        const cafeFilter = this.ctx.createBiquadFilter();
        cafeFilter.type = 'bandpass';
        cafeFilter.frequency.value = 450;
        cafeFilter.Q.value = 0.5;

        cafeSource.connect(cafeFilter);
        cafeFilter.connect(this.gainNode);
        cafeSource.start();

        this.activeNodes.push(cafeSource, cafeFilter);

        // Subtle muffled room activity transients
        const scheduleMurmur = () => {
          if (!this.isRunning || !this.ctx || !this.gainNode) return;
          try {
            const clinkGain = this.ctx.createGain();
            clinkGain.gain.value = 0.015 + Math.random() * 0.02;

            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2200 + Math.random() * 1200, this.ctx.currentTime);

            clinkGain.gain.setValueAtTime(clinkGain.gain.value, this.ctx.currentTime);
            clinkGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);

            osc.connect(clinkGain);
            clinkGain.connect(this.gainNode);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.12);
          } catch {
            // Ignore
          }

          const nextDelay = 800 + Math.random() * 2400;
          const timerId = window.setTimeout(scheduleMurmur, nextDelay);
          this.activeIntervals.push(timerId);
        };

        scheduleMurmur();
      } else {
        // binaural: Alpha Focus Drone (108Hz + 118Hz -> 10Hz Alpha Waves + 54Hz root)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();

        osc1.type = 'sine';
        osc2.type = 'sine';
        subOsc.type = 'sine';

        osc1.frequency.value = 108; // Base carrier
        osc2.frequency.value = 118; // 10Hz Alpha frequency diff
        subOsc.frequency.value = 54; // Warm sub harmonic

        const subGain = this.ctx.createGain();
        subGain.gain.value = 0.3;
        subOsc.connect(subGain);

        const merger = this.ctx.createChannelMerger(2);
        osc1.connect(merger, 0, 0);
        osc2.connect(merger, 0, 1);

        merger.connect(this.gainNode);
        subGain.connect(this.gainNode);

        osc1.start();
        osc2.start();
        subOsc.start();

        this.activeNodes.push(osc1, osc2, subOsc, subGain, merger);
      }
    } catch (e) {
      this.isRunning = false;
      console.warn('Ambient noise error:', e);
    }
  }

  public setVolume(volume: number): void {
    this.currentVolume = volume;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(volume, 0.4)), this.ctx.currentTime);
    }
  }

  public stop(): void {
    // Marked first so any crackle/murmur callback already queued bails out instead of
    // attaching a new node to the graph being torn down.
    this.isRunning = false;

    // Clear crackle / murmur timeouts
    while (this.activeIntervals.length > 0) {
      const id = this.activeIntervals.pop();
      if (id) clearTimeout(id);
    }

    const nodes = this.activeNodes;
    const gainNode = this.gainNode;
    this.activeNodes = [];
    this.gainNode = null;

    const teardown = () => {
      for (const node of nodes) {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // Ignore already stopped
        }
      }
      if (gainNode) {
        try {
          gainNode.disconnect();
        } catch {
          // Ignore
        }
      }
    };

    // Cutting a looping waveform dead mid-cycle is an audible click, and pausing or
    // switching sounds did exactly that. Fade out first, then tear the graph down.
    if (this.ctx && gainNode) {
      try {
        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT_SECONDS);
        window.setTimeout(teardown, FADE_OUT_SECONDS * 1000 + 20);
        return;
      } catch {
        // Fall through to an immediate teardown.
      }
    }

    teardown();
  }

  public active(): boolean {
    return this.isRunning;
  }

  /** Remember a soundscape picked while nothing is playing, so the UI can restore it. */
  public setPendingType(type: AmbientSoundType): void {
    this.currentType = type;
  }

  public getType(): AmbientSoundType {
    return this.currentType;
  }

  public getVolume(): number {
    return this.currentVolume;
  }
}

export const ambientPlayer = new AmbientNoiseGenerator();
