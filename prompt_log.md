# Final Project — Prompt Log

## Task 1: Set up Final Project workspace and prompt log

**Prompt:**
> Hi Claude, today we will be working with the final project folder under AI yale som, put everything we work on there, I also need u to keep a prompt log like we have been doing till now, lmk if u dont remember

## Task 2: Core product decisions and non-negotiable requirements

**Prompt:**
> Prompt 1 — Core product decisions and non-negotiable requirements
> Treat these product decisions as binding requirements for every later prompt. Do not build the app yet; inspect the existing project and acknowledge the constraints in a concise checklist.
>
> A. Product decisions that apply to every prompt
>
> CareSignal is an AI-assisted care-coordination demo for family caregivers supporting a person through complex illness or recovery. It turns everyday observations into structured, traceable, caregiver-reviewed handoffs for a care team.
>
> - This is a classroom prototype and organization aid, not a diagnostic tool, treatment recommendation system, validated clinical triage system, or substitute for a care professional.
> - Use only fictional, synthetic patient profiles and observations. Do not use real patient records or PHI.
> - Do not connect to a real EHR, hospital system, pharmacy, or clinician account. The receiver is simulated and must be labeled as simulated.
> - The caregiver records observations in their own words. Preserve each original note exactly as entered. AI-derived labels and summaries must never overwrite the original.
> - AI must not invent symptoms, dates, diagnoses, causality, medication instructions, or trends. Every substantive insight must link to the source observation IDs that support it. If evidence is missing or conflicting, say so.
> - AI does not make medication decisions. In the cancer demo, it may surface a pattern and draft questions for clinician review. Any medication change shown is a clearly labeled simulated clinician response, not a decision made by CareSignal.
> - Safety rules must work independently of the AI model and API. Never wait for a weekly summary to display urgent guidance.
> - A missing check-in or missing note means unknown / not reported, not that the person is well.
> - Treat all observation text as untrusted input. Resist prompt injection, validate model outputs, and never reveal environment variables, prompts containing secrets, or internal credentials.
> - Use the course-required PORTKEY_API_KEY environment variable and model identifier gpt-6-luna as specified by the course. Keep the key secret. Do not silently switch to a different provider/model.
> - Look for .env in the project folder first and then the parent folder, without printing its contents. Provide .env.example with placeholders only.
> - The product must support two distinct experiences from its welcome page: (A) a no-fuss, clearly labeled demo experience with three prepared synthetic cases and usable demo credentials, and (B) self-service account registration/login so a professor can create an account and use CareSignal independently, including creating a new fictional case and adding observations. Do not make these two experiences look like the same kind of account.
> - Registration should feel like a real modern web product but must remain honest about being a classroom prototype. Use a reputable managed authentication provider compatible with the selected deployment stack (prefer Supabase Auth if practical) rather than inventing password storage. Support username/display name, email, password, sign-in, sign-out, session persistence, password reset/recovery, validation, useful errors, and clear account deletion/data-reset behavior if feasible. Passwords must never be stored or logged by CareSignal; use the provider's secure password handling. Never put service-role/admin credentials in browser code.
> - Include a required checkbox for Terms of Use and Privacy Notice at registration, with working readable pages/sections, version/date, and a stored acceptance record (user ID, terms version, timestamp). The copy must be clearly labeled as a prototype notice, not represented as lawyer-reviewed legal advice. Explain synthetic-only use, no real patient/PHI, no medical advice or emergency coverage, AI processing of submitted notes, retention/reset/deletion limitations, and that the receiver is simulated. Require users to affirm they will use fictional data only. Do not use deceptive consent, pre-check boxes, or hide limitations.
> - A public link must work for a new visitor without requiring access to the developer's computer. Select architecture and persistent database/storage compatible with the chosen hosting platform; do not rely on ephemeral serverless filesystem storage for registered users' records. Store users' cases, baselines, notes, AI results, handoffs, and status histories persistently, and enforce server-side per-user ownership on every read/write. Keep the three shared seeded demo cases isolated from registered users' private work. Include database migrations/schema setup, seed/bootstrap instructions, required environment-variable names, and a clear deployment guide.
> - Demo access must be genuinely usable from the deployed link. Provide either three separate seeded demo usernames/passwords (one per prepared case) or an equally clear demo-account selector backed by working demo credentials; document the actual configured credentials and any setup step needed. Do not pretend credentials work until tested. Demo accounts contain synthetic data only, and all visitors should understand that demo data may be shared/reset. Prevent demo users from overwriting seeded scenarios; if they can experiment, provide a safe reset or create a personal copy.
> - Keep account data isolated by authenticated user and case. Use server-side authorization, secure session cookies/provider SDK, CSRF protections as appropriate to the stack, rate limiting or provider safeguards for login/signup, server-side validation, and safe error messages. Add tests that attempt cross-user/cross-case access. Never claim the app is production-grade, HIPAA compliant, or suitable for real patient data. If full email verification/password reset depends on provider configuration, implement the flow and document exactly how to enable/test it rather than faking success.
> - Deployment is a required deliverable target, but publication must not happen silently: prepare a deployable app and step-by-step instructions; ask for explicit approval before pushing to GitHub, creating/using external services, or publishing the public link. The final checklist must distinguish local implementation, deployed-and-tested behavior, and anything blocked on account setup or approval. Do not invent a URL or claim the professor can access the app until a real deployment URL has been obtained and tested in a clean browser/session.
> - Keep the project simple enough to finish and verify before the deadline. Prefer a working, understandable product over unnecessary infrastructure.
>
> If at any point u think I have missed osmething or written somethin g wrong let me know

**Follow-up prompts:**
> what do u recommend for 1-7

## Task 3: Visual design system, screens, navigation, and interaction behavior

**Prompt:**
> Prompt 2 — Visual design system, screens, navigation, and interaction behavior
> Preserve these design and UX requirements as acceptance criteria for all later implementation prompts. Do not build the full app yet; summarize the screen map and interaction rules you will follow.
>
> Visual design and navigation specification (locked across all prompts)
>
> Build CareSignal as a calm, premium-quality caregiver workspace: warm minimalism, clinical clarity, and low cognitive load. It should feel like a modern health-tech product, not a hospital portal, a generic chatbot, or a crowded analytics dashboard. The design should make it easy to record an observation, inspect its evidence, and prepare a handoff.
>
> **Design system**
> - Main background: warm ivory #F7F6F2.
> - Cards/content surfaces: white #FFFFFF.
> - Primary accent: deep forest #253D38 for primary actions and navigation.
> - Calm accent: soft sage #DDE8DF for selected states and neutral highlights.
> - Text: dark charcoal/green-black with readable secondary grey.
> - Functional colors: muted amber for review/attention; strong red for emergency guidance; neutral grey for unknown/unavailable. Never communicate status using color alone; include text and icons.
> - Typography: DM Sans for headings and Inter for body/interface text, with system fallbacks. Prefer locally bundled fonts or reliable fallbacks so the app works without a network connection.
> - Body text should generally be 15–16px; secondary labels 13–14px; page headings roughly 24–32px. Use generous whitespace, restrained borders/shadows, consistent spacing, accessible contrast, rounded cards, and clear hierarchy.
> - Keep animation subtle and respect reduced-motion preferences. Do not use flashing or animation as the only urgent signal.
> - Responsive desktop and mobile layouts, keyboard navigation, visible focus states, semantic headings, screen-reader labels, and readable contrast are required.
> - No decorative health charts, clinical risk scores, fabricated metrics, testimonials, hospital logos, fake clinician credentials, or visual elements that imply clinical validation.
>
> **Main screens and navigation**
>
> Create eight main screens, plus the welcome/onboarding flow:
> 9. Welcome / account entry — brand, tagline (“Turn everyday observations into clearer care conversations”), three clear choices: “Explore a demo” (then choose one of three preloaded cases and use its working demo credentials or a documented demo-entry path), “Create an account” (registration with email, username/display name, password, required Terms and Privacy acceptance, and fictional-data acknowledgement), and “Sign in.” Include “Forgot password?” on sign-in and a visible synthetic-data/prototype notice. Do not ask for patient-identifying details or imply production clinical use. Include working Terms of Use and Privacy Notice pages.
> 10. Choose a case / onboarding — choose one of the three seeded fictional cases or create a fictional profile; show what each case demonstrates; optional caregiver relationship, care context, and baseline. Avoid long mandatory forms.
> 11. Overview dashboard (home page) — default destination after entering a case. Show the selected patient/case, persistent “Synthetic demo data” label, AI availability status, prominent Add Observation action, recent activity, optional check-in, current handoff status, care context/baseline, unresolved questions, and relevant safety notices. Compute all counts from stored data. Do not show a health score or “all clear.”
> 12. Observations — notebook-like free-text entry and chronological timeline. No category required, no daily limit. Show original note, timestamp, analysis status, labels, and safety state. Open a detail view with source/history.
> 13. Insights — evidence-linked AI summaries, supporting source IDs, uncertainty/conflicts, missing information, and neutral questions for the care team. Make each source ID open the exact original observation.
> 14. Handoffs — draft, caregiver review/edit, approve, submit, and status history. Show the observations included and all source links. Never auto-send.
> 15. Demo receiver — clearly labeled simulated receiver queue with exact persisted payload, unique handoff ID, received timestamp, status history, and separate explicit Acknowledge action. It is not a real hospital or care team.
> 16. Settings / care context — caregiver display name/relationship, patient pseudonym/context, optional baseline, optional reminder preference (off by default), AI/privacy explanation, switch/reset/create synthetic cases, and about/limitations.
>
> The daily check-in is a quick optional action on Overview, not a required standalone navigation destination. Safety guidance is an interruptive overlay/banner that can appear on any screen; it must not depend on navigating to a Safety page.
>
> **Navigation and interaction behavior**
> - Use a persistent left sidebar on desktop with Overview, Observations, Insights, Handoffs, Demo receiver, and Settings. On narrow screens, collapse it into an accessible menu.
> - Keep the active case visible in the top bar and make switching cases easy. Clearly label every seeded record as synthetic; distinguish seeded observations from current-session notes.
> - Welcome → Explore demo → choose one of three seeded cases / sign in with the case-specific demo credentials → Overview; or Welcome → Create account → accept Terms and Privacy Notice → create a fictional case / optionally start from a demo case copy → Overview; or Welcome → Sign in → the authenticated user's own cases → Overview. The Overview is the first main page after a case is selected. Returning registered users must retain their session according to the chosen auth provider and can sign out.
> - Add Observation opens a modal or focused panel. Saving persists the exact original text first; AI categorization follows asynchronously. Safety rules run immediately and independently.
> - Clicking an observation opens original text, stable ID, entry timestamp, optional event time, categories, safety-rule result, AI analysis state, and edit history if edited.
> - Clicking an insight/source ID opens the underlying observation. Clicking a category filters relevant notes.
> - Clicking the handoff card opens Handoffs. Review/edit is required before submission. Submit triggers a real local backend request; the receipt appears only after confirmed persistence.
> - The receiver's Acknowledge action is separate and explicit.
> - The case switcher must never mix notes, insights, handoffs, receipts, or status histories across patients.
> - Use clear loading, empty, unavailable, error, saved, pending, complete, failed, draft, reviewed, submitted, received, and acknowledged states.
> - Never claim email, SMS, browser push, or external notification delivery unless actually implemented and tested. Reminders are off by default; if only in-app reminder preferences are supported, call them that.
>
> **Product language and safety copy**
>
> Prefer cautious, plain-language copy:
> - Welcome: “Turn everyday observations into clearer care conversations.” Explain that CareSignal organizes caregiver-reported observations into evidence-linked summaries and handoffs; the caregiver stays in control.
> - Insights: “Here’s what the logged observations may suggest.” Invite the user to inspect source notes, dates, and missing/conflicting information.
> - Empty period: “No observations were logged for this period. There isn’t enough recorded information to summarize this period.”
> - AI unavailable: “AI analysis is currently unavailable. Your observation has been saved. You can continue logging notes and using the prototype’s predefined safety rules.”
> - Receiver receipt: “Handoff received by the simulated receiver. The approved handoff was saved in this demo. No real care team was contacted.”
> - Never say “the patient is safe,” “all clear,” “normal,” “no risk,” or “no action needed” based only on missing or routine observations.

**Follow-up prompts:**
> Thanks for checking these. Please make the following decisions explicit in the implementation:
>
> 1. Screen numbering: Correct the numbering to 1–8. The intended eight screens are Welcome/Demo Entry, Choose Case/Onboarding, Overview, Observations, Insights, Handoffs, Demo Receiver, and Settings/Care Context. Welcome and Onboarding count as two screens. The six sidebar destinations are Overview, Observations, Insights, Handoffs, Demo Receiver, and Settings.
> 2. Screen scope: Build all eight screens, including Welcome and Onboarding. Do not omit them because they are outside the sidebar.
> 3. AI usage cap: Unlimited observation entry is required. Only AI analysis is capped per day, using a configurable limit. When the cap is reached, observations must still save, deterministic safety rules must still run immediately, and the UI must clearly state that AI analysis is temporarily unavailable because the daily limit was reached. Do not imply that a note was analyzed when it was not. Do not invent a cap value; make it configurable and document the chosen default. If the course requires a specific cap, follow that requirement.
> 4. Backend: Implement handoff submission through the app's own server/API. In local development, this runs through the local development server; in deployment, it runs through the hosted app's backend. Validate and persist the approved payload server-side, and show a receipt only after successful persistence. The receiver remains simulated; no real care team is contacted.
> 5. Observation timestamps: Include an optional “When did this happen?” field, separate from the automatic timestamp recording when the note was entered. Never invent an event time if the caregiver leaves it blank.
>
> Please update the implementation plan and relevant tests to reflect these decisions. Preserve all other requirements, especially synthetic-only data, source traceability, patient isolation, and safety behavior independent of AI availability.
>
> Feel free to let me know if u disagree

## Task 4: Safety, privacy, AI integrity, delivery rules, and three demo cases

**Prompt:**
> Prompt 3 — Safety, privacy, AI integrity, delivery rules, and three demo cases
> Treat safety, privacy, AI integrity, honest delivery states, and the three synthetic demo cases as mandatory requirements. Do not weaken them for convenience. Summarize the acceptance criteria and test implications before proceeding.
>
> Expanded safety requirements (apply throughout the app)
>
> **Synthetic data, privacy, and scope**
> - Use fictional names, dates, observations, care histories, appointments, and scenario outcomes only. Mark every seeded record and synthetic scenario event synthetic: true.
> - Do not upload, request, store, or use real patient records, PHI, names, dates of birth, addresses, contact details, real medical images, insurance information, or identifying health details.
> - Demo mode is not production authentication or a secure personal account; label it accordingly. Registered accounts must use the chosen managed authentication provider and server-side ownership checks. Do not imply production-grade security, HIPAA compliance, clinical validation, or secure deletion unless actually implemented and verified.
> - Do not connect to a real EHR, hospital, pharmacy, insurer, clinician, or care team. Clearly label all receiver activity and clinician-response examples as simulated.
> - Minimize information sent to the model; keep API calls server-side; never expose PORTKEY_API_KEY, system prompts containing secrets, environment variables, stack traces, or provider credentials.
> - Keep .env ignored by Git and use placeholders in .env.example. No secret in source, logs, screenshots, report, or slides.
> - Explain local storage/reset behavior honestly. Reset only the intended demo data and say what is cleared. Avoid third-party analytics/tracking not required for the demo.
> - Validate server requests, enforce patient separation, and never trust client-supplied IDs/status without checking them server-side.
>
> **Clinical boundaries and communication**
> - CareSignal is an organization/communication aid, not a diagnosis tool, treatment recommender, validated clinical triage system, or substitute for professional care.
> - AI may organize and summarize explicitly reported information, identify uncertainty, and draft neutral questions. It must not diagnose, prescribe, suggest medication dose changes, recommend stopping/starting/changing treatment, or infer medication causality.
> - In the cancer scenario, the AI can surface evidence-linked patterns and questions for clinician review. Any plan/medication change is a separate fictional clinician response, labeled “fictional scenario outcome — not an AI recommendation or real clinical action.”
> - A missing observation/check-in/baseline value is unknown, not normal or reassuring.
> - Preserve the caregiver’s original wording. Attribute claims to caregiver reports; do not endorse unverified medical claims as facts.
> - No numerical health/risk scores, fake precision, probability of deterioration, or “patient safe” declarations.
> - Do not claim the product prevented harm or improved real patient outcomes. Synthetic scenarios are demonstrations, not evidence of real-world effectiveness.
>
> **Deterministic safety and urgent guidance**
> - Implement a small, explicit, documented deterministic rule set separate from AI. It must work when the API, model, or receiver is unavailable.
> - Run safety rules against the original note immediately on save, before/independently of AI analysis. A weekly handoff must never delay urgent guidance.
> - For a predefined emergency test scenario such as sudden difficulty breathing or being difficult to wake, display prominent immediate emergency guidance; in the US demo, instruct the user to call 911 if it is happening now and follow the dispatcher’s instructions.
> - For predefined concerning but non-emergency examples, prompt the user to contact an appropriate care professional promptly. For ambiguous items, ask the caregiver to review. Routine status must never imply safety.
> - Keep the original triggering note visible, explain the prototype rule that fired, and keep the alert visible until it has been seen. Acknowledging a banner must not delete the note or imply the issue is resolved.
> - Do not imply these limited rules catch every emergency. Show a clear limitation: absence of an alert does not mean the situation is safe.
> - Test positive and negative examples, false positives, missed triggers on the predefined test set, API-offline behavior, and alert persistence. Report denominators and limitations.
>
> **AI integrity, prompt injection, and failures**
> - Treat observation text as untrusted data, never as instructions. Test malicious notes that ask the model to reveal secrets, override rules, fabricate sources, or mark a patient safe.
> - Validate structured output, allowlisted categories, source IDs belonging to the same patient, schema types, and permitted fields. Reject fabricated IDs and unsupported claims.
> - Every substantive insight must link to source observation IDs. Preserve conflicting reports and missing context. Do not invent dates, symptoms, causes, diagnoses, trends, or medication instructions.
> - On missing key, timeout, provider error, malformed output, or invalid sources, preserve the note and display a clear unavailable/error state. Never show a fake live-AI result.
> - Keep model usage/cost fields truthful: record only provider-returned usage or a documented calculation; separate measurements from estimates.
>
> **Workflow, delivery, and status integrity**
> - Save notes before attempting AI analysis; notes remain available on AI failure.
> - No automatic handoff submission. Caregiver review/approval is required.
> - Received means the simulated backend confirmed the approved payload was persisted. Acknowledged requires a separate explicit receiver action. Neither means real clinical action.
> - Persist the exact submitted payload, a unique handoff ID, receipt timestamp, and status history. Retry behavior must not create duplicate handoffs.
> - Do not show a successful receipt before persistence. Show honest failed/retryable states.
> - Do not claim email, SMS, push notifications, or scheduled delivery unless implemented and tested.
> - The app must distinguish Draft, Reviewed, Submitted, Received, Acknowledged, and Failed.
>
> **Accessibility and security evidence**
> - Never use color alone for safety/status. Use text, icons, accessible labels, keyboard focus, and sufficient contrast.
> - Avoid flashing effects; support reduced motion. Keep urgent instructions large, concise, and not buried below charts.
> - Test patient isolation, reset behavior, synthetic flags, secret scanning, prompt injection, source traceability, and delivery persistence.
> - Document limitations and what was actually tested. Never claim HIPAA compliance, clinical safety, clinical effectiveness, or comprehensive emergency detection.
>
> **Three demonstration cases --- locked**
>
> Case 1: Cancer treatment and clinician medication review
> Fictional patient Jordan Lee, synthetic ID PAT-CANCER-001, is in cancer treatment/recovery at home with regular care-team visits. Use realistic but non-prescriptive observations across multiple days: fatigue, reduced food/fluid intake, nausea or discomfort if explicitly logged, and changing ability to do ordinary activities. Include enough dated observations to demonstrate a pattern while avoiding a claim that the symptoms are caused by a particular medication. CareSignal should summarize the pattern with source IDs and uncertainty, then draft questions for the care team. A separate simulated receiver response may say the clinician reviewed the handoff and changed the plan, but it must be visibly labeled fictional scenario outcome --- not an AI recommendation or real clinical action. The app must never recommend a dose or independently suggest changing medication.
>
> Case 2: Post-surgery urgent safety event
> Fictional patient Morgan Patel, synthetic ID PAT-SURGERY-002, is recovering after surgery. Seed routine recovery observations and a clearly defined urgent scenario, such as sudden difficulty breathing or being difficult to wake. The deterministic safety layer must display immediate emergency guidance (for a US demo, call 911) before any AI summary or weekly handoff. Make it clear this is a predefined test scenario and not proof the app catches every emergency. Test that urgent guidance still works when the API is unavailable.
>
> Case 3: Gradual recovery change, incomplete information, and better handoff
> Fictional patient Alex Rivera, synthetic ID PAT-RECOVERY-003, is recovering from a significant illness. Seed dated observations over several days such as needing more help walking, sleeping more than usual, and differing reports about meals where one report lacks a time or context. CareSignal should distinguish a supported change from a possible but unconfirmed pattern, preserve the conflicting reports, state what is unknown, and create a caregiver-reviewed handoff with source IDs. This case demonstrates longitudinal organization and honest uncertainty, not a diagnosis.
>
> Use these three cases throughout the interface, tests, screenshots, report, and slides. Make all names and events explicitly synthetic. Never claim that the app prevented a real adverse event, caused a real medication change, or improved real patient outcomes.

**Follow-up prompts:**
> I approve all four choices, with the following safeguards:
>
> 1. Seeded AI insights and tokenomics: Proceed with generating seeded insights using the course-required `gpt-6-luna` model through Portkey. Record the actual input/output token counts and model metadata returned by the provider, where available. Validate the output against the expected test cases and source observation IDs before storing it. If generation fails, do not fabricate an AI result or token counts; show an honest unavailable state and provide a documented way to retry generation. Keep the API key server-side and never log or expose it.
> 2. Relative seed dates: Proceed. Generate dates relative to the seed/reset time so the weekly view is populated whenever the demo is opened. Keep timestamps internally consistent and deterministic within each seeded copy. Clearly distinguish seeded example observations from observations entered by the current visitor. Document that resetting or reseeding regenerates relative dates.
> 3. General fictional clinician response: Proceed. Use general wording such as “In this fictional scenario, the care team reviewed the handoff and adjusted the plan.” Do not name drugs, specify doses, or imply that CareSignal or its AI recommended a treatment change. Label this explicitly as a simulated scenario outcome, not a real clinical event.
> 4. Urgent alert and isolated demo copies: Proceed, with an important distinction: Case 2 should visibly demonstrate the predefined emergency scenario when opened, but the interface must make clear that this is a synthetic test scenario—not a real emergency involving the visitor. The deterministic safety rules must also detect the defined emergency phrases in newly entered observations, independently of AI availability or the daily AI cap. Each visitor/session must have an isolated, resettable copy, and dismissing or acknowledging an alert in one copy must not affect another visitor's copy. Do not claim that the rules detect every emergency or that absence of an alert means someone is safe.
>
> Please add tests for token-count integrity, failed seed generation, relative dates, source traceability, emergency triggering with the AI disabled, and isolation of alert state across demo copies.

## Task 5: Foundation and repository setup

**Prompt:**
> Prompt 4 — Foundation and repository setup
> Now inspect and implement the project foundation in the existing folder. Keep Prompts 1–3 as the governing specification.
>
> B. Initial foundation and repository setup task
>
> You are working in my existing final project folder inside the `AI Yale Sum` folder. First confirm the current working directory and inspect its existing files. Continue in this folder; do not create a second project folder, move the project, or overwrite useful existing work. Build a clean, working foundation for a polished but appropriately scoped classroom web application.
>
> Before writing code:
> 17. Inspect the current folder and identify existing files. Do not delete useful work without explaining why.
> 18. Briefly state the stack you plan to use and why. Prefer a straightforward modern web stack supporting an interactive UI, server-side API routes, persistent data, managed authentication, public deployment, and automated tests. Prefer Supabase Auth + persistent Postgres and a compatible host if that is the simplest reliable choice. Identify which pieces require me to create/configure an external account or add environment variables; do not pretend those steps are complete.
> 19. Create a concise implementation plan, then implement the foundation.
>
> Foundation requirements:
> - The app name is CareSignal.
> - Use the course-required Portkey setup with environment variable PORTKEY_API_KEY and model identifier gpt-6-luna. Do not expose the key in browser code, logs, screenshots, source files, or Git.
> - Environment loading must check .env in the project directory first and then the parent directory. Do not print secret values while checking.
> - Create .env.example with placeholder values only and ensure .env, build output, local database files, caches, and other secrets are in .gitignore.
> - If the API key is absent or the API fails, the app should still start; deterministic safety and ordinary note-taking must continue. Show an honest AI-unavailable state; never pretend live AI ran.
> - Establish a maintainable folder structure, lint/type checks if appropriate, basic automated tests, and clear npm/package scripts or equivalent.
> - Create README.md with exact local setup/run/test instructions and a short project description.
> - Add a prominent product limitation in the UI and README: classroom prototype, synthetic data only, not medical advice, not a validated clinical triage system, and no real clinical-system integration.
> - Do not create the final report or slides yet.
> - Do not push anything to GitHub. You may initialize Git locally if useful, but do not commit or push without asking me.
>
> Finish by running available checks and reporting what works, what remains, and the exact command to start the app. Keep the complete requirements above available as the governing specification for every subsequent prompt; if an implementation decision conflicts with them, explain the conflict and ask before changing scope.

## Task 6: Data model, persistent storage, and complete synthetic seed package

**Prompt:**
> Prompt 5 — Data model, persistent storage, and complete synthetic seed package
>
> Now create the data model and synthetic demo data package that the entire app will use. Do this now, not after the interface is built.
>
> Create typed, documented models for: - Caregiver/demo session. - Patient profile and care context. - Caregiver-reported baseline. - Observation with stable ID, patient ID, exact original text, timestamp, optional author/source, AI-derived primary category, secondary categories, safety state, and analysis metadata. - Daily check-in and its explicit response state. - AI insight with source observation IDs, evidence text, uncertainty/conflict notes, and generation metadata. - Weekly handoff draft, reviewed/approved payload, delivery receipt, simulated receiver response, and status history. - Evaluation case and evaluation result.
>
> Use a persistent storage design suitable for both local development and a publicly deployed multi-user prototype. Prefer a managed Postgres database (such as Supabase) if practical; do not use ephemeral serverless disk storage for user records. Keep storage access behind a repository/service layer. Include migrations and a deterministic seed/bootstrap command. Every user-owned row must be linked to an authenticated user and every server read/write must enforce ownership; use row-level security where supported and verify it with tests. Shared seeded demo fixtures must be isolated from registered-user data. Never store API keys in the database.
>
> Create a dedicated synthetic data package, separate from application code, containing: - The three locked demonstration cases: cancer treatment and clinician medication review; post-surgery urgent safety event; gradual recovery change with incomplete/conflicting information. - At least 12--15 realistic, varied synthetic observations across the three cases and all seven categories. - Stable fixture IDs, consistent timestamps, patient-specific context, and expected evaluation outcomes. - Ordinary notes, multi-category notes, ambiguous notes, conflicting reports, missing context, a prompt-injection attempt, routine safety examples, and a predefined urgent scenario. - A coherent seeded dashboard state, plus the ability to create new demo profiles and add unlimited new observations. - Explicit synthetic: true metadata on every seeded patient, observation, check-in, and receiver response. - A reset-to-known-state function or command. - Clear distinction between seeded examples and observations added during the current session.
>
> The three cases must be internally consistent: 1. Cancer (`PAT-CANCER-001`, Jordan Lee): cancer treatment/recovery at home with regular care-team visits. Use dated reports of fatigue, reduced intake, and daily-function changes. Do not assert these are caused by medication. The app can surface a pattern and draft clinician questions. Include a separate, clearly labeled fictional clinician-response event indicating that the clinician reviewed the handoff and changed the plan; it is a scenario illustration only and must not be represented as a decision made by AI. 2. Post-surgery (`PAT-SURGERY-002`, Morgan Patel): routine recovery observations plus a predefined urgent scenario such as sudden difficulty breathing or being difficult to wake. Mark the scenario as synthetic test data. The deterministic safety rules must recognize it even if the AI API is unavailable. 3. Recovery (`PAT-RECOVERY-003`, Alex Rivera): observations over several days about mobility/function and sleep, plus conflicting or incomplete meal reports. Preserve the original notes and make the expected output explicitly retain uncertainty.
>
> Safety and data integrity: - Do not use real patient data, PHI, or actual medical records. - Do not use invented clinical references or imply the synthetic cases are validated medical scenarios. - Do not interpret an absent field as normal. Use unknown, not_reported, or equivalent. - Keep original note text immutable. If editing is supported later, retain a version history. - Ensure timestamps are explicit and consistently interpreted; do not invent missing event times. - Create a data dictionary and explain the model in the README or a dedicated docs file.
>
> Create a seed dataset with meaningful content, not just empty placeholders. Run tests that verify all fixtures are synthetic, IDs are unique, patient references resolve, and reset/seed is deterministic. Report the files created and test results.

## Task 7: Demo access, real account registration/login, terms, and patient onboarding

**Prompt:**
> Prompt 6 — Demo access, real account registration/login, terms, and patient onboarding
>
> Follow the locked visual design specification. Build the welcome and access experience as two clearly separated modes: a quick demo for evaluators and a self-service account flow for anyone who wants to use CareSignal independently. Do not describe demo access as secure personal account authentication.
>
> **A. Demo access**
> - Provide “Explore a demo” and let visitors select one of three seeded synthetic cases: cancer treatment, post-surgery recovery, or gradual recovery with incomplete/conflicting information.
> - Configure three working demo credentials, one mapped to each seeded case, or a clearly explained equivalent demo-entry mechanism that has been implemented and tested. If using username/password credentials, make the usernames/passwords available to the evaluator in the README and on a discreet “Demo access” panel on the welcome screen; they must actually authenticate against the deployed environment. Never hardcode a secret admin/service key into the browser. These shared demo accounts contain synthetic data only.
> - Ensure visitors can explore safely without overwriting canonical seed scenarios. Allow a “Create my copy”/“Duplicate demo case” flow for experimentation, or make seeded cases read-only while offering a personal copy. Explain whether demo changes reset or are shared.
> - Include a clear “Demo mode — synthetic data only; shared demo data may be reset” label throughout demo sessions.
>
> **B. Self-service registration and sign-in**
> - Add “Create an account,” “Sign in,” “Forgot password?”, and “Sign out” flows. Use a reputable managed auth provider (prefer Supabase Auth if the chosen stack supports it well) rather than implementing password hashing/session security from scratch.
> - Registration fields: email, username/display name, password, confirm password, required Terms of Use acceptance, required Privacy Notice acceptance, and a required acknowledgement that only fictional/synthetic case data may be entered. Validate email format, username length/characters/uniqueness where feasible, password policy, matching passwords, and required checkboxes. Do not pre-check consent boxes. Do not collect a real patient's identity or health details.
> - Use secure provider-managed password storage, sessions, sign-in/out, and password recovery. Never log passwords or tokens, never return secrets in API responses, and never expose server-only/service-role keys. Show clear validation and provider errors without stack traces. If email verification is enabled, implement the real verification flow and explain local/deployment configuration; never show “verified” unless confirmed by the provider.
> - Persist an acceptance record containing user ID, Terms version, Privacy Notice version, timestamp, and synthetic-data acknowledgement. Do not treat a client-only checkbox as a durable acceptance record. Add working Terms of Use and Privacy Notice pages/sections, with a version/date and readable links from the footer and forms.
> - Write honest, concise prototype terms/privacy copy. State that CareSignal is a classroom prototype; it is not medical advice, diagnosis, treatment, validated triage, or emergency monitoring; use fictional data only; notes may be processed by an AI provider to generate summaries; the receiver is simulated; describe storage, retention, account/data deletion, and limitations accurately. Do not claim lawyer review, HIPAA compliance, or security certifications. Include a clear instruction to call local emergency services for an emergency and not rely on this prototype.
> - After login, show only that user's cases, baselines, observations, AI outputs, check-ins, handoffs, receipts, and settings. On logout, clear client-side private data/cache. Add server-side ownership checks and tests proving user A cannot read, update, delete, or submit user B's records by guessing/changing IDs.
> - Registered users can create their own fictional profile, baseline, and unlimited observations and use the full workflow: AI categories/insights, deterministic safety rules, handoff review, simulated submission/receiver, and status history. They may optionally start from a copy of a seeded demo case. All new patient/case data must carry synthetic: true.
> - Support returning users opening the deployed public link from a different browser/device: sign-in should retrieve their persisted account data from the remote database, not depend on the developer's computer, local browser storage, or a serverless local file.
>
> **C. Case creation and baseline**
> - Capture caregiver display name and relationship to the fictional patient, with optional fields where sensible.
> - Capture patient pseudonym/display name, optional age range, primary condition or “not sure,” care phase, care setting, and optional milestones/appointments/care-plan changes.
> - Capture an optional caregiver-reported baseline for mobility/daily functioning, eating/drinking, sleep/energy, mood/communication, memory/attention, and other concerns. Unknown/blank values remain “Not provided,” not normal.
> - Keep onboarding concise, accessible, and skippable where safe. Do not ask for real patient names, DOBs, addresses, phone numbers, insurance details, or actual medical records.
> - Make case switching easy without mixing data. Demo accounts and registered accounts must be clearly distinguished in the interface.
>
> **D. Tests and finish criteria**
> - Test registration validation, required consent, acceptance-record persistence/version, login/logout, session restoration, password-recovery flow wiring, duplicate username handling where supported, case creation, baseline persistence, user/case isolation, and demo-account access.
> - If external provider credentials/configuration are unavailable in the local environment, implement the real integration and a clear setup checklist, mark provider-dependent tests as blocked rather than passing, and keep ordinary local note-taking/safety behavior testable. Do not build a fake auth flow that claims to secure accounts.
> - Finish with a working flow and report which parts are tested locally, which require provider setup, and what must be done to test a public link.

**Follow-up prompts:**
> Keep building locally; I'll set up Supabase and Vercel later. Send me Prompt 7 work next.

> wait no lets do the things u said we need to do together, guide me 1 by 1

> *[screenshot of the Supabase "create new project" form]*

> okay done

> cant u do all of this

> done

> don e

> *[screenshot of the Supabase project dashboard]* where

> done

> Yes, create a public GitHub repo named caresignal under HDBRI, commit and push the Final Project code (with the prompt log).

> Also I hope all of this is logged in the log

> Yes, add those setup messages as follow-ups under Task 7, then commit and push.

> Yes, guide me through deploying on Vercel now (do as much as you can yourself).

> *[screenshot of the Vercel "New Project" page]* which code

> *[screenshot of the terminal showing "You are now signed in" to Vercel]*

> done

> yay everything worked perfectly

> *[screenshot of the Overview "Current handoff" card showing HO-3KN6634Y, "Acknowledged in the simulated receiver"]* what is this

> *[screenshot of the three welcome cards]* from a user pov this is a bit confusing how can we make it better, can we do the receipt no thing only when clicked or something, also I wan t teh sign in for the 3rd box to be aligned with the others in the image -

> Yes, push the commits to GitHub and redeploy the live site.

> yes log everything unless I tell u not to

> Yes, push the updated prompt log to GitHub.

> did we already do this one? - Prompt 6 — Demo access, real account registration/login, terms, and patient onboarding
> Paste this entire prompt into Claude Code after the previous prompt has completed successfully.
> *[followed by the full Prompt 6 text again, identical to Task 7's prompt above]*

## Task 8: Dashboard and navigation

**Prompt:**
> Prompt 7 — Dashboard and navigation\
> Implement the complete locked navigation map and visual system. The main screens are Welcome/Demo entry, Choose/Create case, Overview dashboard, Observations, Insights, Handoffs, Demo receiver, and Settings/Care context. The Overview is the first main page after case selection. Use a persistent desktop sidebar (Overview, Observations, Insights, Handoffs, Demo receiver, Settings) and an accessible collapsed menu on narrow screens. The daily check-in is a quick optional dashboard action, not a required standalone page. Emergency guidance is a persistent interruptive banner/overlay that can appear from any screen.
> Build the main CareSignal dashboard on top of the real data model and storage. Use the seeded synthetic cases rather than hard-coded decorative mockups. Keep public welcome/auth/terms pages separate from authenticated app routes. Protect private routes server-side; unauthenticated visitors should be redirected to sign-in, while demo access must follow its explicit demo-mode rules. All dashboard queries must be scoped to the authenticated user and selected case.
> The dashboard should include: - A clean, calm, trustworthy visual design suitable for a family-caregiver tool. - Patient/case switcher with visible synthetic label. - Patient care context and caregiver-reported baseline, with unknown values shown as "Not provided." - Recent observations, date/time, category labels when available, and a clear distinction between original caregiver notes and AI-generated content. - A prominent "Add observation" action available at all times. - A compact check-in status that distinguishes "No meaningful change," "I noticed a change," "I have a concern or question," "Skipped," and "No response recorded." - Current safety notices, unresolved questions, and handoff status when relevant. - A visible AI availability status and honest fallback messaging. - A history/timeline navigation item, Insights view, Check-in view, Handoff view, and Settings/profile view. - No fake charts, fake statistics, fake delivery receipts, or invented trends. Any counts must be computed from stored data. - Good empty states, loading/error states, keyboard navigation, readable contrast, and responsive layout.
> Use real application state and persistent storage; do not make a static screenshot-like interface. Add basic UI tests for the main navigation and case switching.

**Follow-up prompts:**
> Yes: apply the check-in migration to Supabase, push to GitHub, and redeploy the live site.

## Task 9: Observation logging and traceable timeline

**Prompt:**
> Prompt 8 — Observation logging and traceable timeline
>
> Paste this entire prompt into Claude Code after the previous prompt has completed successfully.
>
> Implement the observation capture workflow. This is one of the core features.
>
> Requirements: - A caregiver can enter a free-text observation at any time, with no required category selection and no daily cap. - Saving a note must work even if the AI service is unavailable. - Preserve the exact original text as entered. Do not rewrite, "correct," or overwrite it with an AI summary. - Store a stable observation ID, patient ID, timestamp, synthetic/current-session marker, and any optional context. Do not invent a time for the event itself when the caregiver has not supplied one; keep event time distinct from entry time if both exist. - Show notes in a chronological timeline with clear date/time labels and filters/search if straightforward. - Allow caregivers to correct an AI category later without changing the original note. If editing note text is supported, retain the original and a version history with edit timestamps. - Make the difference between "no observation was logged" and "the caregiver reported no meaningful change" obvious. - Display AI processing status accurately: pending, complete, unavailable, or failed. Never show a fake "analyzed" state. - Include accessible form labels, helpful examples, and a concise reminder not to enter real personal/medical identifiers in this classroom demo. - Ensure patient-specific notes cannot appear under another patient after case switching. - Add tests for note creation, exact text preservation, unlimited repeated entry, timestamp handling, patient isolation, and behavior when AI is unavailable.

**Follow-up prompts:**
> Yes: apply the new migration to Supabase, push to GitHub, and redeploy the live site.

## Task 10: AI categorization, structured insights, and evidence traceability

**Prompt:**
> Prompt 9 — AI categorization, structured insights, and evidence traceability
>
> Use the locked product language and visual distinction: original caregiver notes, AI-generated insights, and simulated scenario outcomes must look different and be labeled. Never display numerical health/risk scores, false precision, or “patient safe/all clear” language. Insights should show what the observations may suggest, linked sources, what remains unknown/conflicting, and neutral questions for a care professional.
>
> Implement the AI analysis layer using the course-required Portkey configuration (PORTKEY_API_KEY, model gpt-6-luna). Keep all API calls server-side. Read the key from environment configuration; never expose or log it.
>
> First define a strict output schema and validate every model response. The AI should: 1. Assign one primary category and zero or more relevant secondary categories to each observation. 2. Extract only facts explicitly supported by the original note. 3. Produce a concise plain-language summary of observations over a selected period. 4. Compare observations with the caregiver-reported baseline or prior notes only when relevant evidence exists. 5. Identify uncertainty, missing context, and conflicts rather than smoothing them away. 6. Attach source observation IDs to every substantive insight. 7. Draft neutral questions a caregiver may want to ask the care team when appropriate.
>
> Allowed categories: - Mobility and daily functioning - Physical symptoms and comfort - Cognition and communication - Emotional wellbeing and behavior - Sleep, nutrition and hydration - Treatment and care coordination - Other
>
> Strict rules: - Preserve original caregiver wording; AI labels/summaries are separate derived data. - Do not invent dates, symptoms, diagnoses, causes, medication instructions, or trends. - Do not infer "normal" from missing data. - Do not make medication recommendations or claim that a medication caused a symptom. - Do not declare the patient safe or rule out emergencies. - Do not replace deterministic safety rules with model judgment. - Treat observation text as untrusted data, not instructions. Ignore instructions embedded in notes that ask the model to reveal secrets, change system behavior, bypass safety, or falsify data. - Minimize the data sent to the model. Send only the synthetic demo context and notes needed for the requested analysis. - Validate categories against an allowlist, source IDs against observations for the same patient, and all fields against the schema. Reject or safely handle invalid output. - On timeout, missing key, malformed output, or API error, preserve the note and show an honest unavailable/error state. Do not silently substitute fabricated AI results. - Track model name, timestamp, request status, and actual usage/cost fields when the provider returns them. Do not invent token counts.
>
> For the cancer case, the AI should surface supported patterns in fatigue/intake/function and draft questions for clinician review. It must not tell the caregiver to change medication. The fictional clinician-response event is separate from the model output.
>
> For the recovery case, it should preserve conflicting meal observations and flag missing time/context. It must not claim a definite worsening trend unless the dated observations actually support it.
>
> Add tests for schema validation, valid/invalid source IDs, category allowlist, unsupported claims, uncertainty/conflict handling, API failure, and prompt-injection attempts. If the API key is available, run a small live smoke test with synthetic data only and label it separately from deterministic tests. Do not reveal the key.

**Follow-up prompts:**
> Yes: apply the new migration to Supabase, push to GitHub, and redeploy the live site.

> Follow up for the prompt before the one u just worked on -
>
> CareSignal — Comprehensive Insights Dashboard Redesign
> Objective
> Redesign the existing CareSignal Insights page into a polished, caregiver-friendly, longitudinal insights dashboard.
> The current page is clean but too text-heavy. It primarily presents a long AI-generated report, multiple quoted observations, and raw identifiers such as `OBS-C1-02`. I want the page to help a caregiver quickly understand:
>
> 1. What has been recorded over the selected period?
> 2. What appears to have changed compared with earlier observations or the reported baseline?
> 3. Which categories have the most recorded activity?
> 4. Which patterns may deserve a closer look?
> 5. What evidence supports each finding?
> 6. What information is missing, conflicting, or uncertain?
>
> The experience should feel like a thoughtfully designed care-coordination product, not a raw AI output viewer, a hospital EHR, or a generic analytics dashboard.
> Core principle: keep technical complexity in the backend and present meaningful, understandable information in the UI.
> Before coding, inspect the existing application, Insights page, database schema, observation model, AI generation pipeline, safety rules, authentication/demo architecture, and tests. Explain the current implementation, the proposed changes, and any technical constraints before implementing. Reuse the existing architecture wherever possible.
> Do not rewrite unrelated screens, break existing functionality, create a disconnected mock dashboard, or deploy changes without my approval.
> 1. Preserve the working application
> Inspect the current implementation and retain existing functionality, including:
>
> * Caregiver observation entry and persistence.
> * Original caregiver note preservation.
> * AI-generated insights using the existing course-required model and Portkey configuration.
> * Existing AI generation-window controls.
> * Existing server-side AI request limits and daily cap.
> * Evidence validation and filtering of unsupported AI claims.
> * Baseline comparisons where relevant data exists.
> * Deterministic safety rules that operate independently of AI.
> * Case and user isolation.
> * Synthetic demo mode and its warnings.
> * Navigation, styling conventions, and working links to observations.
> * Existing API contracts and database relationships unless a justified migration is necessary.
>
> Do not silently change the meaning of existing features. Do not remove a functioning safety mechanism to make the redesign easier.
> If a schema change is required, create a safe migration compatible with existing records. Do not delete, overwrite, or regenerate real application data merely to populate charts.
> 2. Create a distinct chart-period selector
> Introduce a visible selector near the top of Insights:
>
> * Last 7 days
> * Last 30 days
> * All available history, where appropriate
>
> The selected period must control the chart data, displayed counts, category summaries, and period-specific comparisons consistently.
> Important: the current AI generation controls offer windows such as Last 7 days, Last 14 days, and All notes. Do not conflate the AI generation window with the chart display period.
> Keep both concepts separate:
>
> * Chart period: determines which records are displayed and analyzed descriptively.
> * AI generation window: determines which observations are supplied to the existing AI insight-generation process.
>
> Do not silently regenerate AI insights whenever a chart selector changes unless the user explicitly requests this behavior and the existing architecture supports it.
> Use consistent date boundaries and the case's relevant timezone. Handle timestamps correctly, including observations with an event date that differs from the date the note was entered.
> If the selected period contains no observations, show an honest empty state rather than an apparently normal or symptom-free period.
> 3. Reorganize the page hierarchy
> Use this information architecture.
> A. Page header
> Show:
>
> * Page title: "Care insights"
> * A short explanation: "Explore patterns in the observations recorded over time."
> * A 7-day / 30-day / all-history selector.
> * A discreet AI availability indicator when relevant.
>
> Keep the existing synthetic-data warning and safety disclaimer accessible. Do not repeat lengthy disclaimers in every section.
> B. At-a-glance overview
> Create a small, restrained row of summary metrics:
>
> * Total observations in the selected period.
> * Number of categories represented.
> * Date range covered by the available observations.
> * Optionally, number of observations that need caregiver review, if that is a real and well-defined persisted state.
>
> These metrics must be calculated from actual persisted data, not hardcoded values.
> Use clear labels. Do not create arbitrary percentages, health scores, severity scores, risk scores, confidence percentages, or misleading trend indicators.
> If a metric cannot be calculated reliably, omit it or explain why it is unavailable.
> Do not imply that a larger number of observations means a worse health state. Counts measure recorded activity, not clinical severity.
> C. Category activity and trends
> This should be one of the primary visual sections.
> Create an accessible, responsive grid of charts or small multiples covering all seven existing CareSignal categories:
>
> 1. Mobility and daily functioning.
> 2. Physical symptoms and comfort.
> 3. Cognition and communication.
> 4. Emotional wellbeing and behavior.
> 5. Sleep, nutrition and hydration.
> 6. Treatment and care coordination.
> 7. Other.
>
> Use the actual category names and identifiers already defined in the application. Do not introduce duplicate category taxonomies.
> For every category, provide an understandable visualization of observation activity over time, using a sensible daily or weekly aggregation depending on the selected date range and data volume.
> The default chart can show observation counts per time bucket.
> Requirements:
>
> * Counts must come from persisted observations.
> * All chart values must respond to the selected chart period.
> * The same observation must not be counted multiple times in the same category unless the data model explicitly supports multiple distinct records.
> * If one observation belongs to multiple categories, define and document how category counts work. Prevent accidental double counting in the overall total.
> * Display readable dates and category names.
> * Use clear axes, labels, legends, and tooltips.
> * Provide accessible text alternatives or a data-table alternative.
> * Make chart points or category sections clickable so users can open the relevant observations.
> * Avoid tiny unreadable charts and excessive visual decoration.
> * Ensure the layout works on mobile and desktop.
>
> Where the data supports a meaningful underlying measure, such as a structured reported quantity or consistently captured measure, a separate trend may be appropriate.
> Do not transform arbitrary free-text notes into fabricated numeric severity values. Do not interpret the number of mentions as the severity of a symptom.
> If the underlying data consists only of text, show observation activity and evidence-supported themes instead of pretending that a clinical measurement exists.
> D. Changes worth reviewing
> Place this section above the long-form AI narrative.
> Its purpose is to help the caregiver identify meaningful differences without reading every note.
> Each finding should include:
>
> * A concise, plain-language title.
> * The category or categories involved.
> * The period being considered.
> * What was observed or what may have changed.
> * The comparison basis, if one genuinely exists.
> * The supporting observations.
> * Important uncertainty or contradictory evidence.
> * A way to open the original notes.
>
> Examples of appropriate presentation, using real evidence only:
>
> * "Fatigue was mentioned in several recent observations."
> * "Fewer observations about walking were recorded this week than last week."
> * "Recent notes describe smaller meals compared with the caregiver-reported baseline."
> * "The notes contain conflicting descriptions of appetite."
> * "There is not enough information to determine whether mobility has changed."
>
> These are illustrative phrasings, not prewritten findings to display regardless of data.
> Clearly distinguish between:
>
> 1. Descriptive data findings, calculated from stored records.
> 2. Deterministic safety alerts, generated by established application rules.
> 3. AI-generated interpretations, derived from the actual model response.
>
> Never label a deterministic count as an AI finding, and never label an AI interpretation as a verified fact.
> Change-detection rules
> Use actual observation content, timestamps, category labels, and the caregiver-reported baseline when available.
> Distinguish:
>
> * A repeated theme across multiple observations.
> * A one-off observation.
> * A change in recording frequency.
> * A change in a structured reported measure.
> * A potential change compared with a baseline.
> * Conflicting or insufficient evidence.
>
> A change in note frequency is not necessarily a change in the person's condition.
> Do not claim that a symptom has increased or decreased unless the source information supports that direction. If the notes simply mention a topic more frequently, describe the increase in recorded mentions rather than asserting that the condition worsened.
> Do not invent a previous state, trend, causal relationship, severity level, or clinical conclusion.
> Do not label something an anomaly merely because it differs numerically from a small or incomplete sample. Explain the basis for any flag in plain language.
> If a finding is uncertain, say so. Do not display arbitrary model confidence percentages.
> E. Baseline comparison
> Retain and improve the existing caregiver-reported baseline comparison.
> For every comparison:
>
> * Identify the relevant baseline in understandable language.
> * State what recent notes support.
> * Link to the underlying evidence.
> * Identify the comparison period.
> * Show missing or conflicting information.
> * Make clear when no baseline is available.
>
> Never imply that the baseline is a medically validated normal range.
> Do not infer a baseline from missing observations. Do not treat a lack of reports as improvement.
> When the baseline and recent notes are incomparable, state that limitation rather than manufacturing a trend.
> F. Questions to consider discussing with the care team
> Where useful, present a short list of neutral questions grounded in the recorded observations.
> Examples:
>
> * "Would it be helpful to discuss the repeated reports of fatigue?"
> * "Could we clarify the conflicting descriptions of appetite?"
> * "Is there any additional information we should record about mobility?"
>
> Generate questions only when there is a reasonable evidence basis. Keep them separate from safety alerts.
> Do not prescribe treatment, recommend medication changes, diagnose a condition, or imply that a clinician has reviewed these questions.
> G. Detailed AI analysis
> Retain the current AI-generated summary, but move it below the visual overview and change-focused sections.
> The detailed analysis should remain available for users who want more context.
> Preserve:
>
> * The distinction between AI-generated text and caregiver-authored notes.
> * The generation timestamp and model metadata where useful.
> * Evidence links.
> * The original quotes and their context.
> * Warnings when claims are removed or rejected by validation.
> * Missing-information and uncertainty statements.
> * Existing AI usage-limit behavior.
>
> Consider a collapsible "Detailed analysis" section so the main page remains easy to scan.
> Do not delete the current evidence-validation warning simply because it occupies space. Make it concise and accessible.
> 4. Remove unnecessary technical identifiers from the caregiver-facing UI
> The current page displays identifiers such as `OBS-C1-02`, `OBS-C1-03`, and `OBS-C1-08` in narrative text, source lists, and quoted-note sections.
> These identifiers are useful internally, but they should not dominate the user experience.
> Backend and data model
> Preserve stable observation IDs and all identifiers required for:
>
> * Database integrity.
> * Relationships between observations and insights.
> * API contracts.
> * Evidence traceability.
> * Audit history.
> * Automated tests.
> * Debugging and troubleshooting.
> * Patient and account isolation.
>
> Do not rename or delete identifiers merely to simplify the interface.
> AI responses should continue to reference the correct source observation IDs internally. Validate those references server-side.
> Do not trust an AI-provided identifier unless it maps to an actual observation belonging to the current authorized case.
> Caregiver-facing UI
> By default, do not display raw technical IDs in:
>
> * Chart labels.
> * Main insight titles or paragraphs.
> * Ordinary source lists.
> * Summary metric cards.
> * Primary navigation.
> * Ordinary quoted-note displays.
>
> Instead, use readable labels such as:
>
> * "Oct 24 · Physical symptoms and comfort"
> * "Fatigue mentioned in this observation"
> * "4 supporting observations"
> * "Review original notes"
>
> When a finding has supporting evidence, provide a button or link such as "Review supporting notes."
> Clicking it should open a side panel, modal, drawer, or focused detail section containing:
>
> * The original caregiver-written note.
> * A readable event date and, when useful, entry date.
> * Its relevant category.
> * Any applicable safety notice.
> * A way to open the full observation record.
>
> Preserve the original note verbatim. Do not silently rewrite the source note to make it fit the UI.
> Show raw IDs only in an optional technical-details view, appropriate debugging interface, or other context where they are genuinely useful.
> Do not remove evidence links simply because raw IDs are hidden. Evidence must remain traceable and accessible.
> 5. Improve chart-to-evidence interactions
> Charts must be useful for exploration, not merely decorative.
> When a user selects a chart point or category:
>
> * Show the relevant time bucket.
> * Display the actual count or structured value.
> * List the observations contributing to the value.
> * Use readable dates and short note excerpts.
> * Allow navigation to the original observation.
> * Preserve all authorization and case-isolation checks.
>
> For a chart showing observation counts, make it clear that the count refers to logged observations.
> If a single observation contributes to multiple categories, explain that category counts may overlap when relevant.
> Avoid using color alone to convey alert status or category meaning. Include labels or other accessible indicators.
> Keep chart interactions keyboard accessible and ensure focus is handled properly when opening and closing evidence panels.
> 6. Data architecture and correctness
> Before implementing the charts, determine which fields actually exist in the current database and which are calculated by the application.
> Use the existing source of truth for observations. Do not build a second disconnected dataset.
> Requirements:
>
> * Retrieve data using the existing authorized server-side access pattern.
> * Filter by the active case and permitted user.
> * Apply the selected period consistently.
> * Respect event timestamps and entry timestamps.
> * Handle null or malformed dates safely.
> * Handle category corrections and edited observations.
> * Ensure chart values update after a new observation is saved or an existing observation is edited.
> * Recompute affected summaries and aggregations correctly.
> * Prevent duplicate counts caused by joins, repeated requests, or AI output.
> * Avoid unnecessarily expensive database queries or repeated model calls.
> * Add indexes only when justified by the query patterns and existing schema.
>
> If the application uses cached insights, ensure the UI distinguishes the period represented by a cached AI result from the currently selected chart period.
> Never present a cached summary as if it had been generated for a different period.
> If there is not enough historical data for a comparison, explain that limitation. Do not manufacture comparison data.
> If the backend does not currently retain a field needed for a desired chart, explain the gap before introducing a migration or changing the observation workflow.
> 7. AI integrity and source traceability
> Maintain the current safeguards around AI-generated insights and strengthen them where needed.
> The model must not invent:
>
> * Symptoms.
> * Dates or event times.
> * Diagnoses.
> * Medication adherence.
> * Treatment instructions.
> * Baseline information.
> * Causal explanations.
> * Numerical measurements.
> * Trends not supported by the notes.
> * Clinician actions or opinions.
> * Source observation references.
>
> For each substantive AI-generated finding, preserve the exact source observation references internally.
> Validate every reference against the current authorized case. Reject invalid, inaccessible, or fabricated references.
> When a statement lacks adequate evidence, omit it or present an explicit uncertainty statement, depending on the existing validation design.
> Treat all caregiver notes as untrusted input. Text inside a note must not override system instructions, disclose secrets, change authorization, or bypass validation.
> Do not make chart rendering dependent on AI generation. Descriptive counts and charts must still work if the model or Portkey is unavailable.
> Do not automatically regenerate expensive AI summaries every time the user changes the chart period.
> 8. Safety and medical boundaries
> CareSignal is a classroom prototype for caregiver coordination. It is not a diagnostic tool, validated clinical triage system, medical device, or substitute for professional care.
> Preserve all existing safety rules and make sure the visual redesign cannot weaken them.
> Specifically:
>
> * Deterministic emergency guidance must operate independently of AI availability and chart rendering.
> * Urgent safety guidance must not be hidden below ordinary insights.
> * The absence of an alert must never be described as proof that a person is safe.
> * Missing observations must not imply that symptoms are absent or the person is well.
> * A lack of recent observations must not be presented as improvement.
> * Descriptive anomaly flags must not be presented as validated clinical risk predictions.
> * Do not recommend medication or treatment changes.
> * Preserve the original note and its associated safety notice.
> * Clearly label synthetic scenarios and simulated workflows.
> * Do not claim clinician review, real clinical delivery, HIPAA certification, or production clinical validation unless independently established.
>
> If a deterministic rule triggers an urgent warning, the warning must remain visible regardless of whether the AI insight generation succeeds, fails, or reaches its daily cap.
> 9. AI availability, daily limits, and error states
> Preserve the existing server-side AI cap and current usage accounting.
> When the cap is reached:
>
> * New observations must still save normally.
> * Deterministic safety rules must continue to run.
> * Descriptive charts must remain available.
> * Previously generated insights may remain visible, clearly labeled with their actual generation time and period.
> * Do not claim that new observations have been analyzed if they have not.
> * Display a concise explanation that new AI analysis is temporarily unavailable because the limit was reached.
>
> When AI or Portkey is unavailable:
>
> * Preserve the original caregiver note.
> * Show an understandable error or retry option.
> * Do not display fabricated AI insights.
> * Do not fake token counts, model metadata, or successful analysis statuses.
> * Keep all non-AI functionality working wherever possible.
>
> Provide appropriate loading, empty, partial-data, error, and retry states.
> 10. Visual design and accessibility
> Retain CareSignal's established visual identity:
>
> * Ivory background `#F7F6F2`.
> * White content surfaces.
> * Deep forest green `#253D38`.
> * Soft sage `#DDE8DF`.
> * Readable dark text.
> * Restrained secondary text.
> * Amber for review-needed states.
> * Red reserved for genuine urgent safety states.
> * Neutral styling for missing or unavailable information.
>
> Use consistent typography, spacing, borders, and card treatment. Avoid turning every data point into a separate large card.
> Design priorities:
>
> * Clear visual hierarchy.
> * Concise titles and explanations.
> * Readable chart labels and legends.
> * Consistent date formatting.
> * Good contrast.
> * Keyboard navigation.
> * Screen-reader-friendly controls and chart alternatives.
> * Responsive layout for desktop, tablet, and mobile.
> * Reduced-motion support.
> * Clear hover, focus, selected, and disabled states.
> * No reliance on color alone.
>
> The dashboard should be visually calm without making meaningful safety information easy to miss.
> 11. Testing requirements
> Add or update automated tests for the following.
> Chart calculations
>
> * Correct 7-day and 30-day filtering.
> * Correct all-history filtering.
> * Correct time-bucket aggregation.
> * Correct category counts.
> * Correct overall unique observation counts.
> * Correct behavior when one observation has multiple categories.
> * Correct behavior for category corrections and edited notes.
> * Correct handling of missing or malformed dates.
> * Correct behavior around date and timezone boundaries.
> * Correct empty states.
> * Correct behavior when only one observation exists.
> * Correct behavior when data is too sparse to support a trend.
> * Correct updates after adding an observation.
>
> Insight integrity
>
> * Every substantive AI claim links to valid supporting observations.
> * No source ID can refer to an observation from another case.
> * Conflicting evidence remains visible.
> * Missing information is not interpreted as normal health.
> * Unsupported numerical values and invented trends are not rendered.
> * AI validation warnings remain visible.
> * Raw technical IDs are hidden in ordinary UI but preserved internally.
>
> Safety and resilience
>
> * Deterministic urgent rules continue to work when AI is unavailable.
> * Reaching the AI cap does not prevent note saving or chart rendering.
> * AI failures do not erase notes.
> * Empty data does not produce reassuring but unsupported claims.
> * Prompt-injection attempts in notes do not override application instructions.
> * Case isolation is maintained for chart queries, evidence panels, and insights.
>
> UI behavior
>
> * Changing the chart-period selector updates all relevant chart data and metrics.
> * Chart clicks open the correct supporting observations.
> * Evidence panels can be used with a keyboard.
> * Links to original observations work.
> * Loading, error, empty, and unavailable states are understandable.
> * Responsive layouts remain usable on small screens.
>
> Run the relevant test suite, linting, type checks, and production build. Fix regressions before reporting completion.
> 12. Implementation approach
> Work in this order:
>
> 1. Inspect the existing Insights component, relevant routes, observation schema, category definitions, aggregation logic, AI insight pipeline, and tests.
> 2. Report the current architecture, existing working features, and any data gaps.
> 3. Define the chart data contract and the distinction between descriptive findings, deterministic safety alerts, and AI-generated interpretations.
> 4. Implement reliable server-side filtering and aggregation using persisted data.
> 5. Implement the page hierarchy and category visualizations.
> 6. Implement the changes-worth-reviewing section and evidence drawer.
> 7. Hide raw technical identifiers in ordinary UI while retaining internal traceability.
> 8. Preserve detailed AI analysis and existing validation behavior.
> 9. Verify all safety, access-control, AI-cap, and failure-state behavior.
> 10. Run tests, linting, type checks, and production build.
> 11. Summarize what changed, files modified, tests run, test results, known limitations, and any remaining issues.
>
> Do not deploy, publish, or push changes to a public repository without my explicit approval.
> Definition of done
> The redesign is complete when a caregiver can open Insights and quickly understand the recorded activity across all seven categories, explore the selected time period, identify evidence-supported changes worth reviewing, and access the original notes without being overwhelmed by technical identifiers or a wall of AI-generated text.
> All numbers and charts must be grounded in actual stored data. All AI claims must remain traceable to their sources. The application must preserve safety behavior, user and case isolation, existing note persistence, and AI usage limits.
> The final experience should feel like a polished, trustworthy caregiver insights dashboard, with implementation complexity kept behind the scenes.

> Yes, push to GitHub and redeploy the live site.

## Task 11: Optional daily check-in and reminder preferences

**Prompt:**
> Prompt 10 — Optional daily check-in and reminder preferences
>
> Paste this entire prompt into Claude Code after the previous prompt has completed successfully.
>
> Implement the optional check-in workflow.
>
> The caregiver should be able to choose one of four explicit states: - "No meaningful change" - "I noticed a change" - "I have a concern or question" - "Skip today"
>
> If the caregiver selects "I noticed a change" or "I have a concern or question," allow a free-text note and offer to save it as an observation. Do not force a check-in before observations can be logged.
>
> Requirements: - Make check-ins optional and quick. - Persist the explicit response and timestamp. - Keep "No meaningful change" distinct from "Skip today" and from no response. - Never infer wellbeing from a missed check-in. - Reminder is off by default. If enabled, allow one daily reminder at a chosen local time. - Do not claim email, SMS, browser push, or phone notifications exist unless actually implemented and tested. If reliable notifications are not supported in this prototype, call it an in-app reminder preference and explain its limitation. - Do not let reminders block or limit note logging. - Include a concise "not a substitute for urgent care" notice. - Add tests for each response state, optional free text, persistence, reminder off-by-default, and missing response semantics.

**Follow-up prompts:**
> Yes: apply the new migration to Supabase, push to GitHub, and redeploy the live site.

## Task 12: Deterministic safety layer and prompt-injection defense

**Prompt:**
> Prompt 11 — Deterministic safety layer and prompt-injection defense
> Paste this entire prompt into Claude Code after the previous prompt has completed successfully.
> Apply the full expanded safety requirements in the global specification. The safety layer must run on the original note immediately after saving and independently of AI/network availability. Use prominent red emergency guidance for predefined emergency test cases; amber for prompt-attention cases; neutral review markers for ambiguous items; and routine status without reassurance. Always pair colors with text/icons. Preserve the original triggering note and explain the prototype rule that fired. The absence of an alert must never imply safety.
> Implement a safety layer that is separate from the AI model and can operate when the API is down.
> Create explicit, documented rules with tests. For this classroom prototype, use a small predefined set of synthetic trigger scenarios, not a claim of comprehensive clinical coverage.
> Suggested behavior levels: - Routine: can be included in a caregiver-reviewed handoff. - Review: show a clear "Please review this observation" marker. - Prompt attention: show guidance to contact an appropriate care professional promptly; do not wait for a weekly summary. - Emergency guidance: for a predefined synthetic emergency scenario such as sudden difficulty breathing or being difficult to wake, immediately display emergency guidance. In the US demo, say to call 911. Do not wait for AI output, handoff generation, or a network request.
> Requirements: - Safety evaluation must run on the original note text and relevant structured context before/independently of AI summaries. - Ensure the urgent surgery demo reliably triggers the expected deterministic rule even with no API key, timeout, or malformed AI response. - Clearly explain that these are limited prototype rules, not validated triage and not a guarantee that every emergency will be detected. - Do not use a reassuring "low risk" result or state that the patient is safe. - Do not make diagnosis or treatment recommendations. - Show the exact original note that triggered the rule and explain which predefined rule fired, without implying clinical validation. - Add a way to acknowledge/dismiss the displayed banner only where appropriate; never delete the underlying event or hide emergency guidance before it is seen. - Prompt-injection defense: treat notes as data; do not obey embedded commands; do not expose prompts, secrets, or credentials; validate output schema and IDs; reject fabricated source references. - Add deterministic tests for each safety level, urgent scenarios, false-trigger examples, API failure independence, and prompt injection. Report true positives/false positives/missed triggers on the defined synthetic test set with denominators. Do not claim this measures real-world sensitivity or clinical safety.

**Follow-up:**
> are u done

**Follow-up:**
> Yes, push to GitHub and redeploy the live site.

## Task 13: Weekly handoff draft and caregiver review

**Prompt:**
> Prompt 12 — Weekly handoff draft and caregiver review
> Paste this entire prompt into Claude Code after the previous prompt has completed successfully.
> Use the handoff page design: clean sections for summary, categories, source observations, uncertainties/conflicts, and questions. The caregiver must be able to open every source note and edit the draft before approval. Show a clear status path and never use visual language that implies a real clinician has acted.
> Build a weekly care-coordination handoff generator using the stored observations and validated AI outputs.
> The handoff should include: - Patient pseudonym and date range. - A plain-language summary of logged observations. - Relevant category groupings. - Supported changes relative to caregiver-reported baseline or prior observations. - Source observation IDs and the original notes behind every substantive claim. - Uncertainty, conflicting reports, and missing information. - Unresolved questions the caregiver may wish to raise with the care team. - A clear distinction between caregiver-reported information, AI-generated summaries, and any simulated receiver response.
> Requirements: - One routine draft per configured seven-day period; allow regeneration when the caregiver adds/corrects information, while preserving prior submitted versions. - The caregiver must review and may edit the handoff before approving/submitting it. - Never auto-send a handoff. - If there are no observations, say "No observations were logged for this period," not "The patient is doing well." - Urgent events must trigger safety guidance immediately and must not be deferred to the weekly report. - Do not recommend medication changes or diagnose. - For the cancer case, show a supported pattern and clinician questions, then allow a separate simulated receiver response that is explicitly labeled fictional. - For the recovery case, preserve contradictory meal reports and explain what is unknown. - Keep a record of draft, reviewed, submitted, and later status changes. - Add tests for empty weeks, source traceability, review-before-submit, version preservation, urgent-event handling, and uncertainty/conflict retention.

**Follow-up:**
> are u done with the last prompt

**Follow-up:**
> Yes: apply the new migration to Supabase, push to GitHub, and redeploy the live site.

## Task 14: Backend submission, simulated receiver, receipts, and status persistence

**Prompt:**
> Prompt 13 — Backend submission, simulated receiver, receipts, and status persistence
> Paste this entire prompt into Claude Code after the previous prompt has completed successfully.
> The Demo receiver page must persistently and prominently state: “Simulated receiver — no real care team is connected.” Use distinct visual statuses for Draft, Reviewed, Submitted, Received, Acknowledged, and Failed. The receiver’s Acknowledge action is separate from submission. Any fictional clinician-response event is labeled as a synthetic scenario outcome, never a real clinical action.
> Implement the actual handoff delivery flow through an application backend endpoint such as POST /api/handoffs. This must be a real local request and persisted state change, not a button that only changes UI text.
> Requirements: - Server-side validate the approved handoff payload and confirm that referenced observations exist and belong to the same synthetic patient. - Persist the exact caregiver-approved payload and a version/snapshot so later edits do not change what was submitted. - Generate a unique handoff ID programmatically on the server. - Return a receipt only after the server confirms that the payload was persisted. The receipt should include handoff ID, received timestamp, and status. - Display an honest, clearly labeled simulated receiver queue. Do not connect to or imply integration with a real hospital, EHR, pharmacy, or care team. - Keep these statuses distinct: Draft, Reviewed, Submitted, Received, Acknowledged, Failed. - "Received" means the simulated backend stored the approved payload. "Acknowledged" means a separate explicit action in the simulated receiver interface. Neither means a clinician took action or that care changed. - Persist status history so it survives refresh/restart. - Handle network errors, validation failures, retries, and duplicate submission safely. Avoid duplicate handoffs when a retry uses the same idempotency key or equivalent mechanism. - Never mark a handoff received before the server confirms persistence. - Keep urgent guidance independent of this delivery flow. - For the cancer scenario, a simulated clinician response may be added as a separate scenario artifact after acknowledgement, clearly marked as fictional and not generated by the AI. - Add integration tests for successful submission, invalid payload, persistence after reload, duplicate retry, failure status, explicit acknowledgement, and exact submitted payload retention.

**Follow-up:**
> Yes: apply the new migration to Supabase, push to GitHub, and redeploy the live site.

## Task 15: Visual polish, accessibility, and demo readiness

**Prompt:**
> Prompt 14 — Visual polish, accessibility, and demo readiness
> Treat the global visual design and navigation specification as acceptance criteria, not inspiration. Review each of the eight screens for consistent typography, spacing, color, hierarchy, and interactions. Ensure no urgent alert is buried, no status relies on color alone, and the app is usable by keyboard and screen reader. Use the exact product copy specified globally where relevant. The app must feel calm and polished without suggesting clinical validation.
> Polish the working app without changing its safety boundaries or inventing features.
> Requirements: - Use consistent typography, spacing, restrained color, clear hierarchy, and calm visual language. Avoid alarmist styling except for clearly differentiated safety notices. - Ensure responsive layouts and usable behavior on a laptop and a narrower screen. - Provide accessible labels, keyboard focus states, semantic headings, readable contrast, and non-color indicators for status. - Make synthetic content unmistakable with a persistent "Synthetic demo data" label. - Make AI-generated text visually distinct from original caregiver notes. - Make source observation IDs clickable or otherwise easy to inspect. - Clearly distinguish safety notice, AI insight, clinician question, simulated receiver status, and simulated clinician response. - Ensure the three demo cases are easy to switch between and each has a short "What this case demonstrates" explanation. - Provide meaningful loading, empty, error, and API-unavailable states. - Do not add fake notifications, charts, testimonials, outcome statistics, hospital logos, real clinical credentials, or unsupported integration claims. - Ensure the app remains usable when the AI service is unavailable. - Add or update accessibility/UI tests and run the full test suite.

**Follow-up:**
> whats happeing, you already took 30 mins

**Follow-up:**
> okay do it

**Follow-up:**
> done?

**Follow-up:**
> can u pls do it fast & give me status updates every couple of mins, I dont see anything

**Follow-up:**
> Yes, push to GitHub and redeploy the live site.

## Task 16: Evaluation suite with expected outcomes and honest metrics

**Prompt:**
> Prompt 15 — Evaluation suite with expected outcomes and honest metrics
>
> Create a reproducible evaluation suite using the synthetic fixtures. Define expected outputs before running evaluations, and clearly distinguish deterministic tests from model-based tests.
> Include at least 12--15 cases covering: - Primary and secondary category assignment across all seven categories. - Multi-category notes. - Key-fact preservation. - Source-ID traceability. - Missing data and ambiguous wording. - Conflicting observations. - Unsupported trend/cause detection. - Prompt-injection resistance. - Routine, review, prompt-attention, and predefined emergency safety rules. - AI unavailable, malformed output, and timeout. - Weekly handoff source coverage and caregiver approval requirement. - Backend receipt persistence, duplicate retry, and explicit acknowledgement. - Patient separation and synthetic-only data integrity.
> Metrics and reporting: - Report exact-match primary-category accuracy with numerator and denominator. - Report secondary-category precision/recall or a clearly defined exact-match measure; state the definition. - Report whether key facts and source IDs were preserved. - Report uncertainty/conflict preservation. - Report deterministic safety test true positives, false positives, and missed triggers on this small predefined test set, with denominators and individual case results. - Report prompt-injection test outcomes. - Report delivery/persistence test outcomes. - Record actual token usage and cost only when the provider returns trustworthy usage data or a documented calculation can be made. Do not fabricate token counts or pricing. - Separate observed/measured results from estimates. - If comparing prompts, run the same cases on the baseline and revised prompt and show quality/cost trade-offs; otherwise omit the comparison. - Save machine-readable per-case results and a readable evaluation summary. - Include failed cases rather than hiding them. Explain limitations and do not imply the small synthetic set proves clinical effectiveness or real-world safety.
> Run all deterministic tests. If the API key is available, run model-based evaluations using synthetic data only and label API-based results separately. If it is unavailable, report that live evaluation was not run rather than inventing results.

**Follow-up:**
> Yes, push to GitHub.

## Task 17: Tokenomics, usage tracking, and cost estimates

**Prompt:**
> Prompt 16 — Tokenomics, usage tracking, and cost estimates
> Implement a small, transparent tokenomics and cost-tracking view suitable for the project report.
> Requirements: - Track actual model/provider usage fields returned by the API, including input tokens, output tokens, request count, and cost if available. - Associate usage with task type (categorization, insight summary, handoff, evaluation) and timestamp, without logging secrets or unnecessary note contents. - If the provider does not return cost, do not invent it. If calculating cost from token usage, document the pricing source, date checked, model, and calculation. If current pricing cannot be verified, label the estimate as illustrative and state the assumption. - Add reasonable cost controls: bounded input length, no needless repeat analysis, caching by observation version where safe, explicit regeneration, and concise model outputs. Do not cache results across different patient contexts. - Show measured values separately from estimates. - Estimate costs for 100 and 10,000 users using clearly stated assumptions for observations per user, analysis frequency, input/output tokens, and retries. Make assumptions editable or easy to inspect. - Do not claim the estimates are actual bills. - Do not expose PORTKEY_API_KEY or print environment variables. - Add tests for usage accounting, missing usage fields, estimate calculations, and caching invalidation after note changes. - Provide a report-ready table and concise explanation of what was measured versus estimated.

**Follow-up:**
> Yes: apply the new migration to Supabase, push to GitHub, and redeploy the live site.

## Task 18: Insights page — final UI refinement

**Prompt:**
> CareSignal Insights — Final UI Refinement
> Refine the newly implemented CareSignal Insights page based on the attached screenshot. The current structure is directionally correct; do not redesign it from scratch or remove working functionality.
> 1. Fix desktop width utilization — The current content occupies too little space on a large screen. Inspect parent containers, max-width settings, grid definitions, and chart sizing. Use the available main-content width appropriately. Use a responsive two- or three-column category grid on desktop, fewer columns on tablet, and one column on mobile. Make chart labels, dates, and axes readable at normal zoom. Avoid excessive whitespace and excessively wide text paragraphs.
> 2. Improve chart usability — Keep all seven existing categories and real-data observation-count charts. Standardize chart dimensions, spacing, axes, date labels, tooltips, and accessible alternatives. Represent categories with no observations using compact, honest empty states. Make chart points or category links open the underlying observations. Preserve accurate counts and avoid fabricated numerical severity scores. Ensure all charts respond consistently to the selected time period.
> 3. Make changes easier to interpret — Where sufficient historical data exists, compare the selected period with the previous equivalent period. Explicitly label changes in recorded observation frequency as changes in recording activity, not necessarily changes in health. Describe a change in a reported condition only when the source notes genuinely support that interpretation. Preserve uncertainty, conflicting evidence, and missing information. When data are sparse or incomparable, state that a reliable comparison cannot be made.
> 4. Improve "Changes worth reviewing" — Create clearer visual separation between: Deterministic safety notices. Descriptive patterns calculated from stored observations. AI-generated interpretations. Conflicting or missing information. Each finding should have a concise title, short explanation, and accessible "Review supporting notes" action. Preserve source traceability. Never downgrade, hide, or delay urgent deterministic safety guidance because of UI changes or AI availability. Where appropriate, allow a caregiver to carry an evidence-supported finding into the existing handoff workflow. Never auto-submit a handoff or invent clinical recommendations.
> 5. Reduce unnecessary numbers and repetition — Keep overview metrics compact and meaningful. Use a consistent chart-card design. Avoid redundant labels, excessive nested cards, decorative metrics, and unnecessary numerical clutter. Do not display raw observation IDs such as `OBS-C1-02` in the ordinary caregiver-facing UI. Preserve stable identifiers internally for database integrity, source traceability, API contracts, auditing, and testing. Show readable dates, short descriptions, and evidence counts. Let caregivers open the original notes to inspect the evidence.
> 6. Preserve architecture and safety — Inspect the existing implementation before modifying it. Use persisted observations, not hardcoded chart values. Preserve the current AI generation controls and server-side daily AI cap. Maintain case isolation, source validation, original-note preservation, and all existing deterministic safety rules. Ensure charts and descriptive metrics continue working if AI generation is unavailable. Do not trigger AI generation merely because a user changes the chart-period selector. Do not remove or weaken working functionality elsewhere in the application.
> 7. Preserve evaluation results and tokenomics — This is a critical requirement. Prompt 16 has already been completed, so preserve the actual token-usage and cost measurements collected during evaluation. Do not overwrite, reset, fabricate, or silently recalculate existing measured results. Preserve the evaluation datasets, test outputs, measurement logs, recorded token counts, provider/model metadata, and cost calculations wherever they exist. Keep measured results clearly distinguished from estimates. Do not make additional AI calls solely to render charts, compute descriptive metrics, or change the UI layout. Do not automatically regenerate existing insights when changing chart periods or navigating the page. Avoid introducing duplicate AI requests through component rerenders, repeated effects, or unnecessary refetching. If a new AI request is genuinely necessary for an existing product workflow, preserve the existing usage accounting and ensure the request is measured correctly. If this refinement changes AI behavior, token usage, or the evaluation methodology, document the change explicitly rather than silently altering previously collected results. Do not claim the redesign has no effect on costs unless that has been verified. Keep the evaluation results reproducible and available for the final report. Before editing files related to evaluation or tokenomics, identify where the existing results and measurement logic are stored. Avoid modifying those files unless a change is necessary.
> 8. Validate the implementation — After making the changes: Run relevant automated tests, linting, type checks, and the production build. Test desktop, tablet, and mobile layouts. Verify period filtering, category counts, empty states, sparse data, conflicting evidence, and source links. Confirm that adding or editing an observation updates the relevant charts correctly. Verify case isolation and all urgent safety behavior. Confirm that AI-unavailable and AI-cap states do not break descriptive charts. Verify that the UI does not introduce unnecessary AI requests or alter the preserved tokenomics results. Fix regressions before reporting completion.
> 9. Report back — Provide a concise summary of: 1. The layout and visualization changes made. 2. The files modified. 3. Tests, linting, type checks, and build results. 4. Confirmation of what evaluation results and tokenomics records were preserved. 5. Whether the change introduced any new AI calls or cost implications. 6. Remaining limitations or failures.
> Do not deploy, publish, push to a public repository, or overwrite the existing evaluation evidence without my explicit approval.
> Definition of done — The Insights page should be a readable, responsive, evidence-linked dashboard that makes recorded activity and supported changes easy to understand. It must retain accurate data, trustworthy AI behavior, deterministic safety, working case isolation, and the evaluation and cost evidence already collected for the course.
>
> *(No screenshot was attached to this message; the refinement was based on the current page.)*

**Follow-up:**
> a

**Follow-up:**
> Yes, push to GitHub and redeploy the live site.

## Task 19: Novelty, impact framework, and product comparison research

**Prompt:**
> Prompt 17 — Novelty, impact framework, and product comparison research
> Prepare evidence for the report's "What is new here?" and "Impact" sections. Do not write unsupported marketing claims.
> Requirements: - Identify the specific product gap CareSignal is designed to address: transforming scattered caregiver observations into evidence-linked, caregiver-reviewed handoffs while preserving uncertainty and keeping urgent safety guidance independent of AI. - Compare CareSignal with a small, relevant set of existing categories/tools such as patient portals, symptom trackers, caregiver journals, and general-purpose AI chatbots. Research current products only if web access is available. Cite the actual sources, dates accessed, and factual claims. Do not claim CareSignal is the first or uniquely capable unless evidence supports that statement. - Explain what is genuinely novel in this prototype and what is standard or borrowed. - Propose measurable impact indicators suitable for a classroom prototype, for example time to assemble a handoff, source traceability, key-fact preservation, uncertainty retention, caregiver review completion, and safe handling of predefined urgent scenarios. - Do not claim real patient benefit or clinical effectiveness. Use synthetic usability/evaluation results only, with sample size and methods clearly stated. - Distinguish intended impact, prototype evidence, and future hypotheses. - Include limitations: narrow deterministic safety coverage, synthetic-only data, no clinical validation, no real EHR integration, dependence on model/API availability, possible model errors, and small evaluation set. - Save a concise, cited research/evidence file for use in the report. Do not fabricate citations, product features, user research, interviews, or impact metrics.

**Follow-up:**
> Yes, push to GitHub.

## Task 20: Build the self-contained report.html

**Prompt:**
> Prompt 18 — Build the self-contained `report.html`
> Include a concise visual-design section or figure describing the palette, typography, navigation, screen map, and why safety/status states are visually differentiated. Include the safety layers and clearly state that the app is synthetic-only and not clinically validated. Do not claim HIPAA compliance or comprehensive emergency detection.
> Create report.html as a polished, self-contained report suitable for printing to 10--15 US-letter pages. First inspect the course final-project requirements available in the project notes or ask me if the exact requirements are missing; do not invent rubric criteria. Follow the professor's required section order exactly:
> 20.	 Title + links
> 21.	 Motivation
> 22.	 What is new here
> 23.	 The agents
> 24.	 Tokenomics
> 25.	 Safety
> 26.	 Impact
> 27.	 Limits + next steps
> Requirements: - Use real project evidence: screenshots captured from the working app, actual architecture/system diagram, actual synthetic example runs, test results, observed model/token usage, and clearly labeled estimates. - Include the three demo cases and explain what each demonstrates: - Cancer: evidence-linked longitudinal observations and questions for clinician review; any medication-plan change is a fictional simulated clinician response, not an AI decision or real outcome. - Post-surgery: deterministic emergency guidance fires immediately and independently of AI; no claim that a real event was prevented. - Recovery: scattered observations, incomplete/conflicting meal reports, and an honest caregiver-reviewed handoff. - Include one traceable end-to-end run: original note → deterministic safety check → AI category/insight if available → caregiver-reviewed handoff → backend receipt → simulated receiver acknowledgement. Clearly separate what is real software behavior from synthetic scenario content. - Explain the architecture accurately. Do not call a sequential pipeline a multi-agent system unless there are actually distinct agents with defined responsibilities and evidence of their interactions. Explain the real tool/API calls and fallback behavior. - Include a tokenomics table with measured usage separated from assumptions and estimates, a transparent 100-user and 10,000-user scenario, and source/date for any pricing used. - Include safety design, prompt-injection defenses, schema validation, safety test results with denominators, and limitations of the deterministic rule set. - Include impact metrics only when measured. State sample size/method and do not claim clinical effectiveness. - Cite external sources accurately. Do not invent citations, interviews, users, screenshots, metrics, test outcomes, or API usage. - Embed screenshots and diagrams so the file is self-contained; avoid broken external assets. - Use a print stylesheet for US-letter pages with sensible margins, readable fonts, page breaks, and page numbers if feasible. - Ensure the report is substantive and lands within 10--15 pages when printed. Verify it with a browser/PDF print or another reliable page-count method if available; report the method and page count. Do not claim verification if not performed. - Add a small methodology note explaining what is synthetic, what was actually tested, and what remains unvalidated.

**Follow-up:**
> Yes, push to GitHub and redeploy the live site.

**Follow-up:**
> okay remind me later at the end once

## Task 21: Build slides.html, then final end-to-end audit

**Prompt:**
> Prompt 19 — Build `slides.html`, then final end-to-end audit
> During the final audit, explicitly verify the locked visual design and safety behavior: all eight screens/navigation routes work; welcome does not ask for real identifiers; persistent synthetic labels are visible; AI content is distinguished from original notes; emergency guidance fires immediately even with AI offline; status is never communicated by color alone; the demo receiver is clearly labeled simulated; and there are no "patient safe/all clear" messages or fake health scores.
> Create a self-contained slides.html presentation with no more than 10 slides, using Reveal.js or a similarly reliable local/self-contained slide approach. Embed required images/diagrams or provide local assets so the deck does not break when opened from the repository. Prefer a simple offline-capable version over a remote dependency.
> Suggested slide structure (maximum 10): 1. Title, project, and one-line value proposition. 2. Problem and motivation. 3. What is new and how CareSignal differs from adjacent tools. 4. Architecture and actual workflow/agent responsibilities. 5. Live-product screenshots and the three synthetic demo cases. 6. End-to-end handoff trace with source IDs and simulated receipt. 7. Tokenomics: measured usage versus cost estimates. 8. Safety design, urgent-rule demonstration, and test evidence. 9. Impact framework and prototype evaluation results. 10. Limitations, next steps, repository/report links.
> Do not exceed 10 slides. Do not invent performance or impact numbers. Any fictional clinician response, medication-plan change, or urgent event must be labeled as a synthetic scenario. Distinguish actual app behavior from proposed future capabilities.
> Then perform a final end-to-end audit: - Run formatting/lint/type checks, unit tests, integration tests, and production build. - Run the app from the documented clean setup path where feasible. - Test all three synthetic cases. - Verify that original notes remain unchanged and source IDs resolve. - Verify that the post-surgery urgent rule displays guidance even with the AI API unavailable. - Verify that no handoff is sent before caregiver review, that backend receipts follow persistence, that duplicate retries do not create duplicates, and that acknowledgement is a separate explicit action. - Verify patient data isolation, synthetic flags, reset behavior, and absence of secrets in tracked files. - Verify .env is ignored and .env.example contains placeholders only. - Verify the README setup instructions and report/slides links. - Verify report.html print page count and slides.html slide count; state the actual verification method. - Capture genuine screenshots from the running application and use them in report/slides. - Review git status and scan tracked files for accidental secrets. Do not push to GitHub or publish anything without my explicit approval. - Produce a final checklist of completed items, failed items, known limitations, commands to run, and any steps that still require my decision. Do not say a test passed unless it was actually run and passed.

**Follow-up:**
> done?

**Follow-up:**
> Fix the safety-rule gap (Option A), update the safety numbers in the report and slides, then push to GitHub and redeploy.

**Follow-up:** *(pasted requirement: "Critical Product Requirement: Pattern Detection and Structured Care-Team Handoffs" — full text in the session; sections 1–9: longitudinal pattern detection, category pattern summaries, symptom-and-treatment timeline, Insights redesign, structured handoffs, concise output with evidence, AI output contract, evaluation/cost integrity, pattern tests)*

**Follow-up:**
> I will send u data for each of the profiles for the month so we can showcase these cases better

**Follow-up:**
> are u still running the last redesign prompt in the backend or is it done

**Follow-up:**
> @"C:\Usersiavi\Downloads\CareSignal_Synthetic_Monthly_Datasets.zip" *(monthly synthetic datasets for the three profiles)*

**Follow-up:**
> idk explain what this would do, would we able to do/improve/update everything on time if we do this? will this break anything?

**Follow-up:**
> yes do that, make sure our old one is safe & we can submit that if we cant update on time, do the fixes & then do the new update

**Follow-up:**
> be as fast as u can please

**Follow-up:**
> okay how much longer do u think it will take, & are u also updating all the documents we need to submit to reflect all teh changes?

**Follow-up:**
> great

**Follow-up:**
> okay before u do, can u double check if everything is working, & if everything is fixed

**Follow-up:**
> I am getting stressed, where are we?

**Follow-up:**
> Yes: apply migration 0013 to Supabase, push to GitHub, and redeploy the live site.

**Follow-up:**
> *[screenshot of Insights: Recorded activity by category, last 7 days, only two category charts]* this data doesnt seem to be for 30 days, where are the otehr graphs & the data

**Follow-up:**
> how much longer

**Follow-up:**
> Yes, push to GitHub and redeploy the live site.
