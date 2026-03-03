/**
 * 状态管理 —— 简易响应式 store + localStorage 持久化
 */
const DEBUG = new URLSearchParams(window.location.search).has('debug');

let DURATIONS = DEBUG
  ? { focus: 5, short_break: 3, long_break: 4 }
  : { focus: 25 * 60, short_break: 5 * 60, long_break: 15 * 60 };
let CYCLE_LENGTH = 4;
let SOUND_ENABLED = true;

/** 用设置对象更新计时配置（分钟 -> 秒） */
function applySettings(s) {
  if (!s) return;
  if (!DEBUG) {
    DURATIONS = {
      focus: (s.focus_duration || 25) * 60,
      short_break: (s.short_break || 5) * 60,
      long_break: (s.long_break || 15) * 60,
    };
  }
  CYCLE_LENGTH = s.cycle_length || 4;
  SOUND_ENABLED = s.sound_enabled !== 0;
}

const STATUS_LABELS = {
  pomodoro: {
    idle: '准备开始', focus: '专注中', short_break: '短休息',
    long_break: '长休息', paused: '已暂停',
  },
  stopwatch: {
    idle: '正向计时', focus: '计时中', paused: '已暂停',
  },
};

function createStore() {
  const LS_KEY = 'pomodoroStore';
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');

  const data = {
    status: 'idle',
    prevStatus: null,
    cycleCount: 0,
    currentTaskId: null,
    darkMode: false,
    mode: 'pomodoro',
    ...saved,
    status: 'idle',
    prevStatus: null,
  };

  const listeners = [];

  function get(key) { return key ? data[key] : { ...data }; }

  function set(changes) {
    Object.assign(data, changes);
    localStorage.setItem(LS_KEY, JSON.stringify({
      cycleCount: data.cycleCount,
      currentTaskId: data.currentTaskId,
      darkMode: data.darkMode,
      mode: data.mode,
    }));
    listeners.forEach(fn => fn(data));
  }

  function subscribe(fn) { listeners.push(fn); }

  return { get, set, subscribe };
}
