# PostCSS Nested for rollup-plugin-styles

### Summary

This plugin allows using Sass-like nested rules in combination with [css-modules](https://github.com/css-modules/css-modules) by [rollup-plugin-styles](https://github.com/Anidetrix/rollup-plugin-styles).

Specifically, it solves the problem of the ampersand-combined selectors, i.e.:

```postcss
// styles.css
.list {
  color: red;

  &_item {
    color: green;
  }
}
```

Results in:

```javascript
// some-module.js
import styles from "./styles.css";

// with any setup:
console.log(styles.list); // => "styles_list__HASH"

// with postcss-nested plugin:
console.log(styles.list_item); // => undefined ,

// with postcss-nested-once plugin:
console.log(styles.list_item); // => "styles_list_item__HASH"
```

### Usage

Install:

```shell
yarn add postcss-nested-once -D
```

It's intended to replace [postcss-nested](https://github.com/postcss/postcss-nested) for the following [rollup](https://github.com/rollup/rollup) configuration:

```javascript
// rollup.config.js

// ...
const stylesRollupPlugin = require("rollup-plugin-styles");
const postcssNestedOncePlugin = require("postcss-nested-once");

module.exports = {
  // ...
  plugins: [
    // ...
    stylesRollupPlugin({
      // ...
      mode: "inject",
      modules: true,
      plugins: [
        // ...
        postcssNestedOnce(),
      ],
    }),
  ],
};
```

Assuming the following source:

```postcss
// styles.css
.parent {
  color: red;

  & .child {
    color: green;
  }
}

.list {
  color: red;

  &_item {
    color: green;
  }
}
```

This will produce:

```javascript
// styles.js
// ...
var css =
  ".styles_parent__HASH {" +
  "  color: red" +
  "}" +
  "" +
  "  .styles_parent__HASH .styles_child__HASH {" +
  "    color: green;" +
  "  }" +
  "" +
  ".styles_list__HASH {" +
  "  color: red" +
  "}" +
  "" +
  ".styles_list_item__HASH {" +
  "    color: green;" +
  "  }" +
  "";
var modules = {
  parent: "styles_parent__HASH",
  child: "styles_child__HASH",
  list: "styles_list__HASH",
  list_item: "styles_list_item__HASH",
};
injectCss["default"](css, {});

exports.css = css;
exports.default = modules;
```

Which in turn allows to use all the four classes in js:

```javascript
// some-module.js
import styles from "./styles.css";

console.log(styles.parent); // => "styles_parent__HASH"
console.log(styles.child); // => "styles_child__HASH"
console.log(styles.list); // => "styles_list__HASH"
console.log(styles.list_item); // => "styles_list_item__HASH"
```

### Problem Details

The [rollup-plugin-styles](https://github.com/Anidetrix/rollup-plugin-styles) provides an ability to use css modules by simply specifying `modules: true | ModulesOptions` during configuration.

Under the hood it does not rely on the [postcss-modules](https://github.com/madyankin/postcss-modules) package directly, but introduces its own plugins pipeline instead:

```
// built-in plugins
styles-import - internal plugin, uses 'Once' hook, used only if the 'import' option is enabled;
styles-url - internal plugin, uses 'Once' hook, used only if the 'url' option is enabled;

// bunch of plugins from options.plugins
postcss-nested - could be listed here, if specified
plugin-from-options #1
plugin-from-options #2
...

// bunch of plugins from postcss.config.js
postcss-nested - or here, if specified
plugin-from-postcss-config #1
plugin-from-postcss-config #2
...

// css-modules-related plugins
postcss-modules-values - dependency plugin, uses 'Once' hook
postcss-modules-local-by-default - dependency plugin, uses 'Once' hook
postcss-modules-extract-imports - dependency plugin, uses 'Once' hook
postcss-modules-scope - dependency plugin, uses 'Once' hook
styles-icss - internal plugin involved in resulting exports generation, uses 'OnceExit' hook
```

By that far it seems like everything should work as expected due to proper plugin's order.

So to make the next guess it's good to know the responsibility of every plugin. To cut the long story short:

- `postcss-modules-values` extracts `@value XX` and `@value YY from` into corresponding internal `:import {}` / `:export {}` selectors and gives local names;
- `postcss-modules-local-by-default` wraps every suitable css selector in internal `:local` directive;
- `postcss-modules-extract-imports` is responsible for the `compose` feature;
- `postcss-modules-scope` among other actions generates `:export {}` directives for every `:local` selector;
- `styles-icss` fills special object from the contents of every `:export {}` directive.

The object formed by `styles-icss` is used further down the pipeline to write exports from the generated `styles.js` file (which are consumed by `import styles from './styles.css''`).

As a result, for the above input we'll get the following output:

```javascript
// styles.js (generated)
var css =
  ".styles_parent__HASH {" +
  "  color: red" +
  "}" +
  "" +
  "  .styles_parent__HASH .styles_child__HASH {" +
  "    color: green;" +
  "  }" +
  "" +
  ".styles_list__HASH {" +
  "  color: red" +
  "}" +
  "" +
  ".styles_list__HASH_item {" +
  "    color: green;" +
  "  }" +
  "";
var modules = {
  parent: "styles_parent__HASH",
  child: "styles_child__HASH",
  list: "styles_list__HASH",
};
injectCss["default"](css, {});

exports.css = css;
exports.default = modules;
```

So we have an actual rule `.styles_list__HASH_item` (which will be injected during the import), but do not have the corresponding export (making `styles.list_item === undefined` at runtime).

The key hint is that `_item` suffix is added after the `__HASH` part, which means that `postcss-nested` transformation runs after the `postcss-modules-scope` transformation. This happens because `postcss-nested` plugin uses `Rule` hook while other ones (mostly) use `Once` + `walk()` combination which comes first.

So the most simple solution is to move `postcss-nested`'s logic to the same `Once` hook, which resulted in `postcss-nested-once` plugin.

### Implementation

For the sake of simple maintenance this plugin lists `postcss-nested` as dependency and reuses it by calling `root.walkRules((rule) => { postcssNestedInstance.Rule(rule, postcssAPI); });` in `Once` hook.

It accepts (and passes down) the same options as `postcss-nested`.

Type definitions are copy-pasted from the original plugin.
