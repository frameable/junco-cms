process.env.NODE_ENV = 'test'

const suite = require('./index');
const Browser = require('./lib/browser');
const assert = require('assert');
const child_process = require('child_process');
const config = require('config');

let serverProcess;
let browser;
const PORT = 23091;
const REPO_PATH = config.get('application').repository

async function setup() {
  process.env.PORT = PORT
  process.env.NODE_ENV = 'test'
  child_process.spawn('/bin/rm', ['-Rf', REPO_PATH])
  child_process.spawn('git', ['clone', 'test/var/content.git', REPO_PATH])
  serverProcess = child_process.spawn('node', ['app'])
  if (process.env.DEBUG) {
    serverProcess.stdout.on('data', d => console.log(d.toString()))
    serverProcess.stderr.on('data', d => console.log(d.toString()))
  }
  browser = new Browser(`http://localhost:${PORT}`)
  await new Promise(r => setTimeout(r, 1000))
  const response = await browser.post('/login', {
    username: 'admin',
    password: 'admin'
  })
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), '/auth/done')
}

async function teardown() {
  //child_process.spawn('/bin/rm', ['-Rf', REPO_PATH])
  serverProcess.kill();
}

async function log(count=1) {
  return new Promise(resolve => {
    const proc = child_process.spawn('git', ['--git-dir', REPO_PATH + '/.git', 'log', '-n', count, '-p'])
    proc.stdout.on('data', d => proc._stdout += d)
    proc.stderr.on('data', d => console.error(d.toString()))
    proc.on('close', _ => resolve(proc._stdout))
  })
}

suite('admin', async test => {

  await setup();

  await test('list', async _ => {
    const response = await browser.get('/wiki');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /article-1/);
    assert.match(html, /article-2/);
    assert.match(html, /article-3/);
  });

  await test('create', async _ => {
    await browser.post('/pages/new', {
      pageTitle: 'article-4',
      content: 'article-4 body',
    });
    const response = await browser.get('/wiki');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /article-4/);
    assert.match(await log(), /created.+article-4/);
    assert.match(await log(), /\+article-4 body/);
  });

  await test('edit', async _ => {
    await browser.post('/pages/article%203/edit', {
      pageTitle: 'article 3',
      content: 'article-3 body 6057f16',
    });
    var response = await browser.get('/wiki/article-3');
    assert.equal(response.status, 200);
    var html = await response.text();
    assert.match(html, /6057f16/);
    assert.match(await log(), /updated.+article-3/);
    assert.match(await log(), /\+article-3 body 6057f16/);
    var response = await browser.get('/wiki/article-3/history');
    assert.equal(response.status, 200);
    var html = await response.text();
    assert.match(html, /revisions/i);
    assert.match(html, /(<tr>.+){2}/s);
  });

  await test('rename', async _ => {
    await browser.post('/pages/new', {
      pageTitle: 'article renameable',
      content: 'article-renameable body',
    });
    await browser.post('/pages/article%20renameable/edit', {
      pageTitle: 'article renamed',
      content: 'article-renameable body ba57f32',
    });

    assert.match(await log(2), /renamed.+article-renameable.+article-renamed/);
    const response = await browser.get('/wiki/article-renamed');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /ba57f32/);
  });

  await test('rename fail', async _ => {
    await browser.post('/pages/new', {
      pageTitle: 'article renameable fail',
      content: 'article-renameable-fail body ea57f39',
    });
    var response = await browser.post('/pages/article%20renameable%20fail/edit', {
      pageTitle: 'article 1',
      content: 'article-renameabe body cc57f31',
    });
    assert.equal(response.status, 302);
    var response = await browser.get('/pages/article%20renameable%20fail/edit?e=1')
    const html = await response.text();
    assert.match(html, /ea57f39/);
    assert.match(html, /A page with this name already exists/);
  });

  await test('delete', async _ => {
    await browser.post('/pages/new', {
      pageTitle: 'article deleteable',
      content: 'article-deleteable body',
    });
    assert.match(await (await browser.get('/wiki')).text(), /article-deleteable/);
    var response = await browser.post('/pages/article%20deleteable/edit', {
      _method: 'delete',
    });
    assert.equal(response.status, 302);
    assert.match(await log(), /removed.+article-deleteable/);
    assert.match(await log(), /-article-deleteable body/);
    assert.match(await (await browser.get('/wiki')).text(), /(?!article-deleteable)./);
    var response = await browser.get('/wiki/article%20deleteable');
    assert.equal(response.status, 404);
  });

  await teardown();

});



