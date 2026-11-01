#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { Lab } from "./engine.mjs";
import { cases } from "./cases.mjs";
const [command, path, output = "output/cli"] = process.argv.slice(2);
if (!["cases", "run"].includes(command)) {
  console.log(
    'TimeTrap\n  node src/cli.mjs cases [output.json]\n  node src/cli.mjs run scenario.json [output-directory]\n\nScenario: { url, instant, zones, actions: [{type:"expect",selector:"#count",value:"60"}] }',
  );
  process.exit(command ? 1 : 0);
}
const lab = new Lab(output);
try {
  if (command === "cases") {
    const result = [];
    for (const c of cases) result.push(await lab.runCase(c.id));
    const file = path || "output/cases.json";
    await mkdir(new URL("../output/", import.meta.url), { recursive: true });
    await writeFile(file, JSON.stringify(result, null, 2));
    for (const r of result)
      console.log(
        r.title +
          ": " +
          r.results.filter((x) => !x.pass).length +
          " reproduced / " +
          r.results.filter((x) => x.pass).length +
          " controls passed",
      );
    console.log(file);
  } else {
    const config = JSON.parse(await readFile(path, "utf8"));
    await lab.start(config);
    for (const action of config.actions ?? []) await lab.act(action);
    const report = await lab.exportReport();
    const checks = report.actions.flatMap((a) => a.checks ?? []);
    console.log(
      `${output}/report.zip · ${checks.length} checks · ${checks.filter((c) => !c.pass).length} failures`,
    );
    if (checks.some((c) => !c.pass)) process.exitCode = 1;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await lab.close();
}
