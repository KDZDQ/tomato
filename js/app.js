/**
 * 应用主入口 —— Supabase 云端版
 */
(async function () {
  // --- 音频解锁 ---
  const unlockOnce = () => { sound.unlock(); document.removeEventListener('click', unlockOnce); document.removeEventListener('touchstart', unlockOnce); };
  document.addEventListener('click', unlockOnce);
  document.addEventListener('touchstart', unlockOnce);

  // --- 认证检查 ---
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    renderAuthModal(true);
    initAuthForm();
    return;
  }
  await bootApp(session.user);

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      renderAuthModal(true);
      initAuthForm();
    }
  });

  // ===================== 认证表单 =====================

  function initAuthForm() {
    document.getElementById('auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      doAuth('login');
    });
    document.getElementById('btn-register').addEventListener('click', () => doAuth('register'));
  }

  async function doAuth(action) {
    showAuthError('');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-pass').value;
    if (!email || !password) return showAuthError('请输入邮箱和密码');

    let result;
    if (action === 'register') {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    if (result.error) return showAuthError(result.error.message);

    if (action === 'register' && !result.data.session) {
      showAuthError('注册成功！请查收验证邮件后再登录。');
      return;
    }

    renderAuthModal(false);
    await bootApp(result.data.user);
  }

  // ===================== 启动应用 =====================

  async function bootApp(user) {
    renderAuthModal(false);
    renderUserInfo(user.email);

    const store = createStore();

    const settings = await db.getSettings();
    applySettings(settings);
    renderSettingsForm(settings);

    const timer = new PrecisionTimer(
      (val) => renderTimer(val),
      () => onPhaseComplete()
    );

    applyTheme(store.get('darkMode'));
    renderModeTabs(store.get('mode'));
    renderTimer(store.get('mode') === 'stopwatch' ? 0 : DURATIONS.focus);
    renderStatus(store.get());
    renderDots(store.get());
    await refreshTasks();
    await refreshStats();

    store.subscribe((state) => {
      renderStatus(state);
      renderDots(state);
      renderControls(state);
      renderModeTabs(state.mode);
    });
    store.set({});

    // --- 番茄钟逻辑 ---

    async function onPhaseComplete() {
      const state = store.get();
      sound.play(SOUND_CHOICE);

      if (state.status === 'focus') {
        const newCycle = state.cycleCount + 1;
        await db.addRecord(state.currentTaskId, DURATIONS.focus);
        if (state.currentTaskId) await db.incrementPomodoro(state.currentTaskId);
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

    // --- 模式切换 ---
    document.getElementById('mode-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.mode-tab');
      if (!tab) return;
      const newMode = tab.dataset.mode;
      if (newMode === store.get('mode')) return;
      timer.stop();
      store.set({ mode: newMode, status: 'idle', prevStatus: null });
      renderTimer(newMode === 'stopwatch' ? 0 : DURATIONS.focus);
    });

    // --- 按钮事件 ---
    document.getElementById('controls').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.id;
      const mode = store.get('mode');

      if (mode === 'pomodoro') {
        if (id === 'btn-start') { store.set({ status: 'focus' }); timer.start(DURATIONS.focus); }
        else if (id === 'btn-pause') { store.set({ status: 'paused', prevStatus: store.get('status') }); timer.pause(); }
        else if (id === 'btn-resume') { store.set({ status: store.get('prevStatus'), prevStatus: null }); timer.resume(); }
        else if (id === 'btn-skip') { handleSkip(); }
        else if (id === 'btn-reset') { timer.stop(); store.set({ status: 'idle', prevStatus: null }); renderTimer(DURATIONS.focus); }
        return;
      }

      if (id === 'btn-sw-start') { store.set({ status: 'focus' }); timer.startUp(); }
      else if (id === 'btn-sw-pause') { store.set({ status: 'paused' }); timer.pause(); }
      else if (id === 'btn-sw-resume') { store.set({ status: 'focus' }); timer.resume(); }
      else if (id === 'btn-sw-stop') { handleStopwatchStop(); }
    });

    async function handleStopwatchStop() {
      const elapsed = Math.floor(timer.remaining);
      timer.stop();
      store.set({ status: 'idle' });
      renderTimer(0);
      if (elapsed > 0) {
        await db.addRecord(store.get('currentTaskId'), elapsed);
        await refreshStats();
        sound.play(SOUND_CHOICE);
      }
    }

    // --- 任务 ---
    document.getElementById('task-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameEl = document.getElementById('task-name');
      const estEl = document.getElementById('task-est');
      if (!nameEl.value.trim()) return;
      await db.addTask(nameEl.value.trim(), parseInt(estEl.value) || 1);
      nameEl.value = '';
      estEl.value = '1';
      await refreshTasks();
    });

    document.getElementById('task-list').addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.task-delete');
      if (delBtn) {
        const id = Number(delBtn.dataset.id);
        await db.deleteTask(id);
        if (store.get('currentTaskId') === id) store.set({ currentTaskId: null });
        await refreshTasks();
        return;
      }
      const info = e.target.closest('.task-info');
      if (info) {
        const id = Number(info.dataset.id);
        store.set({ currentTaskId: store.get('currentTaskId') === id ? null : id });
      }
    });

    // --- 设置 ---
    document.getElementById('settings-toggle').addEventListener('click', () => {
      const body = document.getElementById('settings-body');
      const toggle = document.getElementById('settings-toggle');
      const open = body.style.display === 'none';
      body.style.display = open ? 'block' : 'none';
      toggle.textContent = open ? '设置 ▴' : '设置 ▾';
    });

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
      const payload = {
        focus_duration: parseInt($('#set-focus').value) || 25,
        short_break: parseInt($('#set-short').value) || 5,
        long_break: parseInt($('#set-long').value) || 15,
        cycle_length: parseInt($('#set-cycle').value) || 4,
        sound: $('#set-sound').value,
      };
      await db.saveSettings(payload);
      applySettings(payload);
      const dark = $('#set-theme').value === '1';
      store.set({ darkMode: dark });
      applyTheme(dark);
      if (store.get('status') === 'idle' && store.get('mode') === 'pomodoro') renderTimer(DURATIONS.focus);
      document.getElementById('btn-save-settings').textContent = '已保存 ✓';
      setTimeout(() => { document.getElementById('btn-save-settings').textContent = '保存设置'; }, 1500);
    });

    document.getElementById('btn-preview-sound').addEventListener('click', () => {
      sound.play($('#set-sound').value);
    });

    // --- 退出登录 ---
    document.getElementById('btn-logout').addEventListener('click', async () => {
      timer.stop();
      await supabase.auth.signOut();
      window.location.reload();
    });

    // --- 数据刷新 ---
    async function refreshTasks() {
      const tasks = await db.getTasks();
      renderTasks(tasks, store.get('currentTaskId'));
    }

    async function refreshStats() {
      renderStats(await db.getStats());
    }
  }
})();
