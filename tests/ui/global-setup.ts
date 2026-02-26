import { execFileSync } from "node:child_process";

function runNodeScript(scriptPath: string) {
  execFileSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });
}

export default async function globalSetup() {
  runNodeScript("tools/eco-create-test-users.mjs");
}
