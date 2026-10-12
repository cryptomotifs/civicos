# CivicOS submission research

Checked 2026-10-12. Internal implementation notes; no submission, registration, transaction, or credential access performed.

## Decision

Build the grant-review workflow first: intake, evidence checks, human review, decision, and portable receipt. The smallest credible crypto feature is an independently checkable commitment to the exact reviewed record. Use a signed Solana Memo transaction on **devnet**, with no fund transfer, new token, or custom contract required.

This is a prototype recommendation, not a claim that any CivicOS feature has already been built or tested.

## Submission deadline and required package

**Crypto World's Fair closes October 12, 2026 at 11:59pm Pacific Time**, which is also 11:59pm in Vancouver. Each member must register, and the leader must submit before close. Entry is limited to one team/product. Check participant eligibility in section 3; submitted material must be English and rights-cleared. Judging considers functionality, market impact, novelty, blockchain UX, open-source composition, and business viability. The current event has multiple ecosystems; Solana integration is relevant to its Solana track. These are summarized requirements, not an eligibility determination. [Official 2026 rules, sections 3, 5–8, 12, 14](https://colosseum.com/legal/Crypto%20World%27s%20Fair%20Hackathon%20Rules.pdf)

The current FAQ calls for product name/description; blockchain/tool choices; team backgrounds/location; logo; repository; a two-to-three-minute pitch; a separate product demo no longer than three minutes; distribution strategy and demand validation. Private repositories are permitted with review access for hackathon@colosseum.com. Solo founders may enter. Disclose relevant prior development; only work from the competition period is judged. Weekly updates are recommended, not universally required. New products without significant outside funding are the intended entrants. [Current hackathon FAQ](https://colosseum.com/hackathon)

For CivicOS specifically:

- Record the starting point truthfully: a pre-existing proposal, with no working app before this build.
- Include the actual app URL, source/reproducible run instructions, and a short feature-status table.
- Record two videos; do not assume one video fills both required fields.
- Use actual founder experience and actual customer conversations only. None have been established in this task.
- Test access to the app, videos, and repository from a logged-out browser.
- The user must supply/confirm their team profile and complete the actual entry. Building the app is not the same as entering the competition.

The Colosseum workshop distinguishes the pitch's business story from the technical demonstration. It recommends a concise explanation of the target user, problem, team fit, genuine validation, architecture, and implementation priorities. Its article is prior-event guidance, so the current rules/FAQ take precedence. [Submission workshop](https://blog.colosseum.com/perfecting-your-hackathon-submission/)

## Minimal Solana receipt

### Why this integration has a purpose

A grant applicant, reviewer, or later auditor should be able to establish that the exported evidence-and-decision record matches the version a wallet signed into Solana. The blockchain contribution is a shared, externally verifiable digest and signer record. It cannot establish that a claim is true, a reviewer has governmental authority, a grant was paid, or a decision is lawful.

### Proposed record

Use a versioned object, for example:

```json
{
  "schema": "civicos.review.v1",
  "recordId": "a-random-nonpersonal-id",
  "nonce": "random-per-record",
  "demo": true,
  "policyVersion": "demo-policy-1",
  "evidence": [
    { "id": "e-1", "sha256": "digest-of-exact-file-bytes", "size": 1234 }
  ],
  "assessment": {
    "checks": [],
    "recommendation": "needs-review"
  },
  "decision": {
    "status": "approved",
    "reason": "Reviewer-entered explanation"
  },
  "reviewerWallet": "public-address",
  "createdAt": "ISO-8601-time"
}
```

This is a design suggestion, not an official schema. Include every field the verification claim covers, and exclude derived UI-only fields. If raw files are not retained, claim verification of their digests only. If the product merely accepts filenames and descriptions, do not claim the files themselves were hashed.

1. Freeze a snapshot of the record, including evidence hashes, checks, reviewer decision, policy version and signer address.
2. Serialize deterministically: recursively sorted object keys, UTF-8, consistent array order, defined null/number handling. An even simpler alternative is exporting the exact frozen UTF-8 JSON string and always hashing its bytes.
3. Hash those exact bytes with SHA-256 in the browser.
4. Prepare one Memo instruction containing only `CIVICOS:v1:sha256:<64-hex-digest>`.
5. Set the connected wallet as fee payer and as a required signer in the Memo instruction. Obtain a fresh blockhash, present the transaction to the wallet, and submit only after the wallet approves.
6. Store the signature and cluster while pending. Poll confirmation and validate the fetched transaction before marking it anchored.
7. Export the frozen payload, hash, cluster, signature and signer. Explorer: `https://explorer.solana.com/tx/<signature>?cluster=devnet`.
8. A verification screen recomputes the hash and checks the on-chain memo and signer. Editing one covered field must produce a mismatch.

Solana's Memo program checks UTF-8 data and validates all accounts supplied to the instruction as transaction signers. Supplying zero accounts is allowed but does not provide a Memo-level signer attestation. Its program address is `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`. [Official Memo program documentation](https://www.solana-program.com/docs/memo)

The current Solana Cookbook demonstrates `getAddMemoInstruction` from `@solana-program/memo`. Follow the installed package's actual types because the current Kit example uses client plugins; do not mix older and newer Kit snippets. [Official add-memo cookbook](https://solana.com/developers/cookbook/transactions/add-memo)

### Confirmation and verification rules

- `sendTransaction` returning a signature is submission acknowledgement, not confirmation. Preflight should remain enabled. [sendTransaction](https://solana.com/docs/rpc/http/sendtransaction)
- Poll `getSignatureStatuses`; require a non-null entry, `err === null`, and `confirmationStatus` of confirmed or finalized. For an older receipt use `searchTransactionHistory: true`. A null response is unknown/unavailable, not proof of tampering. [getSignatureStatuses](https://solana.com/docs/rpc/http/getsignaturestatuses)
- Fetch `getTransaction` at an appropriate commitment. Require `meta.err === null`; check exact Memo program address, exact memo contents, the wallet's actual signer flag, and the expected wallet. The expected wallet must come from an independently trusted reviewer policy to establish reviewer identity; trusting a wallet address inside an imported receipt alone establishes only internal consistency. [getTransaction](https://solana.com/docs/rpc/http/gettransaction)
- Restrict this prototype to transactions it creates in a supported format. When accepting arbitrary receipts, set the supported transaction version deliberately and surface unsupported formats. Current docs describe legacy, v0, and v1 transactions; do not silently assume every chain transaction is legacy. [Transaction introspection](https://solana.com/docs/core/transactions/transaction-introspection)
- Expose separate status labels: Prepared locally; Awaiting wallet; Submitted; Confirmed on devnet; Finalized on devnet; Failed; Verification unavailable.
- Anchor an immutable snapshot. If the reviewer edits any covered data afterward, invalidate the local attachment or retain it as an older version and prepare a new receipt.
- Do not claim the UI timestamp is chain time. Show RPC slot/block time when retrieved, allowing unavailable block time.
- Memo anchoring is not escrow, payment, recipient identity verification, legal signature validation, or a custom on-chain permissions system.

### Operational gotchas

- Solana devnet is for development and uses faucet SOL. Public RPCs are shared, rate-limited, and not production infrastructure. Display actionable 429/network/airdrop failures and permit retry without inventing success. [RPC overview](https://solana.com/docs/rpc)
- Transactions need a recent blockhash. Keep `lastValidBlockHeight`; distinguish expiry from an unknown outcome. Check the existing signature before creating a newly signed retry to reduce duplicate receipts. Solana transactions execute atomically and have a bounded wire size; this short memo stays well below the legacy 1,232-byte size ceiling. [Transactions](https://solana.com/docs/core/transactions)
- Never request or persist a wallet seed phrase/private key in the app. An injected wallet should own signing. No OpenAI credential is needed for this integration.
- Anchor only the digest, not names, uploaded text, reasons, addresses or filenames. The wallet and transaction metadata remain public. A digest is not encryption and can leak information about predictable data; a per-record random nonce reduces easy guessing.
- If local storage is the only persistence, say "Saved on this browser" and support export/import. Do not claim shared multi-user records or secure document storage.
- If an AI review is not actually calling a model, name it "Rule checks" or "Demo assessment"; do not display invented AI accuracy or throughput metrics.

## Three-minute product-demo narrative

Use actual final UI labels after implementation. The spoken material below is original draft narrative; record only actions that genuinely work. Budget is approximately 2:45–3:00 with cursor movement.

**0:00–0:20 — Open the review workspace**

"CivicOS helps grant teams connect a funding decision to the evidence and checks behind it. This is our hackathon prototype, using synthetic applications and a demonstration policy. It has not been validated by a government agency."

Show the persistent demo-data label and one application.

**0:20–0:55 — Inspect evidence and checks**

"Here is one application. A reviewer can see the submitted evidence, which requirements are satisfied, and what still needs attention. These checks support the reviewer; the reviewer remains responsible for the decision."

Show a concrete failed/missing check. Add evidence or change a relevant field, run checks, and show the state change. Describe rule-based checks as rule-based.

**0:55–1:25 — Make a decision**

"I can record a decision with a reason, preserving the policy version and the evidence that informed it. CivicOS now prepares a portable snapshot of that review."

Enter an actual reason, save, and create/export the record.

**1:25–2:10 — Anchor the exact snapshot**

"The browser hashes this exact snapshot. With a connected wallet, I can write only its digest to a Solana devnet transaction. Personal application content stays out of the memo. This is a test-network record; no grant money is being moved."

Show the wallet prompt, real submission, confirmation state, signature and Explorer transaction. If no confirmed live transaction was achieved, replace this segment with: "The app can prepare this receipt locally. Live devnet signing has not yet been demonstrated." Do not animate a fake confirmation or use a placeholder Explorer signature.

**2:10–2:40 — Verify and demonstrate tamper detection**

"Verification recomputes the snapshot's hash and compares it with the confirmed transaction. The unchanged record matches. Changing a covered field breaks that match, so a later reviewer can detect that this is a different version."

Import the exported record, verify, then use a separate altered copy. Do not alter the only original record.

**2:40–3:00 — State the actual boundary**

"The result is a working evidence-to-decision workflow with a portable verification receipt. This proves the recorded version matches the on-chain commitment. It does not prove the evidence is true. Our next validation step is testing the workflow with grant administrators."

Replace the last sentence only when there are actual interviews/pilots to describe. Do not claim procurement relationships, customer adoption, fraud-detection effectiveness, government compliance, or time savings without evidence.

## Separate pitch outline

- 0:00–0:25: Target grant operator and concrete problem of reconstructing how decisions were made.
- 0:25–1:00: The narrow workflow and why an external receipt is useful when several parties need to compare versions.
- 1:00–1:30: One brief outcome from the live prototype; explain Solana's exact role.
- 1:30–2:10: Founder background and actual discovery evidence. If none, plainly call customer need a hypothesis and explain intended interviews.
- 2:10–2:40: Proposed first customers, distribution route, and business model as hypotheses.
- 2:40–3:00: What was built during the event, current limitation, and immediate validation milestone.

Do not present the broad government proposal as a delivered operating system. Position this submission as CivicOS's first narrow product: an evidence-and-decision receipt workflow for grant review.

## Minimum verification before claiming completion

1. Intake edits persist on reload and can be exported.
2. Checks respond to changed inputs, including missing evidence.
3. Decision requires a reason; receipt includes all promised data.
4. Identical canonical payload produces the same hash across export/import.
5. A one-character alteration in a covered field fails local verification.
6. Wrong signer, wrong memo/program, failed transaction, wrong cluster, and unavailable RPC do not pass on-chain verification.
7. Rejecting wallet authorization leaves the review intact and unanchored.
8. At least one real devnet signature is confirmed and independently visible before the submission says "live Solana integration tested."

