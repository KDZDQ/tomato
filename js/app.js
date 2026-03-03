/**
 * 应用主入口
 * bootApp(user) 由 auth.js 在登录成功后调用
 */

// 页面加载时检查是否已有会话
(async function () {
  var unlockOnce = function () { sound.unlock(); document.removeEventListener('click', unlockOnce); document.removeEventListener('touchstart', unlockOnce); };
  document.addEventListener('click', unlockOnce);
  document.addEventListener('touchstart', unlockOnce);

  if (typeof supa === 'undefined') return;

  try {
    var result = await supa.auth.getSession();
    if (result.data.session) {
      await bootApp(result.data.session.user);
    }
  } catch (e) {
    console.error('Session check:', e);
  }
})();

/** 启动主应用 —— 由 auth.js 或上方 session 检查调用 */
async function bootApp(user) {
  document.getElementById('auth-modal').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('header-user').textContent = user.email || '';

  var store = createStore();

  var settings;
  try { settings = await db.getSettings(); } catch (e) {
    settings = { focus_duration: 25, short_break: 5, long_break: 15, cycle_length: 4, sound: 'ding' };
  }
  applySettings(settings);
  renderSettingsForm(settings);

  var timer = new PrecisionTimer(
    function (val) { renderTimer(val); },
    function () { onPhaseComplete(); }
  );

  applyTheme(store.get('darkMode'));
  renderModeTabs(store.get('mode'));
  renderTimer(store.get('mode') === 'stopwatch' ? 0 : DURATIONS.focus);
  renderStatus(store.get());
  renderDots(store.get());
  await refreshTasks();
  await refreshStats();

  store.subscribe(function (state) {
    renderStatus(state);
    renderDots(state);
    renderControls(state);
    renderModeTabs(state.mode);
  });
  store.set({});

  // --- 番茄钟 ---

  async function onPhaseComplete() {
    var state = store.get();
    sound.play(SOUND_CHOICE);
    if (state.status === 'focus') {
      var newCycle = state.cycleCount + 1;
      try {
        await db.addRecord(state.currentTaskId, DURATIONS.focus);
        if (state.currentTaskId) await db.incrementPomodoro(state.currentTaskId);
      } catch (_) {}
      await refreshTasks();
      await refreshStats();
      if (newCycle >= CYCLE_LENGTH) {
        store.set({ status: 'long_break', cycleCount: 0 });
        timer.start(DURATIONS.long_break);
      } else {
        store.set({ status: 'short_break', cycleCount: newCycle });
        timer.start(DURATIONS.short_break);
      }
    } else {
      store.set({ status: 'focus' });
      timer.start(DURATIONS.focus);
    }
  }

  // --- 模式切换 ---
  document.getElementById('mode-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.mode-tab');
    if (!tab) return;
    var newMode = tab.dataset.mode;
    if (newMode === store.get('mode')) return;
    timer.stop();
    store.set({ mode: newMode, status: 'idle', prevStatus: null });
    renderTimer(newMode === 'stopwatch' ? 0 : DURATIONS.focus);
  });

  // --- 按钮事件 ---
  document.getElementById('controls').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var id = btn.id;
    var mode = store.get('mode');

    if (mode === 'pomodoro') {
      if (id === 'btn-start') { store.set({ status: 'focus' }); timer.start(DURATIONS.focus); }
      else if (id === 'btn-pause') { store.set({ status: 'paused', prevStatus: store.get('status') }); timer.pause(); }
      else if (id === 'btn-resume') { store.set({ status: store.get('prevStatus'), prevStatus: null }); timer.resume(); }
      else if (id === 'btn-skip') {
        var st = store.get();
        var active = st.status === 'paused' ? st.prevStatus : st.status;
        timer.stop();
        if (active === 'focus') {
          var next = st.cycleCount >= CYCLE_LENGTH - 1 ? 'long_break' : 'short_break';
          store.set({ status: next, prevStatus: null });
          timer.start(DURATIONS[next]);
        } else {
          store.set({ status: 'focus', prevStatus: null });
          timer.start(DURATIONS.focus);
        }
      }
      else if (id === 'btn-reset') { timer.stop(); store.set({ status: 'idle', prevStatus: null }); renderTimer(DURATIONS.focus); }
      return;
    }

    if (id === 'btn-sw-start') { store.set({ status: 'focus' }); timer.startUp(); }
    else if (id === 'btn-sw-pause') { store.set({ status: 'paused' }); timer.pause(); }
    else if (id === 'btn-sw-resume') { store.set({ status: 'focus' }); timer.resume(); }
    else if (id === 'btn-sw-stop') {
      var elapsed = Math.floor(timer.remaining);
      timer.stop();
      store.set({ status: 'idle' });
      renderTimer(0);
      if (elapsed > 0) {
        db.addRecord(store.get('currentTaskId'), elapsed).catch(function () {});
        refreshStats();
        sound.play(SOUND_CHOICE);
      }
    }
  });

  // --- 任务 ---
  document.getElementById('task-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var nameEl = document.getElementById('task-name');
    var estEl = document.getElementById('task-est');
    if (!nameEl.value.trim()) return;
    await db.addTask(nameEl.value.trim(), parseInt(estEl.value) || 1);
    nameEl.value = '';
    estEl.value = '1';
    await refreshTasks();
  });

  document.getElementById('task-list').addEventListener('click', async function (e) {
    var delBtn = e.target.closest('.task-delete');
    if (delBtn) {
      await db.deleteTask(Number(delBtn.dataset.id));
      if (store.get('currentTaskId') === Number(delBtn.dataset.id)) store.set({ currentTaskId: null });
      await refreshTasks();
      return;
    }
    var info = e.target.closest('.task-info');
    if (info) {
      var id = Number(info.dataset.id);
      store.set({ currentTaskId: store.get('currentTaskId') === id ? null : id });
    }
  });

  // --- 设置 ---
  document.getElementById('settings-toggle').addEventListener('click', function () {
    var body = document.getElementById('settings-body');
    var toggle = document.getElementById('settings-toggle');
    var open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    toggle.textContent = open ? '设置 ▴' : '设置 ▾';
  });

  document.getElementById('btn-save-settings').addEventListener('click', async function () {
    var payload = {
      focus_duration: parseInt($('#set-focus').value) || 25,
      short_break: parseInt($('#set-short').value) || 5,
      long_break: parseInt($('#set-long').value) || 15,
      cycle_length: parseInt($('#set-cycle').value) || 4,
      sound: $('#set-sound').value,
    };
    try { await db.saveSettings(payload); } catch (_) {}
    applySettings(payload);
    var dark = $('#set-theme').value === '1';
    store.set({ darkMode: dark });
    applyTheme(dark);
    if (store.get('status') === 'idle' && store.get('mode') === 'pomodoro') renderTimer(DURATIONS.focus);
    var btn = document.getElementById('btn-save-settings');
    btn.textContent = '已保存 ✓';
    setTimeout(function () { btn.textContent = '保存设置'; }, 1500);
  });

  document.getElementById('btn-preview-sound').addEventListener('click', function () {
    sound.play($('#set-sound').value);
  });

  // --- 数据刷新 ---
  async function refreshTasks() {
    try { renderTasks(await db.getTasks(), store.get('currentTaskId')); }
    catch (_) { renderTasks([], null); }
  }

  async function refreshStats() {
    try { renderStats(await db.getStats()); }
    catch (_) { renderStats({ todayFocusTime: 0, todayCount: 0, totalCount: 0 }); }
  }
}

/** 主题切换 —— HTML onclick 调用 */
function toggleTheme() {
  // toggleTheme needs access to store, use localStorage directly
  var saved = JSON.parse(localStorage.getItem('pomodoroStore') || '{}');
  saved.darkMode = !saved.darkMode;
  localStorage.setItem('pomodoroStore', JSON.stringify(saved));
  applyTheme(saved.darkMode);
}
