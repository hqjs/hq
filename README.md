# 💫 One tool to rule them all
<p align="center">
  <a href="https://hqjs.org/" target="_blank">
    <img alt="hqjs" src="./hqjs-logo.png" width="749">
  </a>
</p>

# Features

* 🎓 You already know it - it is just a static server that delivers your application code files
* 🏂 Zero configuration - one command and you are good to go
* 🏋️ Supports all kinds of frameworks: Polymer, Vue, React, Angular and many others out of the box
* 😎 Understands all popular formats `.js`, `.jsx`, `.mjs`, `.ts`, `.coffee`, `.json`, `.css`, `.scss`, `.sass`, `.less`, `.html` and `.pug`
* 🎁️ Delivers without bundling - that reflects project structure in the browser and makes it easier to understand and develop
* 🦋 Makes debugging a pleasure - no more missing sourcemaps and obfuscated bundles, situations when you can't put a breakpoint on the line or expression, ugly webpack names behind the code and empty debugging tooltips
* 🕸 Relies on the latest web standards - so you can use cutting edge features even if you browser miss them
* ⚡ Light and fast - it ships minimum that is required with no bundlers overhead, only changed files are delivered

# Installation

Install it once with npm
```bash
npm install -g @hqjs/hq
```

# Usage
Run inside project root
```bash
hq
```

# Why is it better then existing tools?

There are many development tools out there, including `browserify`, `webpack`, `rollup` and `parcel`, that provide development servers. But all of them rely on bundling. While bundling might still be usefull for production, it makes development experience quite hard.

Without bundling `hq` dramatically increase development speed by shipping only files that were changed and improve debugging by providing minimal transformation to a source.

With `hq` you can start new project instantly. Just type `hq` and you are ready for experiments. It supports all kinds of frameworks out of the box, so there is no need to learn all their different tools and know all the buzzwords.

It is worth to say that `hq` requires no configuration, providing familiar experience of working with regular static server.

# How it works

`hq` serves every file individually as requested, same way regular static server does. That gives you only very simple dead code elimination without proper tree shaking, but on the other hand a lot of time that was wasted for dependency analysis is being saved, all transforamtions are instant and performed on the fly. If you use modern browser and stick to a standard your code would hardly be changed at all.

When you can try to follow the standards, you can't guarantee that all that llibraries that you are depending on will do the same. most of them will probably use commonjs modules format and won't just work in the browser as they are. `hq` takes care of that as well and transforms commonjs modules into ESM, handles non standard, but pretty common imports (like css or json importing) and destructure importing objects when it is required.

`hq` will work tightly with the browser, using its cache system to speed up assets delivery and only delivers what was changed. It will automatically reload the page when you modify the code so you will see the feedback immediatly.

It can work with many different frameworks, but does not rely on any of that frameworks code in particular. Instead `hq` performs ast transformations with `babel` through plugins that were designed for `hq` to help it understands all diversity of different technologies and technics used in those frameworks.

# Examples

Let's say we have existing angular project and whant to improve development experience with `hq`.

First of all we need to add our global style file and script to the head and body of `index.html` correspondingly. So when `hq` serves index, it will serve styles and scripts as well
```html
<!doctype html>
<html lang="en">
<head>
  ...
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <app-root></app-root>
  <script src="/main.ts"></script>
</body>
</html>
```

Second is very angular specific problem - it depends on `zones` and `Reflect.metadata` APIs that are on very early stages and does not supported by `hq` out of the box. In fact angular includes them in file `polyfills.ts` and adds it to your build. So we are going to use this file and import it on top of `main.ts`
```js
import './polyfills.ts';
...
```

And that's it, now you are ready to start development by running
```sh
hq
```
in the project root.

# Is it good for production?

It might help to serve small projects with very little dependencies. But general answer is no, not yet. However it is really good for development. Production solution is currently WIP and it is going to reduce all the pain that modern web application building and deployment usually demands.

# More benefits with .babelrc

With `hq` you don't need to take care of babel configuration, the **latest ecma script standard** (including **class properties** and **decorators**) will be **supported out of the box**. However if you need to support a feature that does not have common interpretation like svg react imports or experimental features from low stage like optional chaining, just add `.babelrc` configuration to the root of your project with the list of all desired plugins
```json
{
  "plugins": [
    "@babel/plugin-proposal-optional-chaining"
  ]
}
```
and it will be automatically merged with `hq` configuration.

# License

[MIT](LICENSE)
