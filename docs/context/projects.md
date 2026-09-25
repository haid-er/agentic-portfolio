# Projects

## A. Professional — Euthyna / Terra Instinct 🗒️
| Project | Description | Stack | Status |
|---|---|---|---|
| Euthyna ESG/GHG platform | Surveys, boundary-setting, ownership extraction for ESG reporting | React/Vite, NestJS/Express, PostgreSQL, Drizzle, Zod, CASL, React Query | Active — primary focus |
| Custom CRM | Replaces outreach stack; Lemlist integration | org stack | In build |
| Project Management tool | Internal PM | org stack | In build |
| Finance / CFO tool | Internal finance | org stack | In build |
| Multi-workspace enterprise frontend | CRM, Client Portal, PM, Market Intelligence workspaces | React, Vite, React Query | Active |
| Autonomous coding pipeline | Multi-agent Claude Code setup | Claude Code | Active |
| Agent-hierarchy platform | Hierarchical agent orchestration | Temporal, Claude Agent SDK, MCP, PostgreSQL, Langfuse | Vision/design ⚠️ |

## B. Research ✅
### MotionIQ — HAR data-collection & preprocessing system (repos: `data_fetcher_mobile`, `data_preprocessing_scripts`)
- **Android app** (`datafetcher_mobile` / "motioniq_mobile for MotionIQ"): fetches phone sensor data and streams it over Wi-Fi to a **RabbitMQ** server; user sets server address/port, selects sensors, presses start. Java-based consumer processes queues. README: "Simple and Beautiful App for fetching and send sensor's data to server."
- **Preprocessing pipeline** (Python scripts): 8-step sequence — standardise subject names → standardise activity names → delete last row → structure data → convert to atomic → rename & CSV (raw dataset) → delete unwanted files (final ADL dataset) → fall segmentation (Fall + ADL datasets); fixed 5-second atomic windows (JSON). Plus fixer scripts (sync, event renaming), plotting utilities (multi-user comparison, per-sensor, per-subject), gravity calculation from IMUs, verification tools (sensor-rate counter, hierarchy viewer).
- 26 standard activities incl. bending, walking, sitting_down_from_standing, squatting, open_door, jogging, typing, eat_small_things, talk_using_phone …
- Outcome: this is the data pipeline behind the **HumCareADL** dataset (see publications.md) ⚠️ inferred link — confirm.

## C. Personal / academic — all 19 public GitHub repos ✅
| Repo | Description | Notes |
|---|---|---|
| **structure-fetch-express** | Node/Express API extracting org-chart hierarchies from uploaded images/PDFs as JSON via **Azure OpenAI or Groq**; MongoDB storage; Cloudinary; Winston daily-rotate logging; validation & error handling | Folder structure: controllers/db/middlewares/models/routes/services/utils/validators. Node 18+. CORS for Vite frontend |
| **structure-fetcher** | React/Vite "Company Structure Fetcher": drag-and-drop upload (image/JSON), interactive tree + table views, edit/add/delete entities, save to backend, export JSON | Components: Dropzone, ShowStructure, TableView; `flattenOrgchart.js` |
| structure_fetch_express | Duplicate/early variant of the above | README empty |
| **data_fetcher_mobile** | Android sensor-streaming app for MotionIQ HAR (RabbitMQ) | See B |
| **data_preprocessing_scripts** | Sensor-data preprocessing pipeline | See B |
| **Task-Vault** | "Web app that helps you securely store and manage your daily tasks. Each user has their own account, so your tasks are kept private and safe, protected by your login details." | Auth + per-user tasks |
| **LOGICCOVE** | "Web App for Learning" | details TODO |
| **GreenHeaven-Frontend** / **GreenHeaven-Admin** | React + Vite frontend and admin panel (project purpose TODO — name suggests plants/eco e-commerce ⚠️) | Vite template READMEs |
| **Travel-Journal** | React + Vite app | details TODO |
| **Nexcent-Web** | "A simple page using react just to practice import and export of components and props and deployment over netlify" | learning |
| **SQL-Learning** | "A collection of SQL learning tutorials and LeetCode SQL solutions to enhance database skills." | learning |
| **fb-automation** | README empty — Facebook automation ⚠️ purpose TODO | |
| C-Language | Programming fundamentals in C | coursework |
| Cpp-Language | Fundamentals + OOP in C++ | coursework |
| Cricket-Game-C-Language | Simple cricket game simulation in pure C | coursework |
| Glozzom | HTML/Bootstrap multi-page theme (Traversy course build ⚠️) | learning |
| LoopLAB | HTML/Bootstrap page | learning |
| haid-er | Profile README | — |

Stars/forks: none notable (all ≤1). Dates: TODO (API rate-limited; run `gh repo list haid-er --json name,createdAt,pushedAt`).

## D. Mentioned but unnamed
- Feature-rich app with payment gateways, live chat, AI tools (GitHub achievements) — TODO name.
- Portfolio site projects on malikhaider.vercel.app — site is client-rendered; content not extractable. TODO: paste project list or share the portfolio repo.
- ⚠️ "EyeGuard" real-time shoplifting-detection surveillance FYP — seen in LinkedIn feed; unconfirmed.
