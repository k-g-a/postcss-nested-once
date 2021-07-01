const fs = require('fs');
const path = require('path');
const potcss = require('postcss');
const nestedOnce = require('../index');
const modulesValues = require('postcss-modules-values');
const localByDefault = require('postcss-modules-local-by-default');
const extractImports = require('postcss-modules-extract-imports');
const modulesScope = require('postcss-modules-scope');


const FROM = path.join(__dirname, 'test.pcss');
const TO = path.join(__dirname, 'test-postcss.css');
const contents = fs.readFileSync(FROM);


potcss([
  nestedOnce({ preserveEmpty: true }),
  modulesValues({}),
  localByDefault({ mode: 'local' }),
  extractImports(),
  modulesScope({
    generateScopedName: (local, file, css) => {
      const { dir, name, base } = path.parse(file);
      return `${name}_${local}_HASH`;
    },
  }),
])
  .process(contents, { from: FROM, to: TO })
  .then((result) => {
    fs.writeFileSync(TO, result.css);
    if (result.map) {
      fs.writeFileSync(`${TO}.map`, result.map.toString());
    }
  });
