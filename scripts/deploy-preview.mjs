import { spawn } from "node:child_process";

function readFlag(argv, name) {
  const eq = `--${name}=`;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === `--${name}`) return argv[i + 1];
    if (a.startsWith(eq)) return a.slice(eq.length);
  }

  return undefined;
}

function usage(message) {
  if (message) console.error(`\n${message}\n`);

  console.error(`Usage:\n  npm run deploy:preview -- --project=sitegen-96189 --channel=client-foo-r1\n\nNotes:\n- This repo is intentionally unbound (no .firebaserc), so --project is required.\n- The wrapper also reads npm_config_project and npm_config_channel as a fallback.`);
}

const argv = process.argv.slice(2);

const project =
  readFlag(argv, "project") ??
  process.env.npm_config_project ??
  process.env.FIREBASE_PROJECT;

const channel =
  readFlag(argv, "channel") ??
  process.env.npm_config_channel ??
  process.env.FIREBASE_CHANNEL;

if (!project || !channel) {
  usage(
    `Missing required ${!project && !channel ? "--project and --channel" : !project ? "--project" : "--channel"}.`
  );
  process.exit(2);
}

const child = spawn(
  "firebase",
  ["hosting:channel:deploy", channel, "--project", project],
  {
    stdio: "inherit",
    shell: process.platform === "win32" // lets Windows resolve firebase.cmd
  }
);

child.on("error", (err) => {
  usage(`Failed to start Firebase CLI. Make sure 'firebase' is installed and available on PATH.\n${err.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
