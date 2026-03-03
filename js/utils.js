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

/** Web Audio 提示音 */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}

/** localStorage 数据层 —— 替代后端 API */
const db = {
  _get(key, def) { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  // --- Tasks ---
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

  // --- Records ---
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

  // --- Settings ---
  getSettings() {
    return this._get('tomato_settings', {
      focus_duration: 25, short_break: 5, long_break: 15,
      cycle_length: 4, sound_enabled: 1,
    });
  },

  saveSettings(s) {
    this._set('tomato_settings', s);
    return s;
  },
};
