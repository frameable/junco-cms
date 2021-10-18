var tr = require('transliteration')
var Namer = function () {
}

Namer.prototype.wikify = function (str) {

  if (typeof str !== 'string' || str.trim() === '') {
    return ''
  }

  return str.toLowerCase().replace(/[^\w:]+/g, '-')

}

// Not symmetric by any chance, but still better than nothing
Namer.prototype.unwikify = function (str) {

  if (typeof str !== 'string' || str.trim() === '') {
    return ''
  }

  return str.replace(/-/g, ' ');
}

module.exports = new Namer()
