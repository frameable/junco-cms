class Browser {
  cookies = {}
  constructor(origin) {
    this.origin = origin.replace(/\/$/, '');
  }
  async _request(method, path, options={}) {
    options = {
      ...options,
      method,
      redirect: 'manual',
      headers: {
        ...options.headers,
        cookie: Object.entries(this.cookies)
          .map(c => c.join('=')).join('; ')
      }
    };
    const response = await fetch(this.origin + path, options);
    for (const s of response.headers.getSetCookie()) {
      const [name, value] = s.split('; ')[0].split(/=(.*)/, 2);
      this.cookies[name] = value
    }
    if (process.env.DEBUG) {
      //console.log("STATUS", response.status);
      //console.log("HEADERS", response.headers);
    }
    return response
  }
  get(path) {
    return this._request('GET', path)
  }
  post(path, data={}) {
    const contentType = 'application/x-www-form-urlencoded';
    const body = Object.entries(data)
      .map(c => c.join('=')).join('&')
    return this._request('POST', path, {
      body,
      headers: { 'Content-Type': contentType }
    });
  }
}

module.exports = Browser
