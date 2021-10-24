# Junco

Minimal git-based CMS in Node.js, originally forked from https://github.com/claudioc/jingo

### Introduction

At its core, Junco is essentially a web interface for editing markdown files in a dedicated [git](https://git-scm.com/) repository.  There is basic support for uploading media files so that you can refer to images and videos in page content.  Junco is "headless" -- it is a repository for editing and storing your content.  In order to display content to end-users, you will most likely retrieve content via Junco's REST API and render it in your own front end.  Stored content is available as raw markdown text, structured markdown AST, or hierarchical rendered HTML.

When content is saved, it is checked into the local git repository, and changes are periodically pushed to the configured origin.  For a high-availability setup, production read-only nodes can pull periodically from origin, and an internal read-write node can be available to creators/editors. 

### Features

- All data and content is stored entirely in a git repository
- Pages in markdown format
- Page metadata support via front matter
- User authentication backends: LDAP, OAuth, local
- REST API for reading content in multiple formats
- Browse revision history and restore from pervious versions
- Very few moving parts so it is hard to break

### Getting started

Configure a git repo where youre content will live:

```bash
mkdir /var/tmp/content
git -C /var/tmp/content init
git -C /var/tmp/content remote add origin ...
```

Specify the path to your repo in `config/default.json`:

```
  ...
  "remote": "origin",
  "repository": "/var/tmp/content",
  ...
```

Install dependencies:
```bash
npm install
```

Start the application:
```bash
npm start
```

The default configuration is to allow for local logins with admin/admin as the credentials.  You should obviously change this in production settings.  Local passwords are SHA1, so you can generate them in config with `echo -n 'secret-password' | sha1sum` if you like.

## REST API

Junco exposes a basic API for listing and retrieving content.


#### GET /api/pages

List all pages, optionally filtered with a prefix-match.

```bash
$ curl localhost/api/pages?prefix=my-namespace:

{
  "pages":[
    {
      "source": "Hello, World!",
      "metadata":{
        "name":"my-namespace:my-page",
        "hash":"e965aaf",
        "author":"admin",
        "date":"Sun, 24 Oct 2021 15:27:03 -0400",
        "relDate":"10m ago",i
        "timestamp":"1635103623"
      },
      "attributes":{}
    }
  ]
}
```

#### GET /api/pages/:page

Get the contents of a page.  Content is cached in memory for two minutes, so responses may be slightly stale.

```bash
$ curl localhost/api/pages/my-page

{
  "page": {
    "tokens": [
      {"type":"heading","depth":1,"text":"Title"},
      {"type":"paragraph","text":"Introductory paragraph text"},
      {"type":"heading","depth":2,"text":"Heading"},
      {"type":"paragraph","text":"Descriptive paragraph text"}
    ],
    "content": "
      <section data-level=1 id=\"title\">
        <h1>Title</h1>
        <p>Introductory paragraph text</p>
        <section data-level=2 id=\"heading\">
          <h2>Heading</h2>
          <p>Descriptive paragraph text</p>
        </section>
      </section>
    ",
    "source": "
      # Title

      Introductory paragraph text

      ## Heading

      Descriptive paragraph text
    ",
    "metadata":{
      "name": "my-page",
      "hash":"8bf901e",
      "author":"admin",
      "date":"Sun, 24 Oct 2021 15:47:47 -0400",
      "relDate":"now",
      "timestamp":"1635104867",
    }
    "attributes": {
      template: "landing-page"
    }
  }
}
```

