var path = require('path')
var childProcess = require('child_process')
var semver = require('semver')
var fs = require('fs')
var Ansi = require('ansi-to-html')

var ansi = new Ansi({
  escapeXML: true,
  colors: {
    1: '#844',
    2: '#484',
    5: '#fcc',
    6: '#cfc',
  }
});

var gitCommands, workTree, docSubdir
var gitENOENT = /fatal: (Path "([^"]+)" does not exist in "([0-9a-f]{40})"|ambiguous argument "([^"]+)": unknown revision or path not in the working tree.)/

// Internal helper to talk to the git subprocess (spawn)
async function gitSpawn (commands) {
  return new Promise((resolve, reject) => {
    commands = gitCommands.concat(commands)
    var child = childProcess.spawn(gitMech.gitBin, commands, { cwd: workTree })
    var stdout = []
    var stderr = []
    child.stdout.addListener('data', function (text) {
      stdout[stdout.length] = text
    })
    child.stderr.addListener('data', function (text) {
      stderr[stderr.length] = text
    })
    var exitCode
    child.addListener('exit', function (code) {
      exitCode = code
    })
    child.addListener('close', function () {
      if (exitCode > 0 && stderr.length > 0) {
        var err = new Error(gitMech.gitBin + ' ' + commands.join(' ') + '\n' + join(stderr, 'utf8'))
        if (gitENOENT.test(err.message)) {
          err.errno = process.ENOENT
        }
        reject(err)
      }

      resolve(join(stdout))
    })
    child.stdin.end()
  })
}

// Internal helper to talk to the git subprocess (exec)
async function gitExec (commands) {
  return new Promise((resolve, reject) => {
    commands = gitMech.gitBin + ' ' + gitCommands.concat(commands).join(' ')
    // There is a limit at 200KB (increase it with maxBuffer option)
    childProcess.exec(commands, { cwd: workTree }, function (error, stdout, stderr) {
      if (error || stderr.length > 0) {
        error = new Error(commands + '\n' + stderr)
        reject(error)
        return
      }
      resolve(stdout)
    })
  })
}

function join (arr) {
  var result
  var index = 0
  var length

  length = arr.reduce(function (l, b) {
    return l + b.length
  }, 0)
  result = new Buffer(length)
  arr.forEach(function (b) {
    b.copy(result, index)
    index += b.length
  })

  return result
}

var gitMech = {

  // FIXME: shouldPush should be a method which understands if the local repo is in sync with the remote
  // BY default we assume the repo is dirty and needs a push
  // git rev-list master...origin/master (if the output is empty, there is no need for a push)
  shouldPush: true,

  pulling: false,

  pushing: false,

  branch: 'master',

  gitBin: 'git',

  remote: '',

  setup: function (gitBin, repoDir, repoDocSubdir, refspec, callback) {
    this.gitBin = gitBin || 'git'

    childProcess.exec(this.gitBin + ' --version', function (err, stdout, stderr) {
      if (err !== null || stderr !== '') {
        callback('Cannot run git (tried with ' + this.gitBin + ')')
        return
      }

      var version = stdout.trim().split(' ')

      if (version[0] !== 'git' || version.length < 3) {
        callback('The provided git binary (' + this.gitBin + ") doesn't look as git to me.")
        return
      }

      version = version[2]

      var splitted = version.split('.')
      if (splitted.length > 3) {
        version = splitted.slice(0, 3 - splitted.length).join('.')
      }

      if (splitted.length === 2) {
        version = splitted.concat([0]).join('.')
      }

      if (!semver.valid(version)) {
        callback('Unrecognized git semver (' + version + ')')
        return
      }

      try {
        fs.statSync(repoDir)
      } catch (e) {
        callback('Bad repository path (not exists): ' + repoDir)
        return
      }

      docSubdir = repoDocSubdir.trim().replace(/^\/|\/$/g, '')
      if (docSubdir !== '') {
        docSubdir = docSubdir + '/'
      }

      try {
        fs.statSync(repoDir + '/' + docSubdir)
      } catch (e) {
        callback('Bad document subdirectory (not exists): ' + repoDir + '/' + docSubdir)
        return
      }

      try {
        var gitDir = path.join(repoDir, '.git')
        fs.statSync(gitDir)
        workTree = repoDir
        gitCommands = ['--git-dir=' + gitDir, '--work-tree=' + workTree]
      } catch (e) {
        callback('Bad repository path (not initialized): ' + repoDir)
        return
      }

      if (refspec.length > 0) {
        this.remote = refspec[0].trim()
        this.branch = refspec[1] ? refspec[1].trim() : 'master'
      }

      callback(null, version)
    }.bind(this))
  },

  absPath: function (path) {
    return workTree + '/' + docSubdir + path
  },

  show: async function (path, version) {
    const data = await gitSpawn(['show', version + ':' + docSubdir + path])
    return data.toString();
  },

  remoteExists: async function (remote) {
    const data = await gitSpawn(['remote'])
    const remotes = data ? data.toString().split('\n') : []
    return remotes.indexOf(remote) !== -1
  },

  pull: async function () {

    if (this.pulling || this.remote === '' || this.branch === '') return

    if (!(await this.remoteExists(this.remote))) {
      throw 'Remote does not exist ' + '(' + this.remote + ')'
    }

    this.pulling = true
    await gitSpawn(['pull', this.remote, this.branch]);
    this.pulling = false
  },

  push: async function () {

    if (this.remote === '' || this.branch === '') return
    if (this.pushing || !this.shouldPush) return

    if (!(await this.remoteExists(this.remote))) {
      throw 'Remote does not exist ' + '(' + this.remote + ')'
    }

    this.pushing = true
    await gitSpawn(['push', this.remote, this.branch])
    this.pushing = false
    this.shouldPush = false
  },

  logBulk: async function (pattern) {

    const data = await gitSpawn(['log', '--format=@@METADATA@@%x09%h%x09%H%x09%an%x09%ae%x09%aD%x09%ar%x09%at%x09%s', '--name-only'])

    const files = {};
    let metadata;

    for (const line of data.toString().split('\n')) {
      if (line.match(/^@@METADATA@@/)) {
        const [ marker, hash, fullHash, author, email, date, relDate, timestamp, subject ] = line.split('\t');
        metadata = {
          hash,
          hashRef: '',
          fullHash,
          author,
          email,
          date,
          relDate: groomRelativeDate(relDate),
          timestamp,
          subject
        }
      } else {
        if (!pattern.test(line)) continue;
        if (files[line]) continue;

        files[line] = { filename: line, ...metadata };
      }
    }
    return files;
  },

  log: async function (path, version, howMany=1) {

    const data = await gitSpawn(['log', '-' + howMany, '--reverse', '--no-notes', '--pretty=format:%h%n%H%n%an%n%ae%n%aD%n%ar%n%at%n%s', version, '--', docSubdir + path])

    var logdata = data ? data.toString().split('\n') : []
    var group
    var metadata = []

    for (var i = Math.floor(logdata.length / 8); i-- > 0;) {
      group = logdata.slice(i * 8, (i + 1) * 8)
      metadata.push({
        name: path.replace('.md', ''),
        hash: group[0],
        hashRef: group[0],
        fullhash: group[1],
        author: group[2],
        email: group[3],
        date: group[4],
        relDate: groomRelativeDate(group[5]),
        timestamp: group[6],
        subject: group[7]
      })
    }

    if (metadata[0]) metadata[0].hashRef = ''
    if (howMany === 1) metadata = metadata[0]

    return metadata
  },

  // Returns the hashes of commits on a file
  hashes: async function (path, howMany) {
    const data = await gitSpawn(['log', '-' + howMany, '--reverse', '--no-notes', '--pretty=format:%h', '--', docSubdir + path])
    return data ? data.toString().split('\n') : []
  },

  add: async function (path, message, author) {
    await gitSpawn(['add', docSubdir + path])
    await this.commit(path, message, author)
  },

  rm: async function (path, message, author) {
    await gitSpawn(['rm', docSubdir + path])
    await this.commit(path, message, author)
  },

  mv: async function (path, newPath, message, author) {
    await gitSpawn(['mv', '-f', docSubdir + path, docSubdir + newPath])
    await this.commit(path, message, author)
  },

  commit: async function (path, message, author) {
    var options
    if (path) {
      options = ['commit', '--author="' + author + '"', '-m', message, docSubdir + path]
    } else {
      options = ['commit', '--author="' + author + '"', '-am', message]
    }
    await gitSpawn(options)
    this.shouldPush = true
  },

  grep: async function (pattern) {
    var args = [ 'grep', '--no-color', '-F', '-n', '-i', '-I', '-z', pattern ]
    if (docSubdir !== '') {
      args.push(docSubdir)
    }
    const grep = await gitSpawn(args)

    var result
    if (grep) {
      result = grep.toString().split('\n')
    } else {
      result = []
    }

    const files = await gitSpawn([ 'ls-files', docSubdir + '*.md' ]);

    if (files) {
      var patternLower = pattern.toLowerCase()

      files.toString().split('\n').forEach(function (name) {
        var nameLower = path.basename(name).toLowerCase()
        if (nameLower.search(patternLower) >= 0) {
          result.push(path.basename(name))
        }
      })
    }

    return result
  },

  diff: async function (path, revisions) {
    const colorOpts = [
      '-c', 'color.diff.old=red magenta',
      '-c', 'color.diff.new=green cyan',
      '-c', 'color.diff.oldMoved=red magenta',
      '-c', 'color.diff.newMoved=green cyan',
      '-c', 'color.diff.meta=',
      '-c', 'color.diff.frag=',
    ];
    const data = await gitSpawn([ ...colorOpts, 'diff', '--color-words=.', '-b', revisions, '--', docSubdir + path ])
    return typeof data !== 'undefined' ? ansi.toHtml(data.toString()) : ''
  },

  lastMessage: async function (path, revision) {
    const data = gitSpawn(['log', '-1', revision, '--no-notes', '--pretty=format:%s', '--', docSubdir + path])
    return data.toString().trim()
  },

  ls: async function (pattern) {
    const data = await gitExec([ 'ls-tree', '--name-only', '-r', 'HEAD', '--', docSubdir + pattern ])
    return data.toString().split('\n').filter(v => v != '')
  },

  revert: async function (path, revision, author) {
    await gitExec(['checkout', revision, docSubdir + path])
    const data = await gitMech.commit(path, 'Reverted to ' + revision, author)
    return String(data).trim()
  }
}

function groomRelativeDate(relativeDate) {
  return relativeDate
    .replace(/ hours? ago/, 'h ago')
    .replace(/ days? ago/, 'd ago')
    .replace(/ minutes? ago/, 'm ago')
    .replace(/\d+ seconds? ago/, 'now')
}

module.exports = gitMech
