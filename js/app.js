/**
 * 应用主入口 —— 纯前端版，数据存储于 localStorage
 */
(function () {
  const store = createStore();

  // --- 加载用户设置 ---
  const settings = db.getSettings();
  applySettings(settings);
  renderSettingsForm(settings);

  const timer = new PrecisionTimer(
    (val) => renderTimer(val),
    () => onPhaseComplete()
  );

  // --- 初始化渲染 ---
  applyTheme(store.get('darkMode'));
  renderModeTabs(store.get('mode'));
  renderTimer(store.get('mode') === 'stopwatch' ? 0 : DURATIONS.focus);
  renderStatus(store.get());
  renderDots(store.get());
  refreshTasks();
  refreshStats();

  store.subscribe((state) => {
    renderStatus(state);
    renderDots(state);
    renderControls(state);
    renderTasks(db.getTasks(), state.currentTaskId);
    renderModeTabs(state.mode);
  });

  store.set({});

  // ===================== 番茄钟逻辑 =====================

  function onPhaseComplete() {
    const state = store.get();
    if (SOUND_ENABLED) playBeep();

    if (state.status === 'focus') {
      const newCycle = state.cycleCount + 1;
      db.addRecord(state.currentTaskId, DURATIONS.focus);
      if (state.currentTaskId) db.incrementPomodoro(state.currentTaskId);
      refreshTasks();
      refreshStats();

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

  function handleSkip() {
    const state = store.get();
    const activeStatus = state.status === 'paused' ? state.prevStatus : state.status;
    timer.stop();

    if (activeStatus === 'focus') {
      const next = state.cycleCount >= CYCLE_LENGTH - 1 ? 'long_break' : 'short_break';
      store.set({ status: next, prevStatus: null });
      timer.start(DURATIONS[next]);
    } else {
      store.set({ status: 'focus', prevStatus: null });
      timer.start(DURATIONS.focus);
    }
  }

  // ===================== 模式切换 =====================

  document.getElementById('mode-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.mode-tab');
    if (!tab) return;
    const newMode = tab.dataset.mode;
    if (newMode === store.get('mode')) return;

    timer.stop();
    store.set({ mode: newMode, status: 'idle', prevStatus: null });
    renderTimer(newMode === 'stopwatch' ? 0 : DURATIONS.focus);
  });

  // ===================== 按钮事件 =====================

  document.getElementById('controls').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.id;
    const mode = store.get('mode');

    if (mode === 'pomodoro') {
      if (id === 'btn-start') {
        store.set({ status: 'focus' });
        timer.start(DURATIONS.focus);
      } else if (id === 'btn-pause') {
        store.set({ status: 'paused', prevStatus: store.get('status') });
        timer.pause();
      } else if (id === 'btn-resume') {
        store.set({ status: store.get('prevStatus'), prevStatus: null });
        timer.resume();
      } else if (id === 'btn-skip') {
        handleSkip();
      } else if (id === 'btn-reset') {
        timer.stop();
        store.set({ status: 'idle', prevStatus: null });
        renderTimer(DURATIONS.focus);
      }
      return;
    }

    if (id === 'btn-sw-start') {
      store.set({ status: 'focus' });
      timer.startUp();
    } else if (id === 'btn-sw-pause') {
      store.set({ status: 'paused' });
      timer.pause();
    } else if (id === 'btn-sw-resume') {
      store.set({ status: 'focus' });
      timer.resume();
    } else if (id === 'btn-sw-stop') {
      handleStopwatchStop();
    }
  });

  function handleStopwatchStop() {
    const elapsed = Math.floor(timer.remaining);
    timer.stop();
    store.set({ status: 'idle' });
    renderTimer(0);

    if (elapsed > 0) {
      db.addRecord(store.get('currentTaskId'), elapsed);
      refreshStats();
      if (SOUND_ENABLED) playBeep();
    }
  }

  // ===================== 任务 =====================

  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('task-name');
    const estEl = document.getElementById('task-est');
    if (!nameEl.value.trim()) return;
    db.addTask(nameEl.value.trim(), parseInt(estEl.value) || 1);
    nameEl.value = '';
    estEl.value = '1';
    refreshTasks();
  });

  document.getElementById('task-list').addEventListener('click', (e) => {
    const delBtn = e.target.closest('.task-delete');
    if (delBtn) {
      const id = Number(delBtn.dataset.id);
      db.deleteTask(id);
      if (store.get('currentTaskId') === id) store.set({ currentTaskId: null });
      refreshTasks();
      return;
    }
    const info = e.target.closest('.task-info');
    if (info) {
      const id = Number(info.dataset.id);
      store.set({ currentTaskId: store.get('currentTaskId') === id ? null : id });
    }
  });

  // ===================== 设置 =====================

  document.getElementById('settings-toggle').addEventListener('click', () => {
    const body = document.getElementById('settings-body');
    const toggle = document.getElementById('settings-toggle');
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    toggle.textContent = open ? '设置 ▴' : '设置 ▾';
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const payload = {
      focus_duration: parseInt($('#set-focus').value) || 25,
      short_break: parseInt($('#set-short').value) || 5,
      long_break: parseInt($('#set-long').value) || 15,
      cycle_length: parseInt($('#set-cycle').value) || 4,
      sound_enabled: parseInt($('#set-sound').value),
    };

    db.saveSettings(payload);
    applySettings(payload);

    const dark = $('#set-theme').value === '1';
    store.set({ darkMode: dark });
    applyTheme(dark);

    if (store.get('status') === 'idle' && store.get('mode') === 'pomodoro') {
      renderTimer(DURATIONS.focus);
    }

    document.getElementById('btn-save-settings').textContent = '已保存 ✓';
    setTimeout(() => { document.getElementById('btn-save-settings').textContent = '保存设置'; }, 1500);
  });

  // ===================== 数据刷新 =====================

  function refreshTasks() {
    renderTasks(db.getTasks(), store.get('currentTaskId'));
  }

  function refreshStats() {
    renderStats(db.getStats());
  }
})();
