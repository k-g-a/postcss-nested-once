const postcssNested = require("postcss-nested");

module.exports = (opts = {}) => {
  const instance = postcssNested(opts);

  return {
    postcssPlugin: "postcss-nested-once",
    Once(root, postcssAPI) {
      root.walkRules((rule) => {
        instance.Rule(rule, postcssAPI);
      });
    },
  };
};

module.exports.postcss = true;
