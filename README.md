# CivicOS — Evidence before decisions

A working, no-AI-account prototype for reviewing grant, procurement and governance evidence. Built for a Colosseum submission; not a validated government decision system.

## What works
- Create and save private decision dossiers with a review question, rubric and knowledge cutoff.
- Upload text-based PDF, TXT, Markdown and CSV; PDF extraction happens in the browser.
- Record available/effective dates and declared source families. Sources published after the cutoff are excluded.
- Write supported, contradicted or unsupported findings with up to two source passages in the UI.
- Reject fabricated or ineligible quotations; human reviewers still assess semantic meaning.
- Run deterministic date, lineage, citation, rubric and review-completeness checks.
- Accept or challenge each finding, freeze a human decision, and export canonical JSON plus a SHA-256 fingerprint.
- Start corrections without overwriting earlier snapshots; each new frozen version links to the previous digest.
- Verify exported records in the browser. Optionally anchor and verify a digest through Solana devnet Memo transactions.

No OpenAI account, API key, token payment or AI service is required. The hosted application needs internet access for workspace storage. Solana receipt actions contact the public devnet RPC; all other review actions operate without third-party model calls.

## Local development
Node.js >=22.13 and pnpm 11 are required. Use a trusted pnpm installation.

1. Run pnpm install --frozen-lockfile.
2. Run pnpm build to emit local Worker configuration.
3. Initialize the local database once:
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --config dist/server/wrangler.json --local --persist-to .wrangler/state --file drizzle/0000_curly_gorgon.sql
4. Run pnpm dev. Open http://localhost:5173 (or the address shown).
5. While the preview runs on port 5173, run node tests/integration.mjs.
6. Run node node_modules/typescript/bin/tsc --noEmit for type checks.

For Sites publication, the bundled source workflow builds and packages the project, then applies schema migrations to the hosted D1 database. The existing Site identity is in .openai/hosting.json; do not create a duplicate Site for updates.

## Demonstration
Load the clearly labelled synthetic air-quality grant. It contains a visits-versus-unique-residents contradiction, an unsupported forecast, incomplete calibration evidence, repeated source lineage and a later supplier correction. The initial findings are an authored fixture, not automatic analysis of arbitrary documents.

Inspect C2's exact passages, edit its assessment, accept or challenge each finding, run Check evidence, then record Request more evidence. Freeze, export and verify the JSON. To demonstrate arbitrary inputs, create a new dossier and add your own documents and human findings.

## Solana
The on-chain message is CIVICOS:v1:sha256:<64-character-digest> in the standard Memo program, with the wallet explicitly required as signer. The server verifies a confirmed, successful transaction, matching signer and exact message before marking it anchored. Document text stays off-chain.

Use Phantom configured for Devnet and a small amount of test SOL. The application never reads a private key. Local integrity checking does not require a wallet. A hash match proves consistency with a commitment, not truth, completeness, professional identity or decision authority.

Validation status: public devnet RPC reads succeeded and invalid-receipt rejection is covered. A live write could not be completed because the devnet faucet rejected the QA airdrop. Full wallet-to-chain anchoring therefore remains unverified. The optional tests/solana-live.mjs test creates an ephemeral QA signer and uses only test-network funds; it may fail when the faucet is unavailable.

## Storage and boundaries
D1 stores dossier text and snapshots. Hosted identity comes from the trusted Sites auth proxy; otherwise a 30-day HttpOnly SameSite session cookie isolates workspaces. If self-hosting outside Sites, strip externally supplied identity headers and provide a trusted authentication layer. Clearing a guest cookie loses access to that guest workspace. Do not use this prototype for sensitive production case files.

Source dates, source families and reviewer names are declared metadata. No verified credentials or access-role model is implemented. Reviewer challenges are recorded but are not an adjudicated appeals process. Review criteria are preserved as text, not automatically interpreted. Scanned PDFs need external OCR. There is no automatic semantic reasoning, credit scoring, grant award or regulatory decision.

Limits: 30 dossiers per workspace; 16 sources and 100,000 source characters per dossier; 40,000 characters per source; 24 findings; 300 activity events. These are prototype bounds.

## Checks completed
18 automated behavior checks cover hashing and tamper detection, exact citations and cutoff enforcement, concurrency, isolated workspaces, review gates, frozen immutability, correction history, manual finding validation and the no-key workflow. Browser QA covered editing, review, freezing, export, re-import verification, mobile width and deterministic checks. TypeScript and production build checks are also run before publication.

## Submission position
Describe this as an evidence-review and decision-provenance prototype, not revolutionary AI or a government-ready platform. Strong next evidence would be blinded grant-review trials measuring unsupported-claim detection, review time and agreement across reviewers. See docs/COMPETITIVE_RESEARCH.md and docs/SUBMISSION_RESEARCH.md for the bounded public-source comparison and current event requirements.
