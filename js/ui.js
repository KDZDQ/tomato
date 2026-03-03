/**
 * UI 渲染模块
 */
var $ = function (sel) { return document.querySelector(sel); };

function renderTimer(seconds) {
  $('#time-display').textContent = formatTime(seconds);
}

function renderStatus(state) {
  var label = $('#status-label');
  var labels = STATUS_LABELS[state.mode] || STATUS_LABELS.pomodoro;
  if (state.mode === 'stopwatch') {
    label.textContent = labels[state.status] || '';
    label.className = 'status-label' + (state.status === 'focus' ? ' stopwatch' : '');
  } else {
    var displayStatus = state.status === 'paused' ? state.prevStatus : state.status;
    label.textContent = labels[state.status] || '';
    label.className = 'status-label ' + (displayStatus || '');
  }
}

function renderDots(state) {
  var el = $('#pomodoro-dots');
  if (state.mode === 'stopwatch') {
    el.style.display = 'none';
  } else {
    el.style.display = '';
    el.textContent = Array.from({ length: CYCLE_LENGTH }, function (_, i) {
      return i < state.cycleCount ? '●' : '○';
    }).join(' ');
  }
}

function renderControls(state) {
  var status = state.status, prevStatus = state.prevStatus, mode = state.mode;
  if (mode === 'stopwatch') { renderStopwatchControls(status); return; }
  var isRunning = ['focus', 'short_break', 'long_break'].indexOf(status) >= 0;
  var isPaused = status === 'paused';
  var phaseClass = isPaused ? (prevStatus || 'focus') : status;
  var html = '';
  if (status === 'idle') {
    html = '<button class="btn primary" id="btn-start">开始专注</button>';
  } else if (isRunning) {
    html = '<button class="btn" id="btn-pause">暂停</button><button class="btn" id="btn-skip">跳过</button><button class="btn danger" id="btn-reset">重置</button>';
  } else if (isPaused) {
    html = '<button class="btn primary ' + phaseClass + '" id="btn-resume">恢复</button><button class="btn" id="btn-skip">跳过</button><button class="btn danger" id="btn-reset">重置</button>';
  }
  $('#controls').innerHTML = html;
}

function renderStopwatchControls(status) {
  var html = '';
  if (status === 'idle') {
    html = '<button class="btn primary sw" id="btn-sw-start">开始计时</button>';
  } else if (status === 'focus') {
    html = '<button class="btn" id="btn-sw-pause">暂停</button><button class="btn danger" id="btn-sw-stop">停止并记录</button>';
  } else if (status === 'paused') {
    html = '<button class="btn primary sw" id="btn-sw-resume">恢复</button><button class="btn danger" id="btn-sw-stop">停止并记录</button>';
  }
  $('#controls').innerHTML = html;
}

function renderModeTabs(mode) {
  document.querySelectorAll('.mode-tab').forEach(function (tab) {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
}

function renderTasks(tasks, currentTaskId) {
  var ul = $('#task-list');
  if (!tasks.length) {
    ul.innerHTML = '<li style="color:var(--text-sec);justify-content:center">暂无任务</li>';
    return;
  }
  ul.innerHTML = tasks.map(function (t) {
    return '<li class="' + (t.id === currentTaskId ? 'active' : '') + '">' +
      '<div class="task-info" data-id="' + t.id + '">' +
      '<div class="task-name">' + escapeHtml(t.name) + '</div>' +
      '<div class="task-progress">🍅 ' + t.completed + ' / ' + t.estimated + '</div></div>' +
      '<button class="task-delete" data-id="' + t.id + '">✕</button></li>';
  }).join('');
}

function renderStats(stats) {
  $('#stat-time').textContent = formatDuration(stats.todayFocusTime);
  $('#stat-today').textContent = stats.todayCount;
  $('#stat-total').textContent = stats.totalCount;
}

function renderSettingsForm(s) {
  if (!s) return;
  $('#set-focus').value = s.focus_duration || 25;
  $('#set-short').value = s.short_break || 5;
  $('#set-long').value = s.long_break || 15;
  $('#set-cycle').value = s.cycle_length || 4;
  var sel = $('#set-sound');
  if (!sel.options.length) {
    sound.list().forEach(function (item) {
      var opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.label;
      sel.appendChild(opt);
    });
  }
  sel.value = s.sound || 'ding';
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  var themeSelect = $('#set-theme');
  if (themeSelect) themeSelect.value = dark ? '1' : '0';
}

function escapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
