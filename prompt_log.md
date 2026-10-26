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
