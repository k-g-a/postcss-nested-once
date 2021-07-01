const fs = require("fs");
const path = require("path");
const { test, expect } = require("@jest/globals");
const postcss = require("postcss");
const nestedOnce = require("../index");
const localByDefault = require("postcss-modules-local-by-default");
const modulesScope = require("postcss-modules-scope");

test("Generates proper output for icss-utils", async () => {
  const from = path.join(__dirname, "__data__", "test.pcss");
  const contents = fs.readFileSync(from);

  const postcssInstance = postcss([
    nestedOnce({ preserveEmpty: true }),
    localByDefault({ mode: "local" }),
    modulesScope({
      generateScopedName: (local, file) => {
        const name = path.basename(file, ".pcss");
        return `${name}_${local}_HASH`;
      },
    }),
  ]);

  const result = await postcssInstance.process(contents, { from: from });

  expect(result.css).toMatchSnapshot("test-icss-compatible-output");
});
