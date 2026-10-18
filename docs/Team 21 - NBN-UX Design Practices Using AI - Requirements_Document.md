Requirements – Shared AI Collaboration Workspace

Project 21 | NBN – UX Design Practices Using AI | Sprint 3

# Problem Statement

When teams use AI tools individually, each person works in an isolated chat with no shared context. Work must be manually copied and handed between roles, which breaks continuity and loses the reasoning behind decisions. NBN wants to see whether a shared AI workspace – where each role session reads and writes the same context – can remove those handovers and keep work connected as it moves between people.

# Target Users

Members of a project delivery team who work in sequence on the same piece of work and currently hand off between AI sessions – specifically the BA and UX roles (a BA producing requirements, a UX designer building on them). More broadly, any NBN teams where one person‘s AI-assisted output becomes another person's starting point.

# Proposed Solution (context)

A shared, persistent AI collaboration workspace where every role’s AI session reads from and writes to the same context. Instead of individual chats, the workspace maintains unified context across all users, letting people create and refine output or build on each other’s work without losing continuity or needing manual handovers.

# Functional Requirements

The core capabilities the workspace must provide:

|  |  |  |
| --- | --- | --- |
| **ID** | **Requirement** | **Notes / rule** |
| **FR-1** | A user can sign up and log into the workspace. | Multi-user Auth (Firebase). Distinct identity per user. |
| **FR-2** | Multiple users can be active against the same shared session/context. | Context is not siloed per chat. |
| **FR-3** | Context written by one role’s AI session is readable in another role's session. | Core mechanic – shared read/write context. |
| **FR-4** | A BA’s requirements of output appear in the UX designer’s session without manual copy/paste. | The Sprint 2 feature to prove: demonstrated for BA – UX. |
| **FR-5** | Shared context persists across sessions (not lost on logout/refresh). | Backed by Firestore storage. The shared context is compressed and persisted, not raw chat transcripts (per the Technical Design Document) |
| **FR-6** | Each contribution is attributable to the user/role that made it. | So, handoffs are traceable. |
| **FR-7** | Artifacts created during an AI session are shared and readable in another role’s session. | Artifacts are not lost. Firestore data model designed, UI surfacing and notifications scheduled for Sprint 2. |

**Access rule:** Only the PM can invite or add members to a project. The invite/add action is only available to the PM; other roles cannot add members. Roles are assigned on a per project basis when a member is invited per the Technical Design Document.

**Project management (updated Sprint 2):** Projects are archived rather than deleted - an archived project is retained (not destroyed) and no longer accepts new messages, so its context is preserved. The project description is editable by the PM only; other roles cannot change it.

# Candidate Main Feature for Sprint 2 (BA – UX handoff)

The single feature, Sprint 2 will build end to end to prove the concept. A BA’s requirements, produced in their sessions, appear in the UX designer’s session with no manual sharing. This is the concrete demonstration of FR-3 and FR-4 and the proof point for the whole shared-context idea.

# Edge Cases

Core edge cases (validated in the Sprint 1 Test Plan)

* Two users write to the shared context at the same time – changes must not overwrite each other silently.
* A user logs out and back in – shared context persists and is restored (FR-5).
* A new user joins mid-session – they see existing shared context, not a blank state.
* Failed / dropped connections during a write – partial or lost updates handled gracefully.
* Empty or very large context payload – workspace still loads without breaking.
* Unauthenticated user tries to access the workspace – blocked, redirected to login.
* Authenticated user tried to access a project that they are not a member of – redirected back to their own project list, with no error and no indication the project exists (prevents probing for valid project IDs)

Notification / Handoff edge cases (from UX design)

* Many unseen files on login (10+) - badge shows ‘9+’ instead of an exact amount.
* User is offline while files are being generated – badge count updates on return to session instead of spamming pop-up notifications.
* Files tab already opens when a new file is being generated – no badge is shown, file appears at the top of the list.
* Duplicate file name – backend appends a number at the end of the filename (e.g requirements.txt, requirements\_(2).txt)

# Notification / Handoff Awareness

When another user’s AI sessions adds a contribution or an artifact to the shared project other members are to be made aware through a combination of a toast popup (showing the file name plus the contributing user and role) and a persistent indicator badge on the files tab. This gives immediate context without forcing the user out of their current chat, while the bade ensures nothing is missed if a toast is dismissed. Chosen by the UX designer from three researched patterns, the dedicated activity feed option was not selected due to being too detached from the files tab.

# Scope

**In scope:** Working multi-user login and shared context/session. The shared workspace concept demonstrated through the BA to UX handoff use case, validated through usability studies.

**Out of scope:** Full production rollout across NBN**.** Integration with NBN’s internal systems.

# Success Criteria

By end of term, a BA’s requirements produced in one session appear in a UX designer’s session with no manual sharing, running live on deployed infrastructure. The BA to UX handoff is demonstrable end to end and validated through usability studies, and NBN can see the shared context concept works well enough to judge whether it’s worth pursuing further.

# Success Metrics

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
| # | Metric | How it's measured | Target | Source |
| 1 | Handoff time | Time from the BA finishing requirements to those requirements being available in the UX session, with no manual steps | Under ~2 min (bounded by the write-trigger backstop) | MVP |
| 2 | Manual steps in handoff | Count of manual actions needed to move context BA to UX (copy, paste, export, re-send) | 0 manual steps | MVP |
| 3 | Information retained | Percentage of the BA's key requirement points that appear, correctly, in the UX session's context | ≥ 90% of key points | MVP |
| 4 | Attribution accuracy | Percentage of context entries correctly labelled with the right contributor and role (FR-6) | 100% correctly attributed | MVP |
| 5 | Task success rate | Percentage of usability-test participants who complete the BA to UX handoff flow unaided | ≥ 80% complete unaided | Usability test |
| 6 | Perceived usefulness | Post-task rating from usability-test users (“the handoff saved manual work”, 1–5 scale) | Average ≥ 4 / 5 | Usability test |

Source column:

* “MVP” = measured directly against the deployed build.
* “Usability test” = measured through the Sprint 3 usability sessions (metrics 5 and 6 depend on those sessions running).

# Assumptions and Constraints

No formal written brief has been issued by NBN. The initial client discussion is treated as the brief. The team sets its own scope with guidance from Alessio and Leon. No fixed technical requirement beyond a multi-user system. AI may be used in development provided the team is transparent about what was built manually and what was AI generated.

# Ethics and Limitations

**Transparency of AI use:** All AI-generated content in the workspace is attributed to the user/rile that prompted it (per FR-6), and the team remains transparent on what was built manually and what was generated by AI during development.

**Data privacy**: Shared context is scoped per project and access-controlled; only invited project members can read or write to a project context. No NBN internal systems or production data are integrated.

**Known limitations:** The current design uses session boundary sync – a user picks up a teammates latest context when they start a new session, not live while both are active. A live sync option is currently under investigation. Artifact sharing (FR-7) has its Firestore data model designed; the UI and cross role notifications are scheduled for Sprint-2.