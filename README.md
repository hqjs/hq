# hqjs.org

## The only tool you need for frontend development
### It removes the pain and simplifies routines which requires modern web application development. No need to know all the buzzwords or learn all that tools for all the frameworks, just one command and you are ready to code. The fastest start for a new project.

# Key benefits

* Nothing to learn
* Zero configuration
* Painless debugging
* Fast and coviniet

Supports all kind of frameworks:

* Polymer
* Vue
* React
* Angular (WIP)

and many others.

Supports `.js`, `.jsx`, `.mjs`, `.ts`, `.coffee`, `.json`, `.css`, `.scss`, `.scss`, `.less`, `.html` formats and more to come.

Does not bundle.

# Why is it better then gulp, browserify, webpack e.t.c.?

* `It is very simple to use`. You install it once globally and that's it. Every time you create a new project you just start coding, no need to install or configure anything.

* `It makes debugging really easy and smooth`. You can forget about painfull debugging with missing sourcemaps and obfuscated bundles. No more situations when you can't put a breakpoint on the line or expression that you are interested in, no more ugly webpack names behind the code, no more empty debugging tooltips.

* `It is fast`. As it does not bundle anything - it only ships files that were changed, that is really critical for big projects.

* `It allows you to track loading progress with your browser development tool`, as tere is no bundling time.

* `It encorouges you to use standards`, but supports all kinds of existing code styles.

* `It allows you experiment quickly`. Just one command and you are good to go.

# Installation
```bash
npm install -g @hqjs/hq
```

# Usage
Run inside project root
```bash
hq
```

or add to `package.json`
```json
"scripts": {
  "start": "hq"
},
```

### NOTE: Do not forget to add main script and style to your `index.html`

# Is it good for production?

Not yet. But it is really good for development. Production solution is currently WIP and it is going to reduce all that pain that modern web application deployment usually demands.

# More benefits with .babelrc
With `hq` you don't need to take care of babel configuration, the `latest ecma script standard` (including `class properties` and `decorators`) will be `supported out of the box`. However if you need to support some experimental features e.g. optional-chaining, just add `.babelrc` configuration to the root of your project with the list of all desired plugins
```json
{
  "plugins": [
    "@babel/plugin-proposal-optional-chaining"
  ]
}
```
