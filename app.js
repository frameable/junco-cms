#!/usr/bin/env node

/*
 * Jingo, wiki engine
 * http://github.com/claudioc/jingo
 *
 * Copyright 2013-2017 Claudio Cicali <claudio.cicali@gmail.com>
 * Released under the MIT license
 */
var program = require('commander')
var tools = require('./lib/tools')
var config = require('config')
var http = require('http')
var fs = require('fs')
var os = require('os')
var semver = require('semver')
var pkg = require('./package')

global.Git = require('./lib/gitmech')

var refspec = config.get('application').remote.split(/\s+/)

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection at:', reason.stack || reason)
});

process.on('uncaughtException', (reason) => {
  console.error('Uncaught Exception at:', reason.stack || reason)
});

Git.setup(
  config.get('application').git,
  config.get('application').repository,
  config.get('application').docSubdir,
  refspec,
  function (err, version) {
    if (err) {
      console.log(err)
      process.exit(-1)
    }

    if (
      os.platform() === 'darwin' &&
      !config.get('application').skipGitCheck &&
      config.get('pages').title.fromFilename &&
      !semver.satisfies(version, '>=1.8.5')
    ) {
      console.log('Your current setup uses the filename of the wiki page as the page title.')
      console.log('Unfortunately this version of git (' + version + ".x) on OSX doesn't handle")
      console.log(
        'very well non ASCII characters used in filenames, therefore I rather not start.'
      )
      console.log('You can continue anyway, setting `application.skipGitCheck` to true in the')
      console.log('config file but you should better upgrade your git. Thank you.')
      process.exit(-1)
    }

    start()
  }
)

function start() {
  var app = require('./lib/app').initialize(config)

  var listenAddr = process.env.NW_ADDR || '';
  if (config.get('server').localOnly) {
    listenAddr = 'localhost';
  }

  const port = process.env.PORT || config.get('server').port;

  http.createServer(app).listen(port, listenAddr, function () {
    console.log('listening on port %s', port)
  })

  if (config.get('application').allowHtml) {
    console.log(
      'Warning: using the configuration option `allowHtml: true` may have security implications; please consult the README for more info.'
    )
  }

  if (config.get('application').pushInterval && refspec.length > 0) {
    setInterval(async function () {
      try {
        await Git.pull()
        await Git.push()
      } catch (e) {
        console.log("push interval failed", e)
      }
    }, config.get('application').pushInterval * 1000)
  }
}

