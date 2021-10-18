var Marked = require('./marked-section')
var config = require('config')
var cryptoz = require('crypto')
var Nsh = require('node-syntaxhighlighter')
var namer = require('./namer')
var Page = require('./models').Page
var directives = require('./directives')
var jp = require('jsonpath')

var mdRenderer = new Marked.Renderer()

mdRenderer.code = function(code, lang, escaped) {
  var originalLang = lang;
  if (this.options.highlight) {
    lang = lang ? lang.split('+').shift() : lang;
    var out = this.options.highlight(code, lang)
    if (out !== null && out !== code) {
      escaped = true
      code = out
    }
  }

  if (!lang) {
    return '<code class="md-code">' + (escaped ? code : escape(code, true)) + '\n</code>'
  }

  return (
    '<code class="md-code ' +
    (originalLang ? ('orig-lang-' + originalLang + ' ') : '') +
    this.options.langPrefix +
    escape(lang, true) +
    '">' +
    (escaped ? code : escape(code, true)) +
    '\n</code>\n'
  )
}

Marked.setOptions({
  gfm: true,
  renderer: mdRenderer,
  // pedantic: this is set on the render method
  // breaks: this is set on the render method
  tables: true,
  smartLists: true,
  // Jingo < 1.9.0 had this flag set at 'false' by default to be able to add
  // iframes and other html in the pages. This is considered too dangerous and
  // hence we are using a new configuration option, default to 'true'
  sanitize: config.application.allowHtml,
  highlight: function(code, lang) {
    lang = lang || 'text'
    return Nsh.highlight(code, Nsh.getLanguage(lang) || Nsh.getLanguage('text'), {
      gutter: lang !== 'text'
    })
  }
})

var tagmap = {}

// Yields the content with the rendered [[bracket tags]]
// The rules are the same for Gollum https://github.com/github/gollum
function extractTags(text) {
  tagmap = {}

  var matches = text.match(/\[\[(.+?)\]\]/g)
  var tag
  var id

  if (matches) {
    matches.forEach(function(match) {
      match = match.trim()
      tag = /(.?)\[\[(.+?)\]\](.?)/.exec(match)
      if (tag[1] === "'") {
        return
      }
      id = cryptoz
        .createHash('sha1')
        .update(tag[2])
        .digest('hex')
      tagmap[id] = tag[2]
      text = text.replace(tag[0], id)
    })
  }

  return text
}

function evalTags(text) {
  var parts, name, url, pageName, re

  for (var k in tagmap) {
    if (tagmap.hasOwnProperty(k)) {
      parts = tagmap[k].split('|')
      name = pageName = parts[0]
      if (parts[1]) {
        pageName = parts[1]
      }
      url = Page.urlFor(namer.wikify(pageName), 'show', config.application.proxyPath)

      tagmap[k] = `[${name}](${url})`
    }
  }

  for (k in tagmap) {
    if (tagmap.hasOwnProperty(k)) {
      re = new RegExp(k, 'g')
      text = text.replace(re, tagmap[k])
    }
  }

  return text
}

var directiveMap = directives.directiveMap

function applyDirectives(text) {
  var matches = text.match(/\{\{([^}]*)\}\}/g)

  if (matches) {
    matches.forEach(function(match) {
      var directiveString = /\{\{([^}]*)\}\}/.exec(match)[1]
      var directiveSplit = directiveString.split('\n')
      var directive = directiveSplit[0]
      var args = directiveSplit.slice(1).join('\n')
      if (directive in directiveMap) {
        text = text.replace(match, directiveMap[directive](text, args))
      }
    })
  }
  return text
}

function prepare(content) {
  Marked.setOptions({
    pedantic: config.application.pedanticMarkdown,
    breaks: config.application.gfmBreaks
  })

  var text = extractTags(content)
  text = evalTags(text)
  text = applyDirectives(text)
  return text;
}

var Renderer = {
  render: function(content) {
    return Marked(prepare(content))
  },
  lex: function(content) {
    let tokens = Marked.lexer(prepare(content));
    jp.apply(tokens, '$..[?(@.type)]', t => {
      if (t.type == 'paragraph') {
        const matches = t.text.match(/!\[.*\]\(([^ ]+).*\)/);
        if (matches) {
          t.type = 'image';
          t.src = matches[1];
        }
      }
      return t;
    });
    return tokens;
  },
}

module.exports = Renderer
