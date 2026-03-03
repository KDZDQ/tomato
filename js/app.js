/**
 * 应用主入口 —— Supabase 云端版
 */
(async function () {
  // --- 音频解锁 ---
  const unlockOnce = () => { sound.unlock(); document.removeEventListener('click', unlockOnce); document.removeEventListener('touchstart', unlockOnce); };
  document.addEventListener('click', unlockOnce);
  document.addEventListener('touchstart', unlockOnce);

  if (!supabase) {
    showAuthError('无法连接到服务器，请刷新页面重试');
    return;
  }

  // --- 认证检查 ---
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await bootApp(session.user);
    } else {
      renderAuthModal(true);
      initAuthForm();
    }
  } catch (e) {
    console.error('Auth check failed:', e);
    renderAuthModal(true);
    initAuthForm();
  }

  supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_OUT') window.location.reload();
  });

  // ===================== 认证表单 =====================

  let authFormBound = false;

  function initAuthForm() {
    if (authFormBound) return;
    authFormBound = true;

    document.getElementById('auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      doLogin();
    });

    document.getElementById('btn-register').addEventListener('click', () => {
      doRegister();
    });
  }

  async function doLogin() {
    showAuthError('');
    showAuthSuccess('');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-pass').value;
    if (!email || !password) return showAuthError('请输入邮箱和密码');

    const btn = document.getElementById('btn-login');
    btn.textContent = '登录中...';
    btn.disabled = true;

    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        if (result.error.message.includes('Invalid login')) {
          showAuthError('邮箱或密码错误。如果是新用户，请点击右侧"注册新账号"');
        } else if (result.error.message.includes('Email not confirmed')) {
          showAuthError('邮箱尚未验证，请查收验证邮件并点击链接后再登录');
        } else {
          showAuthError(result.error.message);
        }
      } else {
        await bootApp(result.data.user);
      }
    } catch (e) {
      showAuthError('网络错误，请重试');
    } finally {
      btn.textContent = '登录';
      btn.disabled = false;
    }
  }

  async function doRegister() {
    showAuthError('');
    showAuthSuccess('');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-pass').value;
    if (!email || !password) return showAuthError('请输入邮箱和密码');
    if (password.length < 6) return showAuthError('密码至少需要6位');

    const btn = document.getElementById('btn-register');
    btn.textContent = '注册中...';
    btn.disabled = true;

    try {
      const result = await supabase.auth.signUp({ email, password });
      if (result.error) {
        if (result.error.message.includes('already registered')) {
          showAuthError('该邮箱已注册，请直接点击"登录"');
        } else {
          showAuthError(result.error.message);
        }
      } else if (result.data.session) {
        await bootApp(result.data.user);
      } else {
        showAuthSuccess('注册成功！验证邮件已发送到 ' + email + '，请前往邮箱点击验证链接，然后回来登录。');
      }
    } catch (e) {
      showAuthError('网络错误，请重试');
    } finally {
      btn.textContent = '注册新账号';
      btn.disabled = false;
    }
  }

  // ===================== 启动应用 =====================

  async function bootApp(user) {
    renderAuthModal(false);
    renderUserInfo(user.email);

    const store = createStore();

    let settings;
    try {
      settings = await db.getSettings();
    } catch (e) {
      settings = { focus_duration: 25, short_break: 5, long_break: 15, cycle_length: 4, sound: 'ding' };
    }
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
        try { await db.addRecord(store.get('currentTaskId'), elapsed); } catch (_) {}
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
      try { await db.saveSettings(payload); } catch (_) {}
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

    // --- 主题切换 ---
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const dark = !store.get('darkMode');
      store.set({ darkMode: dark });
      applyTheme(dark);
    });

    // --- 退出登录 ---
    document.getElementById('btn-logout').addEventListener('click', async () => {
      timer.stop();
      await supabase.auth.signOut();
    });

    // --- 数据刷新 ---
    async function refreshTasks() {
      try {
        const tasks = await db.getTasks();
        renderTasks(tasks, store.get('currentTaskId'));
      } catch (_) { renderTasks([], null); }
    }

    async function refreshStats() {
      try { renderStats(await db.getStats()); }
      catch (_) { renderStats({ todayFocusTime: 0, todayCount: 0, totalCount: 0 }); }
    }
  }
})();
