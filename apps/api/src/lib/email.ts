/**
 * Pluggable email sender. Uses Resend when RESEND_API_KEY is set; otherwise
 * falls back to console.log (useful for local dev / smoke tests).
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const FROM = process.env.EMAIL_FROM ?? "LATAM-MCP <hello@latam-mcp.com>";

export async function sendEmail(mail: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:stub] to=${mail.to} subject=${JSON.stringify(mail.subject)}`);
    console.log(mail.text);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html ?? textToHtml(mail.text),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

function textToHtml(text: string): string {
  return `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.5">${escapeHtml(text)}</pre>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function welcomeEmail(params: { email: string; key: string; plan: string }): Mail {
  return {
    to: params.email,
    subject: `Your LATAM-MCP API key (${params.plan})`,
    text: `Welcome to LATAM-MCP.

Your API key: ${params.key}

Quick start:

  curl https://api.latam-mcp.com/pe/ruc/20100017491 \\
    -H "authorization: Bearer ${params.key}"

MCP (Claude Desktop):

  {
    "mcpServers": {
      "latam-mcp": {
        "command": "npx",
        "args": ["-y", "@latam-mcp/mcp"],
        "env": { "LATAM_MCP_API_KEY": "${params.key}" }
      }
    }
  }

Docs:  https://latam-mcp.com/llms.txt
OpenAPI:  https://latam-mcp.com/openapi.json
Compliance:  https://latam-mcp.com/compliance.html

Questions? Reply to this email.

— LATAM-MCP
`,
  };
}
