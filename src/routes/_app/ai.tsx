import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import { getAuthMode } from "@/lib/auth-mode";
import { captureClientEvent } from "@/client/lib/posthog";
import { getAgentSetupPrompt } from "@/client/features/ai-mcp/agentSetupPrompt";
import { CopyButton } from "@/client/features/ai-mcp/SetupControls";
import {
  ClaudeIcon,
  GrokIcon,
  HermesIcon,
  OpenAIIcon,
  OpenClawIcon,
} from "@/client/features/ai-mcp/AgentIcons";

const DOCS_URL = "https://openseo.so/docs/mcp";
const COACH_DOCS_URL = "https://openseo.so/docs/skills/seo-coach";
const SKILLS = [
  ["seo-coach", "Explains where you stand and picks your next step."],
  [
    "seo-project-setup",
    "Saves your goals, competitors, and key pages as shared context.",
  ],
  [
    "seo-audit",
    "One-page site audit built around a single do-this-week action.",
  ],
  ["keyword-research", "Finds keyword opportunities from a few seed topics."],
  ["keyword-clustering", "Groups keywords by intent and maps them to pages."],
  ["competitive-landscape", "Maps who wins in your market and why."],
  [
    "competitor-analysis",
    "Studies one competitor's keywords, content, and backlinks.",
  ],
  ["link-prospecting", "Finds link prospects and drafts outreach."],
  ["local-seo", "Audits a Google Business Profile and Maps visibility."],
  ["seo-report", "Saves any of the above as a report on your Reports page."],
];
const AGENTS = [
  { name: "Claude Code", Icon: ClaudeIcon },
  { name: "ChatGPT", Icon: OpenAIIcon },
  { name: "Grok Bot", Icon: GrokIcon },
  { name: "Hermes", Icon: HermesIcon },
  { name: "OpenClaw", Icon: OpenClawIcon },
];

export const Route = createFileRoute("/_app/ai")({
  component: AiPage,
});

function AiPage() {
  const origin =
    typeof window === "undefined"
      ? "https://app.openseo.so"
      : window.location.origin;
  const mcpUrl = `${origin}/mcp`;
  const prompt = getAgentSetupPrompt(origin);
  const [tab, setTab] = useState<"setup" | "skills">("setup");

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-12 md:px-6 md:py-16 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Use OpenSEO from your agent
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-base-content/70">
          The most powerful way to use OpenSEO is through the AI agent you
          already use. Set it up once, then ask it anything.
        </p>

        <div role="tablist" className="tabs tabs-border mt-8 w-fit">
          {(
            [
              ["setup", "Set up your agent"],
              ["skills", "Skills"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tab ${tab === id ? "tab-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "setup" ? (
          <>
            <section className="mt-6 rounded-xl border border-base-300 p-5 sm:p-6">
              <ol className="space-y-6">
                <li className="flex gap-4">
                  <StepNumber n={1} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Paste the setup prompt into your agent
                    </p>
                    <p className="mt-1 text-sm text-base-content/60">
                      It configures the MCP connection and installs the SEO
                      skills for you.
                    </p>
                    <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {AGENTS.map(({ name, Icon }) => (
                        <li
                          key={name}
                          className="flex items-center gap-1.5 text-xs text-base-content/60"
                        >
                          <Icon className="size-4" />
                          {name}
                        </li>
                      ))}
                      <li className="text-xs text-base-content/45">
                        or any MCP client
                      </li>
                    </ul>
                    <div className="mt-4 [&>button]:h-11 [&>button]:gap-2 [&>button]:text-sm">
                      <CopyButton
                        primary
                        value={prompt}
                        label="Copy setup prompt"
                        successMessage="Setup prompt copied"
                        onCopy={() =>
                          captureClientEvent("mcp:setup_prompt_copy")
                        }
                      />
                    </div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <StepNumber n={2} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Ask it to run{" "}
                      <a
                        href={COACH_DOCS_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[13px] underline decoration-base-content/25 underline-offset-4 hover:decoration-base-content"
                      >
                        /seo-coach
                      </a>
                    </p>
                    <p className="mt-1 text-sm text-base-content/60">
                      The coach explains where you stand and picks your next
                      step. Don&apos;t overthink it. Ask questions.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <p className="mt-5 text-sm text-base-content/60">
              Prefer to set it up yourself?{" "}
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="link link-primary inline-flex items-center gap-0.5"
              >
                Read the docs
                <ArrowUpRight className="size-3.5" />
              </a>{" "}
              for per-agent guides and the full tool list.
            </p>

            {getAuthMode(import.meta.env.AUTH_MODE) === "cloudflare_access" ? (
              <div className="alert alert-warning mt-8 text-sm" role="alert">
                <ShieldAlert className="size-4 shrink-0" />
                <span>
                  This instance is behind Cloudflare Access. MCP clients cannot
                  connect until Managed OAuth is enabled on your Access
                  application.{" "}
                  <a
                    href="https://openseo.so/docs/self-hosting/cloudflare#connect-the-mcp-server-through-cloudflare-access"
                    target="_blank"
                    rel="noreferrer"
                    className="link font-medium"
                  >
                    Setup guide
                  </a>
                </span>
              </div>
            ) : null}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-base-300 pt-5 text-xs text-base-content/55">
              <span>
                MCP server URL for this instance:{" "}
                <code className="font-mono text-base-content/80">{mcpUrl}</code>
              </span>
              <CopyButton
                value={mcpUrl}
                successMessage="MCP URL copied"
                onCopy={() => captureClientEvent("mcp:setup_url_copy")}
              />
            </div>
          </>
        ) : (
          <section className="mt-6">
            <p className="text-sm text-base-content/60">
              The setup prompt installs these. Run one by name when you want a
              full report instead of a quick answer.
            </p>
            <ul className="mt-5 space-y-3 text-sm sm:space-y-2">
              {SKILLS.map(([name, blurb]) => (
                <li
                  key={name}
                  className="flex flex-col gap-0.5 sm:flex-row sm:gap-3"
                >
                  <a
                    href={`https://openseo.so/docs/skills/${name}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-mono text-[13px] text-base-content underline decoration-base-content/25 underline-offset-4 hover:decoration-base-content sm:w-48"
                  >
                    /{name}
                  </a>
                  <span className="text-base-content/60">{blurb}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-base-200 text-xs font-semibold text-base-content/70">
      {n}
    </span>
  );
}
