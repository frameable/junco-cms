var marked = require('marked');

marked.Parser.prototype.parse = function(src) {

  this.inline = new marked.InlineLexer(src.links, this.options, this.renderer);
  this.tokens = src.reverse();
  this.renderer._hflag = {};
  var out = '';
  while (this.next()) {
    out += this.tok();
  }
  for (var i = 6; i >= 1; i--) {
    if (this.renderer._hflag[i]) out += '\n</section>';
  }
  return out;
};


marked.Renderer.prototype.hr = function() {

  var output = '';
  for(var i = 6; i >= 1; i--) {
    if (this._hflag[i]) {
      output +=  '\n</section>';
      this._hflag[i] = false;
    }
  }

  output += '\n<hr>';

  return output;

}

marked.Renderer.prototype.heading = function(text, level, raw) {

  var output = '';
  for(var i = 6; i >= parseInt(level); i--) {
    if (this._hflag[i]) {
      output +=  '\n</section>';
      this._hflag[i] = false;
    }
  }

  var klass = raw.toLowerCase().replace(/[^a-z]+/g, '-');
  output += '\n<section data-level=' + level + ' id="'
    + klass
    + '"><h'
    + level
    + '>'
    + text
    + '</h'
    + level
    + '>\n';
    this._hflag[level] = true;

  return output;
};

marked.Renderer.prototype.image = function(href, title, text) {
  var captures = href.match(/(.*?)( =(\d+)x(\d*))?$/);
  href = captures[1];

  var out = '<img src="' + href + '" alt="' + text + '"';

  if (captures[2]) {
    var width = captures[3];
    var height = captures[4];

    out += ' width="' + width + '"';

    if (height) {
      out += ' height="' + height + '"';
    }
  }

  if (title) {
    out += ' title="' + title + '"';
  }

  out += this.options.xhtml ? '/>' : '>';

  return out;
}

module.exports = marked;
