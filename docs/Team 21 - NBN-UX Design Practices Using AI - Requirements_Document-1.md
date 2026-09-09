Requirements – Shared AI Collaboration
Workspace
Project 21 | NBN – UX Design Practices Using AI | Sprint 1

Problem Statement

When teams use AI tools individually, each person works in an isolated chat with no
shared context. Work must be manually copied and handed between roles, which breaks
continuity and loses the reasoning behind decisions. NBN wants to see whether a shared
AI workspace – where each role session reads and writes the same context – can remove
those handovers and keep work connected as it moves between people.

Target Users

Members of a project delivery team who work in sequence on the same piece of work and
currently hand off between AI sessions – specifically the BA and UX roles (a BA producing
requirements, a UX designer building on them). More broadly, any NBN teams where one
person‘s AI-assisted output becomes another person's starting point.

Proposed Solution (context)

A shared, persistent AI collaboration workspace where every role’s AI session reads from
and writes to the same context. Instead of individual chats, the workspace maintains
unified context across all users, letting people create and refine output or build on each
other’s work without losing continuity or needing manual handovers.

Functional Requirements

The core capabilities the workspace must provide:

ID
FR-1

FR-2

Requirement
A user can sign up and log
into the workspace.
Multiple users can be active
against the same shared
session/context.

Notes / rule
Multi-user Auth (Firebase).
Distinct identity per user.
Context is not siloed per
chat.

FR-3

FR-4

FR-5

FR-6

FR-7

Context written by one
role’s AI session is readable
in another role's session.
A BA’s requirements of
output appear in the UX
designer’s session without
manual copy/paste.
Shared context persists
across sessions (not lost on
logout/refresh).

Each contribution is
attributable to the user/role
that made it.
Artifacts created during an
AI session are shared and
readable in another role’s
session.

Core mechanic – shared
read/write context.

The Sprint 2 feature to
prove: demonstrated for BA
– UX.

Backed by Firestore
storage. The shared context
is compressed and
persisted, not raw chat
transcripts (per the
Technical Design
Document)
So, handoffs are traceable.

Artifacts are not lost.
Firestore data model
designed, UI surfacing and
notifications scheduled for
Sprint 2.

Access rule: Only the PM can invite or add members to a project. The invite/add action is
only available to the PM; other roles cannot add members. Roles are assigned on a per
project basis when a member is invited per the Technical Design Document.

Candidate Main Feature for Sprint 2 (BA – UX handoff)

The single feature, Sprint 2 will build end to end to prove the concept. A BA’s requirements,
produced in their sessions, appear in the UX designer’s session with no manual sharing.
This is the concrete demonstration of FR-3 and FR-4 and the proof point for the whole
shared-context idea.

Edge Cases

Core edge cases (validated in the Sprint 1 Test Plan)

•  Two users write to the shared context at the same time – changes must not

overwrite each other silently.

•  A user logs out and back in – shared context persists and is restored (FR-5).

•  A new user joins mid-session – they see existing shared context, not a blank state.
•  Failed / dropped connections during a write – partial or lost updates handled

gracefully.

•  Empty or very large context payload – workspace still loads without breaking.
•  Unauthenticated user tries to access the workspace – blocked, redirected to login.
•  Authenticated user tried to access a project that they are not a member of –

redirected back to their own project list, with no error and no indication the project
exists (prevents probing for valid project IDs)

Notification / Handoff edge cases (from UX design)

•  Many unseen files on login (10+) - badge shows ‘9+’ instead of an exact amount.
•  User is offline while files are being generated – badge count updates on return to

session instead of spamming pop-up notifications.

•  Files tab already opens when a new file is being generated – no badge is shown, file

appears at the top of the list.

•  Duplicate file name – backend appends a number at the end of the filename (e.g

requirements.txt, requirements_(2).txt)

Notification / Handoff Awareness

When another user’s AI sessions adds a contribution or an artifact to the shared project
other members are to be made aware through a combination of a toast popup (showing the
file name plus the contributing user and role) and a persistent indicator badge on the files
tab. This gives immediate context without forcing the user out of their current chat, while
the bade ensures nothing is missed if a toast is dismissed. Chosen by the UX designer from
three researched patterns, the dedicated activity feed option was not selected due to
being too detached from the files tab.

Scope

In scope: Working multi-user login and shared context/session. The shared workspace
concept demonstrated through the BA to UX handoff use case, validated through usability
studies.

Out of scope: Full production rollout across NBN.  Integration with NBN’s internal
systems.

Success Criteria

By end of term, a BA’s requirements produced in one session appear in a UX designer’s
session with no manual sharing, running live on deployed infrastructure. The BA to UX
handoff is demonstrable end to end and validated through usability studies, and NBN can
see the shared context concept works well enough to judge whether it’s worth pursuing
further.

Assumptions and Constraints

No formal written brief has been issued by NBN. The initial client discussion is treated as
the brief. The team sets its own scope with guidance from Alessio and Leon. No fixed
technical requirement beyond a multi-user system. AI may be used in development
provided the team is transparent about what was built manually and what was AI
generated.

Ethics and Limitations

Transparency of AI use: All AI-generated content in the workspace is attributed to the
user/rile that prompted it (per FR-6), and the team remains transparent on what was built
manually and what was generated by AI during development.

Data privacy: Shared context is scoped per project and access-controlled; only invited
project members can read or write to a project context. No NBN internal systems or
production data are integrated.

Known limitations: The current design uses session boundary sync – a user picks up a
teammates latest context when they start a new session, not live while both are active. A
live sync option is currently under investigation. Artifact sharing (FR-7) has its Firestore
data model designed; the UI and cross role notifications are scheduled for Sprint-2.

