const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 收集控制台消息
  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleMessages.push(text);
    console.log(text);
  });

  page.on('pageerror', error => {
    const errorText = `[PAGE ERROR] ${error.message}`;
    errors.push(errorText);
    console.error(errorText);
  });

  try {
    console.log('步骤 1: 导航到 https://KDZDQ.github.io/tomato/');
    await page.goto('https://KDZDQ.github.io/tomato/', { waitUntil: 'networkidle' });
    console.log('✓ 页面已加载');
    
    console.log('\n步骤 2: 等待页面完全加载');
    await page.waitForTimeout(2000);
    console.log('✓ 等待完成');

    console.log('\n步骤 3: 截取初始页面');
    await page.screenshot({ path: 'screenshot-signup-1-initial.png', fullPage: true });
    console.log('✓ 截图已保存: screenshot-signup-1-initial.png');

    console.log('\n步骤 4: 检查页面元素');
    // 检查登录表单元素是否存在
    const emailField = await page.locator('#auth-email');
    const passwordField = await page.locator('#auth-pass');
    const loginButton = await page.locator('#btn-login');
    const signupButton = await page.locator('#btn-register');

    console.log('✓ 邮箱输入框存在:', await emailField.isVisible());
    console.log('✓ 密码输入框存在:', await passwordField.isVisible());
    console.log('✓ 登录按钮存在:', await loginButton.isVisible());
    console.log('✓ 注册按钮存在:', await signupButton.isVisible());

    console.log('\n步骤 5: 输入 testuser@example.com 到邮箱字段');
    await emailField.fill('testuser@example.com');
    console.log('✓ 已输入邮箱: testuser@example.com');

    console.log('\n步骤 6: 输入 test123456 到密码字段');
    await passwordField.fill('test123456');
    console.log('✓ 已输入密码: test123456');

    await page.screenshot({ path: 'screenshot-signup-2-filled.png', fullPage: true });
    console.log('✓ 截图已保存: screenshot-signup-2-filled.png');

    console.log('\n步骤 7: 点击"注册新账号"按钮');
    await signupButton.click();
    console.log('✓ 已点击注册按钮');

    console.log('\n步骤 8: 等待响应');
    await page.waitForTimeout(3000);

    console.log('\n步骤 9: 检查是否有消息显示');
    await page.screenshot({ path: 'screenshot-signup-3-after-click.png', fullPage: true });
    console.log('✓ 截图已保存: screenshot-signup-3-after-click.png');

    // 检查成功消息
    const authSuccess = await page.locator('#auth-success');
    const successVisible = await authSuccess.isVisible();
    if (successVisible) {
      const successText = await authSuccess.textContent();
      console.log(`\n✓ 成功消息: ${successText}`);
    } else {
      console.log('\n⚠ 未显示成功消息');
    }

    // 检查错误消息
    const authError = await page.locator('#auth-error');
    const errorVisible = await authError.isVisible();
    if (errorVisible) {
      const errorText = await authError.textContent();
      console.log(`\n❌ 错误消息: ${errorText}`);
      errors.push(`UI Error: ${errorText}`);
    } else {
      console.log('\n✓ 未显示错误消息');
    }

    // 生成报告
    console.log('\n' + '='.repeat(60));
    console.log('注册功能测试报告');
    console.log('='.repeat(60));
    
    console.log('\n控制台消息:');
    if (consoleMessages.length === 0) {
      console.log('  (无控制台消息)');
    } else {
      consoleMessages.forEach(msg => console.log(`  ${msg}`));
    }

    console.log('\n错误列表:');
    if (errors.length === 0) {
      console.log('  ✓ 未发现错误');
    } else {
      errors.forEach(err => console.log(`  ❌ ${err}`));
    }

    console.log('\n截图文件:');
    console.log('  - screenshot-signup-1-initial.png (初始页面)');
    console.log('  - screenshot-signup-2-filled.png (填写表单后)');
    console.log('  - screenshot-signup-3-after-click.png (点击注册后)');

    // 保存详细报告到文件
    const report = {
      timestamp: new Date().toISOString(),
      url: 'https://KDZDQ.github.io/tomato/',
      action: 'signup',
      email: 'testuser@example.com',
      password: 'test123456',
      consoleMessages,
      errors,
      screenshots: [
        'screenshot-signup-1-initial.png',
        'screenshot-signup-2-filled.png',
        'screenshot-signup-3-after-click.png'
      ]
    };

    fs.writeFileSync('test-signup-report.json', JSON.stringify(report, null, 2));
    console.log('\n✓ 详细报告已保存到: test-signup-report.json');

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    errors.push(`Test Error: ${error.message}`);
    await page.screenshot({ path: 'screenshot-signup-error.png', fullPage: true });
  } finally {
    console.log('\n按 Enter 键关闭浏览器...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    await browser.close();
  }
})();
