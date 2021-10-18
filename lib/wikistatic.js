/* global Git */
var config = require('config')
var ecstatic = require('ecstatic')

var WikiStatic = function () {
}

WikiStatic.prototype.configure = function () {
  var wikiRoot = Git.absPath('')
  var middleware = ecstatic({ root: wikiRoot, handleError: false })

  var whiteList = config.application.staticWhitelist
  var patterns = whiteList.split(',')
  var regexpList = []

  for (var i = 0; i < patterns.length; i++) {
    var pattern = patterns[i].trim()
    var res = /^\/(.*)\/(.*)/.exec(pattern)

    if (res) {
      try {
        var regexp = RegExp(res[1], res[2])
        regexpList.push(regexp)
      } catch (e) {
        console.log('Warning: ignoring bad whitelist pattern: ' + pattern)
      }
    } else {
      console.log('Warning: ignoring bad whitelist pattern: ' + pattern)
    }
  }

  return function (req, res, next) {
    if (regexpList.some(function (regexp) {
      return regexp.test(req.url)
    })) {
      // The requested URL matches some pattern on the white list, serve it up!
      middleware(req, res, next)
    } else {
      next()
    }
  }
}

module.exports = new WikiStatic()
