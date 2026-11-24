export interface RemoteVoiceChannel {
  peerId: string;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  panner: PannerNode;
  gain: GainNode;
  analyser: AnalyserNode;
  dataArray: Uint8Array<ArrayBuffer>;
  hiddenAudio: HTMLAudioElement;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;

  private buffers: Map<string, AudioBuffer> = new Map();
  private remoteVoices: Map<string, RemoteVoiceChannel> = new Map();

  private masterVolume = 0.75;
  private sfxVolume = 0.85;
  private voiceVolume = 0.9;
  private initialized = false;
  private lastSpeechTime = 0;

  public async prewarmBuffers(onProgress?: (pct: number) => void): Promise<void> {
    if (this.initialized) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 6;
    this.masterGain.connect(compressor);
    compressor.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.value = this.voiceVolume;
    this.voiceGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.2;
    this.ambientGain.connect(this.masterGain);

    const sr = this.ctx.sampleRate;

    // 1. Noise burst buffer for impacts, chopping, stone mining, footsteps
    onProgress?.(0.2);
    const noiseBuf = this.ctx.createBuffer(1, Math.floor(sr * 0.45), sr);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      const env = Math.exp((-i / sr) * 14);
      noiseData[i] = (Math.random() * 2 - 1) * env;
    }
    this.buffers.set('noise_hit', noiseBuf);

    // 2. Whoosh buffer for dash and bow release
    onProgress?.(0.45);
    const whooshBuf = this.ctx.createBuffer(1, Math.floor(sr * 0.35), sr);
    const whooshData = whooshBuf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < whooshData.length; i++) {
      const t = i / sr;
      const white = Math.random() * 2 - 1;
      lp = lp * 0.82 + white * 0.18;
      const env = Math.sin(Math.min(1, t / 0.35) * Math.PI);
      whooshData[i] = lp * env * 1.4;
    }
    this.buffers.set('whoosh', whooshBuf);

    // 3. Soft footstep thud buffer
    onProgress?.(0.65);
    const stepBuf = this.ctx.createBuffer(1, Math.floor(sr * 0.12), sr);
    const stepData = stepBuf.getChannelData(0);
    let sLp = 0;
    for (let i = 0; i < stepData.length; i++) {
      const t = i / sr;
      const white = Math.random() * 2 - 1;
      sLp = sLp * 0.88 + white * 0.12;
      stepData[i] = sLp * Math.exp(-t * 28) * 1.6;
    }
    this.buffers.set('footstep', stepBuf);

    // 4. Ambient orbital biosphere wind + harmonic sci-fi background music pad (loopable 6s)
    onProgress?.(0.85);
    const ambLen = sr * 6;
    const ambBuf = this.ctx.createBuffer(2, ambLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ambBuf.getChannelData(ch);
      let b0 = 0;
      for (let i = 0; i < ambLen; i++) {
        const t = i / sr;
        const white = Math.random() * 2 - 1;
        b0 = b0 * 0.988 + white * 0.012;
        const swell = 0.65 + 0.35 * Math.sin((t / 6) * Math.PI * 2);
        // Warm Am9 / Fmaj7 harmonic pad
        const pad =
          Math.sin(t * Math.PI * 2 * 110 + ch * 0.25) * 0.05 +
          Math.sin(t * Math.PI * 2 * 164.81) * 0.04 +
          Math.sin(t * Math.PI * 2 * 220 + ch * 0.4) * 0.03 +
          Math.sin(t * Math.PI * 2 * 261.63) * 0.025 * swell;
        d[i] = b0 * 0.32 + pad;
      }
    }
    this.buffers.set('ambient_dome', ambBuf);
    onProgress?.(1.0);
    this.initialized = true;
  }

  public unlock(): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public startAmbient(): void {
    if (!this.ctx || !this.ambientGain || this.ambientSource) return;
    this.unlock();
    const buf = this.buffers.get('ambient_dome');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.ambientGain);
    src.start();
    this.ambientSource = src;
  }

  public stopAmbient(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        // ignore if already stopped
      }
      this.ambientSource.disconnect();
      this.ambientSource = null;
    }
  }

  public setVolumes(master: number, sfx: number, voice: number): void {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.voiceVolume = voice;
    if (this.masterGain) this.masterGain.gain.value = master;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.voiceGain) this.voiceGain.gain.value = voice;
  }

  public getVolumes(): { master: number; sfx: number; voice: number } {
    return {
      master: this.masterVolume,
      sfx: this.sfxVolume,
      voice: this.voiceVolume,
    };
  }

  public playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.25,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    this.unlock();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playBuffer(key: string, playbackRate = 1.0, volume = 0.35): void {
    if (!this.ctx || !this.sfxGain) return;
    this.unlock();
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start();
  }

  public playFootstep(onMetal: boolean, sprinting: boolean): void {
    const rate = (onMetal ? 1.5 : 0.9) + Math.random() * 0.18;
    const vol = sprinting ? 0.24 : 0.15;
    this.playBuffer('footstep', rate, vol);
    if (onMetal) {
      this.playTone(280, 140, 0.05, 'triangle', 0.06);
    }
  }

  public playDinoAttack(kind: 'raptor' | 'theropod' | 'skywing' | 'drone'): void {
    if (kind === 'theropod') {
      this.playTone(150, 58, 0.36, 'sawtooth', 0.28);
      this.playBuffer('noise_hit', 0.65, 0.25);
    } else if (kind === 'skywing') {
      this.playTone(760, 320, 0.26, 'triangle', 0.22);
    } else if (kind === 'drone') {
      this.playTone(620, 410, 0.18, 'square', 0.16);
    } else {
      this.playTone(420, 180, 0.22, 'sawtooth', 0.22);
    }
  }

  public playBossRoar(): void {
    this.playTone(95, 290, 0.65, 'sawtooth', 0.35);
    window.setTimeout(() => this.playTone(290, 68, 0.9, 'sawtooth', 0.38), 420);
    this.playBuffer('whoosh', 0.6, 0.45);
  }

  public playForge(): void {
    this.playTone(880, 1180, 0.18, 'triangle', 0.24);
    window.setTimeout(() => this.playTone(1320, 660, 0.24, 'sine', 0.2), 90);
    this.playBuffer('whoosh', 1.5, 0.2);
  }

  public playChop(): void {
    this.playBuffer('noise_hit', 0.85 + Math.random() * 0.2, 0.32);
    this.playTone(165, 72, 0.14, 'triangle', 0.22);
  }

  public playMine(): void {
    this.playBuffer('noise_hit', 1.25 + Math.random() * 0.25, 0.28);
    this.playTone(720, 310, 0.11, 'square', 0.14);
  }

  public playSwing(): void {
    this.playBuffer('whoosh', 1.1 + Math.random() * 0.15, 0.28);
  }

  public playDash(): void {
    this.playBuffer('whoosh', 1.45, 0.4);
    this.playTone(320, 140, 0.22, 'sawtooth', 0.12);
  }

  public playBowRelease(): void {
    this.playBuffer('whoosh', 1.8, 0.26);
    this.playTone(460, 190, 0.15, 'triangle', 0.18);
  }

  public playHitEnemy(): void {
    this.playTone(210, 85, 0.12, 'sawtooth', 0.2);
    this.playBuffer('noise_hit', 1.4, 0.24);
  }

  public playPlayerHurt(): void {
    this.playTone(130, 52, 0.25, 'sawtooth', 0.32);
    this.playBuffer('noise_hit', 0.65, 0.3);
  }

  public playCraft(): void {
    this.playTone(440, 660, 0.12, 'triangle', 0.18);
    window.setTimeout(() => this.playTone(660, 880, 0.16, 'sine', 0.2), 70);
  }

  public playBeaconRepaired(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, idx) => {
      window.setTimeout(() => this.playTone(n, n * 1.01, 0.32, 'triangle', 0.22), idx * 90);
    });
  }

  public playBossTelegraph(): void {
    this.playTone(190, 380, 0.45, 'sawtooth', 0.2);
  }

  public playBossImpact(): void {
    this.playBuffer('noise_hit', 0.55, 0.45);
    this.playTone(95, 32, 0.42, 'sawtooth', 0.32);
  }

  public playHeal(): void {
    this.playTone(520, 780, 0.25, 'sine', 0.2);
  }

  public speakAtlas(text: string): void {
    const now = performance.now();
    if (now - this.lastSpeechTime < 1200) return;
    this.lastSpeechTime = now;

    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.pitch = 0.65;
      utter.rate = 0.94;
      utter.volume = Math.min(1, this.masterVolume * 0.95);
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          /google|daniel|alex|david|mark|microsoft/i.test(v.name),
      );
      if (preferred) utter.voice = preferred;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore synthesis errors
    }
  }

  public stopSpeech(): void {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public attachRemoteVoiceStream(peerId: string, stream: MediaStream): void {
    if (!this.ctx || !this.voiceGain) return;
    this.detachRemoteVoiceStream(peerId);

    const hiddenAudio = document.createElement('audio');
    hiddenAudio.srcObject = stream;
    hiddenAudio.muted = true;
    hiddenAudio.autoplay = true;
    void hiddenAudio.play().catch(() => {});

    const source = this.ctx.createMediaStreamSource(stream);
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'linear';
    panner.refDistance = 5;
    panner.maxDistance = 35;
    panner.rolloffFactor = 1;

    const gain = this.ctx.createGain();
    gain.gain.value = 1.0;

    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    source.connect(analyser);
    analyser.connect(panner);
    panner.connect(gain);
    gain.connect(this.voiceGain);

    this.remoteVoices.set(peerId, {
      peerId,
      stream,
      source,
      panner,
      gain,
      analyser,
      dataArray,
      hiddenAudio,
    });
  }

  public detachRemoteVoiceStream(peerId: string): void {
    const ch = this.remoteVoices.get(peerId);
    if (!ch) return;
    try {
      ch.source.disconnect();
      ch.analyser.disconnect();
      ch.panner.disconnect();
      ch.gain.disconnect();
      ch.hiddenAudio.srcObject = null;
    } catch {
      // ignore
    }
    this.remoteVoices.delete(peerId);
  }

  public updateSpatialListener(
    x: number,
    y: number,
    z: number,
    yaw: number,
    remotePositions: Map<string, { x: number; y: number; z: number }>,
  ): void {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);

    if (listener.positionX) {
      listener.positionX.value = x;
      listener.positionY.value = y + 1.5;
      listener.positionZ.value = z;
      listener.forwardX.value = fx;
      listener.forwardY.value = 0;
      listener.forwardZ.value = fz;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    }

    for (const [peerId, ch] of this.remoteVoices.entries()) {
      const pos = remotePositions.get(peerId);
      if (!pos) {
        ch.gain.gain.value = 0;
        continue;
      }
      if (ch.panner.positionX) {
        ch.panner.positionX.value = pos.x;
        ch.panner.positionY.value = pos.y + 1.5;
        ch.panner.positionZ.value = pos.z;
      }
      const dx = pos.x - x;
      const dy = pos.y - y;
      const dz = pos.z - z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const proxGain = dist <= 35 ? Math.max(0, 1 - Math.max(0, dist - 5) / 30) : 0;
      ch.gain.gain.value = proxGain;
    }
  }

  public isRemoteSpeaking(peerId: string): boolean {
    const ch = this.remoteVoices.get(peerId);
    if (!ch) return false;
    ch.analyser.getByteFrequencyData(ch.dataArray);
    let sum = 0;
    for (let i = 0; i < ch.dataArray.length; i++) {
      sum += ch.dataArray[i];
    }
    const avg = sum / ch.dataArray.length;
    return avg > 14;
  }

  public dispose(): void {
    this.stopAmbient();
    this.stopSpeech();
    for (const id of Array.from(this.remoteVoices.keys())) {
      this.detachRemoteVoiceStream(id);
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
