const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
    
    console.log('\n步骤 2: 截取初始页面');
    await page.screenshot({ path: 'screenshot-1-initial.png', fullPage: true });
    console.log('✓ 截图已保存: screenshot-1-initial.png');

    // 等待一下让页面完全加载
    await page.waitForTimeout(2000);

    console.log('\n步骤 3: 输入邮箱和密码');
    // 查找邮箱输入框
    const emailField = await page.locator('#auth-email');
    await emailField.fill('test@test.com');
    console.log('✓ 已输入邮箱: test@test.com');

    // 查找密码输入框
    const passwordField = await page.locator('#auth-pass');
    await passwordField.fill('123456');
    console.log('✓ 已输入密码: 123456');

    await page.screenshot({ path: 'screenshot-2-filled.png', fullPage: true });
    console.log('✓ 截图已保存: screenshot-2-filled.png');

    console.log('\n步骤 4: 点击登录按钮');
    const loginButton = await page.locator('#btn-login');
    await loginButton.click();
    console.log('✓ 已点击登录按钮');

    // 等待响应
    await page.waitForTimeout(3000);

    console.log('\n步骤 5: 检查点击后的状态');
    await page.screenshot({ path: 'screenshot-3-after-login.png', fullPage: true });
    console.log('✓ 截图已保存: screenshot-3-after-login.png');

    // 检查是否有错误消息显示
    const authError = await page.locator('#auth-error');
    const errorVisible = await authError.isVisible();
    if (errorVisible) {
      const errorText = await authError.textContent();
      console.log(`\n❌ 显示的错误消息: ${errorText}`);
      errors.push(`UI Error: ${errorText}`);
    }

    const authSuccess = await page.locator('#auth-success');
    const successVisible = await authSuccess.isVisible();
    if (successVisible) {
      const successText = await authSuccess.textContent();
      console.log(`\n✓ 显示的成功消息: ${successText}`);
    }

    // 生成报告
    console.log('\n' + '='.repeat(60));
    console.log('测试报告');
    console.log('='.repeat(60));
    
    console.log('\n控制台消息:');
    if (consoleMessages.length === 0) {
      console.log('  (无消息)');
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
    console.log('  - screenshot-1-initial.png (初始页面)');
    console.log('  - screenshot-2-filled.png (填写表单后)');
    console.log('  - screenshot-3-after-login.png (点击登录后)');

    // 保存详细报告到文件
    const report = {
      timestamp: new Date().toISOString(),
      url: 'https://KDZDQ.github.io/tomato/',
      consoleMessages,
      errors,
      screenshots: [
        'screenshot-1-initial.png',
        'screenshot-2-filled.png',
        'screenshot-3-after-login.png'
      ]
    };

    fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
    console.log('\n✓ 详细报告已保存到: test-report.json');

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    await page.screenshot({ path: 'screenshot-error.png', fullPage: true });
  } finally {
    console.log('\n按 Enter 键关闭浏览器...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    await browser.close();
  }
})();
