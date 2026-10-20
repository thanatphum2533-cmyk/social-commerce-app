const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    filelist = fs.statSync(path.join(dir, file)).isDirectory()
      ? walkSync(path.join(dir, file), filelist)
      : filelist.concat(path.join(dir, file));
  });
  return filelist;
};

const files = walkSync('src/app/api').filter(f => f.endsWith('.ts'));

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/process\.cwd\(\),\s*'data',\s*'\.json'/g, "process.cwd(), 'data', '" + path.basename(path.dirname(f)) + ".json'");
  c = c.replace(/process\.cwd\(\),\s*'([a-z_]+)\.json'/g, "process.cwd(), 'data', '$1.json'");
  fs.writeFileSync(f, c);
});
console.log("Done");
