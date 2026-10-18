# 🚀 Future Vision & Roadmap

The following items are officially **OUT OF SCOPE** for the initial MVP, but are listed here as the future feature roadmap for Claude Fable 5 and other agents.

## 1. IDE Integration & Terminal Access (Ultra Stark)
- **Goal**: Direct IDE Integration (e.g. VS Code extension or CLI). The detected "Slop" should be displayed right inside the editor natively.
- **Auto-Fixing**: GitHub Agent / IDE automatically implements suggestions as soon as a human-in-the-loop approves.

## 2. Dashboard Live Updates
- **Goal**: Live UI sync for repositories and scans. Currently, users must reload the page.
- **Tech**: Utilize Supabase Realtime for the entire dashboard UI state.

## 3. Platform Expansion
- **GitLab & Bitbucket**: Native PR-Scanner integration for other version control platforms beyond GitHub.
- **Enterprise EU Hosting**: Dedicated deployment topologies for Enterprise customers hosted entirely in the EU.

## 4. Accounts & Monetization
- **Auth & Payments**: Proper User-Logins and Account Management.
- **Billing**: Integration with Stripe or Paddle.

## 5. RAG & LLM Pipeline Enhancements
- **Project-Wide Scanning**: Deep codebase indexing (currently only caching function names; need to scale to full function bodies safely).
- **LangChain**: Integrate LangChain for better, more complex output pipelines.
- **Dynamic Master Prompts**: The pipeline should pull conditions dynamically based on the code architecture (e.g. don't inject React rules when reviewing a C++ codebase).
- **System Prompt Refinement**: Take system prompt patterns and improve them individually.

## 6. Unit Economics & Prompt Compression
- **Goal**: Translate user inputs and system prompts into highly token-optimized English (or machine-readable pseudo-language) before passing them to the LLM.
- **Impact**: Aim to reduce API token costs by up to 70%. The UI must remain in the user's native language.

## 7. UX / Quality of Life
- **Dark Mode**: Add native theme switching.
- **Settings & History**: Let users configure rule strictness and view historical PR scans.
- **Rate Limits**: Introduce robust rate limiting to protect the backend.

---

> **Note to Claude Code / Fable 5**: When picking up one of these features, use plan mode, verify architecture rules (no generic variable names, max complexity of 15, explicit DB queries) and iterate cleanly without breaking the existing Judge Pattern pipeline.
