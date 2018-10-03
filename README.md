# hqjs.org

## The only tool you need for frontend development

* Zero configuration
* Painless debugging
* Fast and coviniet
* Respect standarts

Supports all kind of frameworks:
* Polymer
* Vue
* React
* Angular (WIP)

and many others.

Supports `.js`, `.jsx`, `.mjs`, `.ts`, `.coffee`, `.json`, `.css`, `.html` formats and more to come.

### NOTE: Do not forget to add main script and style to your `index.html`

# Installation
```bash
npm install -g @hqjs/hq
```

# Usage
Run inside project folder
```bash
hq
```

or add to `package.json`
```json
"scripts": {
  "start": "hq"
},
```

# Certificate
Server is built with HTTP 2 / HTTPS so it requers to have trusted ssl cerificate. Put your trusted certificate and private key named `localhost.crt` and `device.key` into your project root floder.

### NOTE: If you don't put your own certificates into project root - default certificate will be used, so you will have to accept unsafe connection and advanced caching will not work.

You can create your own self signed certificate using `generate_root_ca.sh` and `create_certificate_for_domain.sh` scripts from `cert` folder of the package or the way that you used to.

Do not forget to add your own certificates to keychain.

### WARNING: Do not add default certificate that goes with this package into keychain.

# Livereload
Install livereload plugin for your browser to get benefits from live reloading:
* [Chrome](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei?hl=en)
* [Firefox](https://addons.mozilla.org/en-US/firefox/addon/livereload-web-extension/?src=search)
* [Safari](http://download.livereload.com/2.1.0/LiveReload-2.1.0.safariextz)

# Extending with .babelrc
With `hq` you don't need to take care of babel configuration, the latest ecma script standard (including class properties and decorators) will be supported out of the box. However if you need to support some experimental features e.g. optional-chaining, just add `.babelrc` configuration to the root of your project with the list of all desired plugins
```json
{
  "plugins": [
    "@babel/plugin-proposal-optional-chaining"
  ]
}
```
