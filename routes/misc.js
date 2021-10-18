/* global Git */
var router = require('express').Router()
var renderer = require('../lib/renderer')
var fs = require('fs')
var fm = require('front-matter')
var models = require('../lib/models')
var app = require('../lib/app').getInstance()

models.use(Git)

router.get('/misc/syntax-reference', _getSyntaxReference)
router.post('/misc/preview', _postPreview)
router.get('/misc/existence', _getExistence)
router.get("/misc/upload", _getUploadForm);

function _getSyntaxReference (req, res) {
  res.render('syntax')
}

function _postPreview (req, res) {
  const { body } = fm(req.body.data);
  res.render('preview', {
    content: renderer.render(body)
  })
}

function _getUploadForm(req, res) {
  if (!res.locals.user) {
    res.render("404", {
      title: 'Modules'
    });
    return;
  }

  res.render("upload", {
    config: app.locals.config.get("application").repository,
    message: 'Ready to upload.'
  });
}

function _getExistence (req, res) {
  if (!req.query.data) {
    res.send(JSON.stringify({data: []}))
    return
  }

  var result = []
  var page
  var n = req.query.data.length

  req.query.data.forEach(function (pageName, idx) {
    (function (name, index) {
      page = new models.Page(name)
      if (!fs.existsSync(page.pathname)) {
        result.push(name)
      }
      if (index === (n - 1)) {
        res.send(JSON.stringify({data: result}))
      }
    }(pageName, idx))
  })
}

router.get('/avatar.svg', (req, res) => {
  const name = req.query.name || '';
  const idx = Math.abs([].reduce.call(name, (p, c, i, a) => (p << 5) - p + a.charCodeAt(i), 0));
  const colors = ['#ffba00', '#f56f02', '#645dac', ' #0088d2', '#00b345'];
  const color = colors[idx % colors.length];
  const initials = name.split(' ').map(x => x[0]).join``;
  res.set('content-type', 'image/svg+xml');
  res.render("avatar", { color, initials });
});

router.all('*', function (req, res) {
  res.locals.title = '404 - Not found'
  res.statusCode = 404
  res.render('404.pug')
})

module.exports = router
