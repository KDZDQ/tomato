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
 * 声音播放器
 */
const sound = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

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
    ding(c) { _tone(880, 0.3, c.currentTime, 0.3); },
    gentle(c) { _tone(523, 0.25, c.currentTime, 0.2); _tone(659, 0.3, c.currentTime + 0.2, 0.2); },
    triple(c) { for (let i = 0; i < 3; i++) _tone(784, 0.15, c.currentTime + i * 0.22, 0.25); },
    chime(c) { [523, 659, 784, 1047].forEach((f, i) => _tone(f, 0.3, c.currentTime + i * 0.15, 0.18)); },
    alarm(c) { for (let i = 0; i < 6; i++) _tone(i % 2 ? 980 : 780, 0.1, c.currentTime + i * 0.14, 0.3); },
    xylophone(c) { [1047, 1319, 1568].forEach((f, i) => _tone(f, 0.4, c.currentTime + i * 0.18, 0.15)); },
  };

  function play(name) {
    if (!name || name === 'off') return;
    try { const c = getCtx(); if (c.state === 'suspended') c.resume(); (SOUNDS[name] || SOUNDS.ding)(c); } catch (_) {}
  }

  function list() {
    return [
      { id: 'ding', label: '清脆短响' }, { id: 'gentle', label: '柔和双音' },
      { id: 'triple', label: '三连响' }, { id: 'chime', label: '上升和弦' },
      { id: 'alarm', label: '急促闹铃' }, { id: 'xylophone', label: '木琴' },
      { id: 'off', label: '静音' },
    ];
  }

  return { unlock, play, list };
})();

/** Supabase 数据层 —— 所有方法均为 async */
const db = {
  async getTasks() {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async addTask(name, estimated) {
    const { data } = await supabase.from('tasks').insert({ name, estimated: estimated || 1 }).select().single();
    return data;
  },

  async deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id);
  },

  async incrementPomodoro(id) {
    const { data: task } = await supabase.from('tasks').select('completed').eq('id', id).single();
    if (task) await supabase.from('tasks').update({ completed: task.completed + 1 }).eq('id', id);
  },

  async addRecord(taskId, duration) {
    await supabase.from('records').insert({ task_id: taskId, duration });
  },

  async getStats() {
    const { data: records } = await supabase.from('records').select('duration, completed_at');
    const all = records || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = all.filter(r => r.completed_at && r.completed_at.slice(0, 10) === today);
    return {
      todayFocusTime: todayRecords.reduce((s, r) => s + r.duration, 0),
      todayCount: todayRecords.length,
      totalCount: all.length,
    };
  },

  async getSettings() {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) return data;
    const defaults = { focus_duration: 25, short_break: 5, long_break: 15, cycle_length: 4, sound: 'ding' };
    await supabase.from('settings').insert(defaults);
    return defaults;
  },

  async saveSettings(s) {
    const { data } = await supabase.from('settings').upsert({
      user_id: (await supabase.auth.getUser()).data.user.id,
      ...s,
    }).select().single();
    return data || s;
  },
};
