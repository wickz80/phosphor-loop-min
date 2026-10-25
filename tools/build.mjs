import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import prettier from 'prettier';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = path.join(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, '\n')
  );
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (name) => name,
      getNewLine: () => '\n',
    })
  );
  process.exitCode = 1;
} else {
  const outputs = [];
  program.emit(undefined, (filename, content, _bom, _errors, sources) => {
    const source = path
      .relative(root, sources[0].fileName)
      .split(path.sep)
      .join('/');
    const header = `// Generated from ${source} by npm run build. Do not edit directly.\n`;
    outputs.push({
      filename,
      content: prettier.format(header + content, {
        parser: 'babel',
        singleQuote: true,
      }),
    });
  });
  let stale = false;
  for (const output of outputs) {
    if (process.argv.includes('--check')) {
      const current = await fs
        .readFile(output.filename, 'utf8')
        .catch(() => '');
      if (current !== output.content) {
        console.error(
          `Stale generated file: ${path.relative(
            root,
            output.filename
          )}. Run npm run build.`
        );
        stale = true;
      }
    } else {
      await fs.mkdir(path.dirname(output.filename), { recursive: true });
      await fs.writeFile(output.filename, output.content);
    }
  }
  if (stale) process.exitCode = 1;
  else
    console.log(
      `${process.argv.includes('--check') ? 'Verified' : 'Built'} ${
        outputs.length
      } TypeScript modules.`
    );
}
