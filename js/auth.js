/**
 * 认证模块 —— 全局函数，通过 HTML onclick 直接调用
 */

/** 切换登录/注册视图 */
function showView(name) {
  document.getElementById('view-login').style.display = name === 'login' ? 'block' : 'none';
  document.getElementById('view-register').style.display = name === 'register' ? 'block' : 'none';
  clearAuthMessages();
}

function clearAuthMessages() {
  ['login-error', 'register-error', 'register-success'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
}

function showMsg(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

/** 登录 */
async function handleLogin() {
  clearAuthMessages();
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-pass').value;

  if (!email || !password) { showMsg('login-error', '请输入邮箱和密码'); return; }

  var btn = document.getElementById('btn-do-login');
  btn.textContent = '登录中...';
  btn.disabled = true;

  try {
    var result = await supa.auth.signInWithPassword({ email: email, password: password });

    if (result.error) {
      var msg = result.error.message;
      if (msg.indexOf('Invalid login') >= 0) {
        showMsg('login-error', '邮箱或密码错误');
      } else if (msg.indexOf('Email not confirmed') >= 0) {
        showMsg('login-error', '邮箱尚未验证，请先查收验证邮件并点击链接');
      } else {
        showMsg('login-error', msg);
      }
    } else {
      await bootApp(result.data.user);
    }
  } catch (e) {
    showMsg('login-error', '网络错误，请检查网络后重试');
  }

  btn.textContent = '登录';
  btn.disabled = false;
}

/** 注册 */
async function handleRegister() {
  clearAuthMessages();
  var email = document.getElementById('reg-email').value.trim();
  var password = document.getElementById('reg-pass').value;

  if (!email) { showMsg('register-error', '请输入邮箱地址'); return; }
  if (!password || password.length < 6) { showMsg('register-error', '密码至少需要6位'); return; }

  var btn = document.getElementById('btn-do-register');
  btn.textContent = '注册中...';
  btn.disabled = true;

  try {
    var result = await supa.auth.signUp({ email: email, password: password });

    if (result.error) {
      var msg = result.error.message;
      if (msg.indexOf('already registered') >= 0 || msg.indexOf('already been registered') >= 0) {
        showMsg('register-error', '该邮箱已注册，请返回登录页直接登录');
      } else {
        showMsg('register-error', msg);
      }
    } else if (result.data.session) {
      await bootApp(result.data.user);
    } else {
      showMsg('register-success', '注册成功！验证邮件已发送到 ' + email + '，请前往邮箱点击验证链接，然后返回登录。');
    }
  } catch (e) {
    showMsg('register-error', '网络错误，请检查网络后重试');
  }

  btn.textContent = '注册';
  btn.disabled = false;
}

/** 退出登录 */
async function handleLogout() {
  try { await supa.auth.signOut(); } catch (e) {}
  window.location.reload();
}
