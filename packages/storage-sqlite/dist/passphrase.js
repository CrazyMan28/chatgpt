import { createInterface } from "node:readline/promises";
export async function resolveVaultPassphrase(env = process.env, input = process.stdin, output = process.stderr) {
    const envPassphrase = env.CHATGPT_CODE_VAULT_PASSPHRASE?.trim();
    if (envPassphrase) {
        return envPassphrase;
    }
    if (!input.isTTY || !output.isTTY) {
        return "chatgpt-code-dev-passphrase";
    }
    const readline = createInterface({
        input,
        output
    });
    try {
        const answer = (await readline.question("Vault passphrase: ")).trim();
        return answer.length > 0 ? answer : "chatgpt-code-dev-passphrase";
    }
    finally {
        readline.close();
    }
}
//# sourceMappingURL=passphrase.js.map