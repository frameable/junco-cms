var config = require('config')
var path = require('path')
var namer = require('./namer')
var fs = require('fs/promises')
var fm = require('front-matter')
var locker = require('./locker')

var gitmech

function Page (name, revision) {
  name = name || ''
  this.setNames(name)
  this.revision = revision || 'HEAD'
  this.content = ''
  this.title = ''
  this.metadata = {}
  this.error = ''
  this.author = ''
  this.lockedBy = null
  this.hashes = []
  this.lastCommand = ''
  this.lastCommitMessage = ''
}

Page.prototype.setNames = function (name) {
  this.name = namer.unwikify(name.replace(/\.md$/, ''))
  this.wikiname = namer.wikify(this.name)
  this.filename = this.wikiname + '.md'
  this.pathname = gitmech.absPath(this.filename)
}

Page.prototype.remove = async function () {
  await gitmech.rm(this.filename, 'Page removed (' + this.wikiname + ')', this.author);
}

Page.prototype.renameTo = async function (newName) {
  var newFilename = namer.wikify(newName) + '.md'

  if (await this.exists(gitmech.absPath(newFilename))) {
    throw "already exists: " + newFilename;
  }

  const message = 'Page renamed (' + this.filename + ' => ' + newFilename + ')'
  await gitmech.mv(this.filename, newFilename, message, this.author)
  this.setNames(newName)
}

Page.prototype.exists = async function (path) {
  try {
    await fs.stat(path || this.pathname)
    return true;
  } catch(e) {
    if (e.code == 'ENOENT') {
      return false;
    } else {
      throw e;
    }
  }
}

Page.prototype.save = async function (message) {
  message = message || ''

  const defaultMessage = (await this.exists() ? 'Content updated' : 'Page created') + ' (' + this.wikiname + ')'
  message = (message.trim() === '') ? defaultMessage : message.trim()

  let content = this.content

  if (config.pages.title.fromContent) {
    content = '# ' + this.title + '\n' + content
  }

  content = content.replace(/\r\n/gm, '\n')

  await fs.writeFile(this.pathname, content)
  await gitmech.add(this.filename, message, this.author)

  return content;
}

Page.prototype.urlFor = function (action) {
  return Page.urlFor(this.wikiname, action, config.application.proxyPath)
}

Page.urlFor = function (name, action, proxyPath) {
  var wname = encodeURIComponent(name)
  proxyPath = proxyPath || ''

  var url = ''

  switch (true) {

    case action === 'show':
      url = '/wiki/' + wname
      break

    case action === 'edit':
      url = '/pages/' + wname + '/edit'
      break

    case action === 'edit error':
      url = '/pages/' + wname + '/edit?e=1'
      break

    case action === 'edit put':
      url = '/pages/' + wname
      break

    case action === 'revert':
      url = '/pages/' + wname + '/revert'
      break

    case action === 'history':
      url = '/wiki/' + wname + '/history'
      break

    case action === 'compare':
      url = '/wiki/' + wname + '/compare'
      break

    case action === 'new':
      url = '/pages/new?page=' + wname
      break

    case action === 'new error':
      url = '/pages/new?page=' + wname + '&e=1'
      break

    default:
      url = '/'
      break
  }

  return proxyPath + url
}

Page.prototype.urlForShow = function (action) {
  return this.urlFor('show')
}

Page.prototype.urlForEdit = function (action) {
  return this.urlFor('edit')
}

Page.prototype.urlForEditWithError = function (action) {
  return this.urlFor('edit error')
}

Page.prototype.urlForNewWithError = function (action) {
  return this.urlFor('new error')
}

Page.prototype.urlForEditPut = function (action) {
  return this.urlFor('edit put')
}

Page.prototype.urlForRevert = function (action) {
  return this.urlFor('revert')
}

Page.prototype.urlForHistory = function (action) {
  return this.urlFor('history')
}

Page.prototype.urlForCompare = function (action) {
  return this.urlFor('compare')
}

Page.prototype.isIndex = function () {
  return config.pages.index === this.name
}

Page.prototype.isFooter = function () {
  return this.name === '_footer'
}

Page.prototype.isSidebar = function () {
  return this.name === '_sidebar'
}

Page.prototype.lock = function (user) {
  var lock = locker.getLock(this.name)

  if (lock && lock.user.asGitAuthor !== user.asGitAuthor) {
    this.lockedBy = lock.user
    return false
  }

  locker.lock(this.name, user)
  this.lockedBy = user
  return true
}

Page.prototype.unlock = function (user) {
  this.lockedBy = null
  locker.unlock(this.name)
}

Page.prototype.fetch = function (extended) {
  if (!extended) {
    return Promise.all([
      this.fetchContent(),
      this.fetchMetadata(),
      this.fetchHashes(1)
    ])
  } else {
    return Promise.all([
      this.fetchContent(),
      this.fetchMetadata()
    ])
  }
}

Page.prototype.fetchContent = async function () {

  let content = await gitmech.show(this.filename, this.revision)
  this.lastCommand = 'show'

  content = content || ''

  this.rawContent = content
  let doc = {}
  try {
    doc = fm(content)
  } catch(e) {
    console.log("trouble parsing front matter")
  }
  content = doc.body || ''
  this.attributes = doc.attributes

  if (content.length === 0 || config.pages.title.fromFilename) {
    this.title = this.name
    this.content = content
  } else {
    // Retrieves the title from the first line of the content (and removes 
    // it from the actual content)
    // By default Jingo (< 1.0) stores the title as the first line of the
    // document, prefixed by a '#'
    var lines = content.split('\n')
    this.title = lines[0].trim()

    if (this.title.charAt(0) === '#') {
      this.title = this.title.substr(1).trim()
      this.content = lines.slice(1).join('\n')
    } else {
      // Mmmmh... this file doesn't seem to follow Jingo's convention...
      this.title = this.name
      this.content = content
    }
  }
}

Page.prototype.fetchMetadata = async function () {

  const metadata = await gitmech.log(this.filename, this.revision)
  this.lastCommand = 'log'

  if (typeof metadata !== 'undefined') {
    this.metadata = metadata
  }
}

Page.prototype.fetchHashes = async function (howmany) {

  howmany = howmany || 2

  const hashes = await gitmech.hashes(this.filename, howmany)
  this.lastCommand = 'hashes'
  this.hashes = hashes
}

Page.prototype.fetchLastCommitMessage = async function () {

  const message = await gitmech.lastMessage(this.filename, 'HEAD')
  this.lastCommand = 'lastMessage'
  this.lastCommitMessage = message
}

Page.prototype.fetchHistory = async function () {
  const history = await gitmech.log(this.filename, 'HEAD', 30)
  this.lastCommand = 'log'
  return history
}

Page.prototype.fetchRevisionsDiff = async function (revisions) {
  const diff = await gitmech.diff(this.filename, revisions)
  return diff;
}

Page.prototype.revert = async function () {
  if (this.revision === 'HEAD') {
    throw "can't revert for HEAD revision"
  }

  const data = await gitmech.revert(this.filename, this.revision, this.author)
  return data
}

function Pages () {
  this.models = []
  this.total = 0
}

Pages.prototype.fetch = async function (pagen = 0, prefix = '', contentOnly = false) {

  const metadata = await gitmech.logBulk(/\.md$/)

  const files = (await gitmech.ls('*.md'))
    .reduce((a, i) => (a[i] = true) && a, {})

  const promises = [];

  const pages = Object.values(metadata)
    .filter(d => files[d.filename])
    .sort((a, b) => b.timestamp - a.timestamp)

  var itemsPerPage = config.pages.itemsPerPage

  this.total = pages.length
  this.totalPages = Math.ceil(this.total / itemsPerPage)

  if (pagen <= 0) {
    pagen = 1
  }
  if (pagen > this.totalPages) {
    pagen = this.totalPages
  }

  this.currentPage = pagen

  var offset = (pagen - 1) * itemsPerPage
  var slice = pages.slice(offset, offset + itemsPerPage)

  for (const data of slice) {
    var filename = path.basename(data.filename)
    var key = filename.replace(/\.md$/, '')
    const page = new Page(key)
    this.models.push(page)
    if (contentOnly) {
      const promise = page.fetchContent()
      promises.push(promise)
    } else {
      page.metadata = metadata[filename]
      page.title = page.wikiname
    }
  }

  for (const p of promises)
    await p
}

var models = {

  Page: Page,

  Pages: Pages,

  use: function (git) {
    gitmech = git
  },

  repositories: {
    refresh: function () {
      return gitmech.pull()
    }
  },

  pages: {
    findString: function (string) {
      return gitmech.grep(string)
    }
  }
}

module.exports = models
