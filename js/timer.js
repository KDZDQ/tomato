/**
 * 高精度计时器 —— 基于时间戳校准，避免 setInterval 漂移
 */
class PrecisionTimer {
  constructor(onTick, onComplete) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.duration = 0;
    this.remaining = 0;
    this._running = false;
    this._countUp = false;
    this._startTs = null;
    this._accumulated = 0;
    this._rafId = null;
    this._intervalId = null;
  }

  /** 倒计时模式 */
  start(durationSec) {
    this.stop();
    this._countUp = false;
    this.duration = durationSec;
    this.remaining = durationSec;
    this._accumulated = 0;
    this._startTs = performance.now();
    this._running = true;
    this._schedule();
    this.onTick(this.remaining);
  }

  /** 正向计时模式 */
  startUp() {
    this.stop();
    this._countUp = true;
    this.duration = 0;
    this.remaining = 0;
    this._accumulated = 0;
    this._startTs = performance.now();
    this._running = true;
    this._schedule();
    this.onTick(0);
  }

  pause() {
    if (!this._running || this._startTs == null) return;
    this._accumulated += (performance.now() - this._startTs) / 1000;
    this._startTs = null;
    this._cancel();
  }

  resume() {
    if (this._startTs != null) return;
    this._startTs = performance.now();
    this._running = true;
    this._schedule();
  }

  stop() {
    this._running = false;
    this._cancel();
    this._startTs = null;
    this._accumulated = 0;
  }

  _elapsed() {
    return this._accumulated +
      (this._startTs != null ? (performance.now() - this._startTs) / 1000 : 0);
  }

  _schedule() {
    this._cancel();
    const update = () => {
      if (!this._running) return;
      if (this._countUp) {
        this.remaining = this._elapsed();
        this.onTick(this.remaining);
      } else {
        this.remaining = Math.max(0, this.duration - this._elapsed());
        this.onTick(this.remaining);
        if (this.remaining <= 0) {
          this.stop();
          this.onComplete();
        }
      }
    };
    const rafLoop = () => {
      if (!this._running) return;
      update();
      if (this._running) this._rafId = requestAnimationFrame(rafLoop);
    };
    this._rafId = requestAnimationFrame(rafLoop);
    this._intervalId = setInterval(update, 500);
  }

  _cancel() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
  }
}
