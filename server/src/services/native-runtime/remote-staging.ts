import type { CommandManagedRuntimeRunner } from "@paperclipai/adapter-utils/command-managed-runtime";

// Keep each base64 stdin within the command transport's 4 MiB bound.
const CHUNK_BYTES = 3 * 1024 * 1024;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** Feed a staging script base64 input without requiring one unbounded exec RPC. */
export async function executeRemoteStagingScript(input: {
  runner: CommandManagedRuntimeRunner;
  bytes: Buffer;
  script: string;
  directory: string;
  failureMessage: string;
}): Promise<void> {
  const execute = async (script: string, stdin?: string) => {
    const result = await input.runner.execute({
      command: "sh", args: ["-c", script], stdin, bypassSession: true,
    });
    if (result.exitCode !== 0 || result.timedOut) throw new Error(input.failureMessage);
    return result;
  };
  if (input.bytes.length <= CHUNK_BYTES) {
    await execute(input.script, input.bytes.toString("base64"));
    return;
  }

  // A private directory prevents partial uploads from being consumed or shared
  // with concurrent staging. The destination is touched only after every chunk
  // succeeds. Preserve the original decoder/extractor and its integrity checks.
  const template = `${input.directory}/.paperclip-stage-XXXXXXXXXX`;
  const created = await execute(
    `umask 077; mkdir -p ${quote(input.directory)} && mktemp -d ${quote(template)}`,
  );
  const staging = created.stdout.trim();
  if (!staging.startsWith(`${input.directory}/.paperclip-stage-`) ||
      !/^[A-Za-z0-9]+$/.test(staging.slice(`${input.directory}/.paperclip-stage-`.length))) {
    throw new Error(input.failureMessage);
  }
  const payload = quote(`${staging}/payload`);
  try {
    for (let offset = 0; offset < input.bytes.length; offset += CHUNK_BYTES) {
      await execute(
        `umask 077; base64 -d >> ${payload}`,
        input.bytes.subarray(offset, offset + CHUNK_BYTES).toString("base64"),
      );
    }
    await execute(`base64 < ${payload} | sh -c ${quote(input.script)}`);
  } finally {
    // Cleanup cannot mask the transfer failure. Lease cleanup still owns any
    // scratch state left when the provider is no longer reachable.
    await execute(`rm -rf -- ${quote(staging)}`).catch(() => undefined);
  }
}
