# Kickoff prompt — paste into a NEW Claude Code session

Start the session on repo `haid-er/agentic-portfolio`, branch `claude/gifted-pasteur-ue5xl2`, in the same environment as the planning session (the one with your keys). Then paste everything below the line.

---

Build my portfolio in this repo unattended. I'm not watching, so don't wait for replies. Make sensible decisions yourself and record them in the final report.

Permissions I grant:
- Run the multi-agent Workflow at whatever scale you judge best.
- Create and merge PRs on my GitHub.
- Use as many tokens as needed, but don't waste them.
- Deploy to Vercel.
- Use any free APIs.
- Read my whole GitHub with the read token.
- Search the web for facts about me.

Read first:
- `docs/BRIEF.md` (binding policy)
- `docs/context/` (facts about me; `research-findings.md` wins on conflicts)
- `.claude/workflows/build-portfolio.js` (the orchestrator)

Steps:

0. **Check env vars** without printing values: GROQ_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, ADMIN_PASSWORD (map it if the name differs), VERCEL_TOKEN, GITHUB_FINE_GRAIN_PERMISSION_TOKEN, GITHUB_FULL_ACCOUNT_READ_PERMISSION_TOKEN_FOR_INFORMATION. Note any that are missing and continue.

1. **Research top-up** (at most 30 minutes, one subagent).
   - Use the read token to skim my private repos for skills and experience only. Never publish their code, names or links.
   - Check my public LinkedIn (https://www.linkedin.com/in/haid-er/) if it's reachable.
   - Append new facts, with sources, to `docs/context/research-findings.md`. Commit and push.

2. **Checkpoint pushes.** Schedule a check-in every ~60 minutes with `send_later`. On each one, commit and push a "wip: checkpoint" if there are changes, then re-arm. Cancel the check-ins once the workflow finishes.

3. **Run the build.** Run the Workflow tool with scriptPath `.claude/workflows/build-portfolio.js` and args `{"deploy": true}`. If it fails partway, fix the cause and resume with `resumeFromRunId`.

4. **Finish it off.** Review the result and fix anything still red. Run `npm run typecheck`, `lint`, `build` and the e2e suite, then commit and push.

5. **PR.** Open a PR from `claude/gifted-pasteur-ue5xl2` into `main`. Describe what was built, the design choice, the demo catalog, QA results and known gaps. Drive CI to green, then merge. If permissions block the merge, leave the PR green and say so.

6. **Check production** at https://malik-haider-portfolio.vercel.app (Vercel project "agentic-portfolio", production branch `main`).
   - Smoke-test at 360px and 1280px, one AI demo, and the admin login page.
   - Never touch the old malikhaider.vercel.app project or domain.

7. **Final report**, concise:
   - live URL and admin login steps
   - the two theme names
   - the demo list
   - what's hidden pending verification
   - known gaps
   - DeepSeek tokens used (hard cap 1M in / 1M out; aim for near zero)
