/** 格式化秒数为 MM:SS */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 格式化秒数为可读时长 */
function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} 分钟`;
}

/**
 * 声音播放器 —— 解决移动端 AudioContext 限制
 * 在用户首次点击时解锁，之后可随时播放
 */
const sound = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  /** 必须在用户交互（click/touchstart）中调用，解锁移动端音频 */
  function unlock() {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  }

  function _tone(freq, duration, startTime, gainVal) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  const SOUNDS = {
    /** 清脆短响 */
    ding(c) {
      _tone(880, 0.3, c.currentTime, 0.3);
    },
    /** 柔和双音 */
    gentle(c) {
      _tone(523, 0.25, c.currentTime, 0.2);
      _tone(659, 0.3, c.currentTime + 0.2, 0.2);
    },
    /** 三连响 */
    triple(c) {
      for (let i = 0; i < 3; i++) {
        _tone(784, 0.15, c.currentTime + i * 0.22, 0.25);
      }
    },
    /** 上升和弦 */
    chime(c) {
      [523, 659, 784, 1047].forEach((f, i) => {
        _tone(f, 0.3, c.currentTime + i * 0.15, 0.18);
      });
    },
    /** 闹铃（急促） */
    alarm(c) {
      for (let i = 0; i < 6; i++) {
        _tone(i % 2 ? 980 : 780, 0.1, c.currentTime + i * 0.14, 0.3);
      }
    },
    /** 木琴 */
    xylophone(c) {
      [1047, 1319, 1568].forEach((f, i) => {
        _tone(f, 0.4, c.currentTime + i * 0.18, 0.15);
      });
    },
  };

  /** 播放指定铃声 */
  function play(name) {
    if (!name || name === 'off') return;
    try {
      const c = getCtx();
      if (c.state === 'suspended') c.resume();
      const fn = SOUNDS[name] || SOUNDS.ding;
      fn(c);
    } catch (_) {}
  }

  /** 返回可用铃声列表 [{id, label}] */
  function list() {
    return [
      { id: 'ding', label: '清脆短响' },
      { id: 'gentle', label: '柔和双音' },
      { id: 'triple', label: '三连响' },
      { id: 'chime', label: '上升和弦' },
      { id: 'alarm', label: '急促闹铃' },
      { id: 'xylophone', label: '木琴' },
      { id: 'off', label: '静音' },
    ];
  }

  return { unlock, play, list };
})();

/** localStorage 数据层 */
const db = {
  _get(key, def) { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  getTasks() { return this._get('tomato_tasks', []); },

  addTask(name, estimated) {
    const tasks = this.getTasks();
    const id = this._get('tomato_next_id', 1);
    this._set('tomato_next_id', id + 1);
    const task = { id, name, estimated: estimated || 1, completed: 0 };
    tasks.unshift(task);
    this._set('tomato_tasks', tasks);
    return task;
  },

  deleteTask(id) {
    this._set('tomato_tasks', this.getTasks().filter(t => t.id !== id));
  },

  incrementPomodoro(id) {
    const tasks = this.getTasks();
    const t = tasks.find(t => t.id === id);
    if (t) t.completed++;
    this._set('tomato_tasks', tasks);
  },

  addRecord(taskId, duration) {
    const records = this._get('tomato_records', []);
    records.push({ task_id: taskId, duration, completed_at: new Date().toISOString() });
    this._set('tomato_records', records);
  },

  getStats() {
    const records = this._get('tomato_records', []);
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = records.filter(r => r.completed_at.slice(0, 10) === today);
    return {
      todayFocusTime: todayRecords.reduce((s, r) => s + r.duration, 0),
      todayCount: todayRecords.length,
      totalCount: records.length,
    };
  },

  getSettings() {
    return this._get('tomato_settings', {
      focus_duration: 25, short_break: 5, long_break: 15,
      cycle_length: 4, sound: 'ding',
    });
  },

  saveSettings(s) {
    this._set('tomato_settings', s);
    return s;
  },
};
