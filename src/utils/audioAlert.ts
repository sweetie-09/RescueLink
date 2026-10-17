/**
 * Web Audio API Emergency Siren & Buzzer Synthesizer
 * Generates authentic dual-tone emergency alarms and buzzers without external audio files.
 */

class EmergencyAudioAlert {
  private audioCtx: AudioContext | null = null;
  private isAlerting = false;
  private timerId: any = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  private initContext() {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  // Continuous siren alarm + buzzing for Control Room SOS
  public startSiren() {
    if (this.isAlerting) return;
    this.initContext();
    if (!this.audioCtx) return;

    this.isAlerting = true;

    try {
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      this.gainNode.connect(this.audioCtx.destination);

      this.osc1 = this.audioCtx.createOscillator();
      this.osc1.type = "sawtooth";
      this.osc1.frequency.setValueAtTime(800, this.audioCtx.currentTime);

      this.osc2 = this.audioCtx.createOscillator();
      this.osc2.type = "square";
      this.osc2.frequency.setValueAtTime(450, this.audioCtx.currentTime);

      this.osc1.connect(this.gainNode);
      this.osc2.connect(this.gainNode);

      this.osc1.start();
      this.osc2.start();

      // Pitch modulation loop for emergency wailing effect
      let high = false;
      this.timerId = setInterval(() => {
        if (!this.audioCtx || !this.osc1 || !this.osc2) return;
        const now = this.audioCtx.currentTime;
        if (high) {
          this.osc1.frequency.exponentialRampToValueAtTime(960, now + 0.15);
          this.osc2.frequency.exponentialRampToValueAtTime(540, now + 0.15);
        } else {
          this.osc1.frequency.exponentialRampToValueAtTime(620, now + 0.15);
          this.osc2.frequency.exponentialRampToValueAtTime(380, now + 0.15);
        }
        high = !high;
      }, 350);
    } catch (e) {
      console.warn("Audio Context error starting siren:", e);
    }
  }

  public stopSiren() {
    this.isAlerting = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    try {
      if (this.osc1) {
        this.osc1.stop();
        this.osc1.disconnect();
        this.osc1 = null;
      }
      if (this.osc2) {
        this.osc2.stop();
        this.osc2.disconnect();
        this.osc2 = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
    } catch (e) {
      // Ignored
    }
  }

  public isPlaying(): boolean {
    return this.isAlerting;
  }

  // Short notification beep for status updates
  public playChime(type: "success" | "warning" | "alert" = "success") {
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (type === "alert") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "warning") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Two-tone cheerful chime
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Audio playback failed
    }
  }
}

export const soundManager = new EmergencyAudioAlert();
