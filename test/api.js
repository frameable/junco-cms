const suite = require('./index');
const Browser = require('./lib/browser');
const assert = require('assert');
const child_process = require('child_process');

let serverProcess;
let browser;
const PORT = 23092;

async function setup() {
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';
  serverProcess = child_process.spawn('node', ['app']);
  if (process.env.DEBUG) {
    serverProcess.stdout.on('data', d => console.log(d.toString()))
  }
  browser = new Browser(`http://localhost:${PORT}`);
  await new Promise(r => setTimeout(r, 1000));
}

async function teardown() {
  serverProcess.kill();
}

suite('api', async test => {

  await setup();

  await test('page', async _ => {
    const response = await browser.get('/api/pages/article-1');
    assert.equal(response.status, 200);
    const data = await response.text();
    assert.match(data, /article-1/);
  });

  await test('pages', async _ => {
    const response = await browser.get('/api/pages?prefix=article');
    assert.equal(response.status, 200);
    const data = await response.text();
    assert.match(data, /article-1/);
    assert.match(data, /article-2/);
    assert.match(data, /article-3/);
  });

  await test('negative prefix', async _ => {
    const response = await browser.get('/api/pages?prefix=3e47b75000b0924b6c9ba5759a7cf15d');
    assert.equal(response.status, 200);
    const data = await response.text();
    assert.doesNotMatch(data, /article-1/);
  });

  await teardown();

});



