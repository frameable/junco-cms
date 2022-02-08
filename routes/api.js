/* global Git */
var router = require('express').Router()
var renderer = require('../lib/renderer')
var fs = require('fs')
var fm = require('front-matter')
var models = require('../lib/models')
var app = require('../lib/app').getInstance()
var _cache = {};

// reset cache every two mins
setInterval(_ => _cache = {}, 60 * 2 * 1000);

router.get('/api/pages/:page', _getApiPage)

router.get('/api/pages', _getApiPages)

function _getApiPage (req, res) {

  const key = `page@@${req.params.page}@@${req.params.version}`;

  if (_cache[key]) {
    return res.json(_cache[key]);
  }

  var page = new models.Page(req.params.page, req.params.version)

  page.fetch().then(function () {
    if (!page.error) {

      var responsePage = {
        tokens: renderer.lex(page.rawContent),
        content: renderer.render(page.content),
        source: page.rawContent,
        metadata: page.metadata,
        attributes: page.attributes,
      }

      const response = { page: responsePage };
      res.json(_cache[key] = response);

    } else {

      var error = String(page.error);

      if (error.match(/does not exist/)) {
        res.statusCode = 404
      } else {
        res.statusCode = 500
      }

      return res.json({
        message: "Couldn't load page",
        error
      })
    }
  })
}

async function _getApiPages (req, res) {

  const key = `pages@@${req.query.prefix}`;

  if (_cache[key]) {
    return res.json(_cache[key])
  }

  var pages = new models.Pages()
  var items = []

  const prefix = req.query.prefix;

  const contentOnly = true;
  pages.fetch(0, prefix, contentOnly).then(function () {
    pages.models.forEach(function (page) {
      if (!page.error) {
        items.push({
          content: renderer.render(page.content),
          source: page.rawContent,
          metadata: page.metadata,
          attributes: page.attributes,
        })
      }
    })

    const response = { pages: items };
    res.json(_cache[key] = response);

  }).catch(function (e) {
    console.log(e)
  })

}

module.exports = router
