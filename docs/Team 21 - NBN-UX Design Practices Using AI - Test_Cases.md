Test Cases – Shared AI Collaboration
Workspace
Project 21 | NBN – UX Design Practices Using AI | Sprint 1

Testing Approach

Everything here will be tested manually against a deployed staging site, not localhost. The core
behaviour that is being tested (the BA to UX handoff) relies on AI-generated compressed context
rather than fixed input and output pairs. Each case below is written so anyone on the team can pick
it up, follow it and mark it as a pass or fail without having it explained to them.

Test Cases

TC-1 – BA's work shows up in the UX session

Does what the BA put in reach the UX designer without having to be copy and pasted across?

Requirement

FR-3, FR-4

Preconditions

BA and UX are both members of the same project. The project starts
with no context.

Steps

1.  As the BA, open the project and talk to the AI.
2.  Give it long enough to hit a write trigger.
3.  Switch to the UX user, open the same project, and start a fresh

session.

Expected result

The UX session opens already knowing what the BA discussed, with the
BA's part clearly marked as theirs. Nothing was manually shared.

  Pass
  Fail

Status

Notes / actual

TC-2 – UX doesn't see work that hasn't been saved yet

Session-boundary sync is currently a design choice not a bug, this test makes sure that the ‘gap’
behaves the way that we decided it should, rather than us mistaking it for something broken later.

Requirement

FR-4

Preconditions

The BA has typed something but hasn't yet crossed any write trigger.

1.  As the BA, send a single short message - not enough to trip a

Steps

trigger.

2.  Immediately open the project as the UX user.

Expected result

UX doesn't see that last unsaved message, because it hasn't been
written yet. If that's what happens, the case passes — this is expected,
not a failure.

Status

Notes / actual

  Pass
  Fail

TC-3 – You can tell who wrote what

If contributions blur into one anonymous lump, the handoff loses its value. This checks that
attribution survives.

Requirement

FR-6

Preconditions

Both BA and UX can access the same project.

Steps

1.  Have both the BA and UX add something to the same project.
2.  Open the merged context and look at how it's laid out.

Expected result

Each person's contribution is labelled as theirs, you can see at a glance
which part came from the BA and which from UX.

Status

Notes / actual

  Pass
  Fail

TC-4 – It still works after a couple of rounds

One handoff is the demo; real world use is a back and forth. This makes sure context keeps
stacking correctly instead of getting lost or overwritten on a second lap.

Requirement

FR-3, FR-4, FR-6

Preconditions

BA and UX are both members of the same project.

Steps

1.  BA adds something; check it reaches UX.
2.  UX builds on it and adds their own.
3.  Go back to the BA and start a new session.

Expected result

The BA now sees both their earlier work and what UX added, each still
attributed to the right person.

Status

Notes / actual

  Pass
  Fail

Edge cases (from the requirements doc)

EC-1 - Two people writing at once

Because each person writes to their own section rather than one shared field, simultaneous edits
shouldn't collide.

Requirement

Edge case / FR-2

Preconditions

BA and UX are both actively chatting in the same project at the same
time.

Steps

1.  Get both users chatting in the same project simultaneously.
2.  Line it up so both hit a write trigger at roughly the same moment.

Expected result

Both contributions save cleanly, each under the right person's section.
Neither clobbers the other.

Status

Notes / actual

  Pass
  Fail

EC-2 - Log out, come back, nothing lost

Context lives in the database, so a logout shouldn't wipe it. Quick but important,  it's the difference
between a real tool and a toy.

Requirement

FR-5

Preconditions

The user has already contributed to a project.

Steps

1.  Contribute to a project.
2.  Log out.
3.  Log back in and reopen the same project.

Expected result

Everything's still there, their own contribution and the rest of the
project's context. Nothing dropped.

Status

Notes / actual

  Pass
  Fail

EC-3 - A newcomer sees what already happened

Someone joining midway shouldn't land on a blank page, they should walk into the conversation
already in progress.

Requirement

Edge case / FR-3

Preconditions

A project already has context in it from the BA.

Steps

1.  Invite a new member (say, UX) to the project.
2.  Have them open it for the first time.

Expected result

Their first session is seeded with everything already there, not an empty
slate.

Status

Notes / actual

  Pass
  Fail

EC-4 - A dropped connection doesn't corrupt anything

Networks fail mid-write. What we care about is that a failure leaves things clean, never half-written.

Requirement

Edge case / FR-5

Preconditions

A user is chatting and a write trigger is about to fire.

Steps

1.  Kill the connection (e.g. disable the network) right as a write

would happen.

Expected result

Nothing broken or half-saved lands in the database. The write either
finishes once the connection's back or doesn't happen at all, no in-
between.

Status

Notes / actual

  Pass
  Fail

EC-5 - Empty and oversized both cope

The two ends of the range: a brand-new project with nothing in it, and a long-running one with a lot.
Both should hold up.

Requirement

Edge case

Preconditions

Empty: a fresh project. Large: a long conversation well past several save
cycles.

Steps

1.  Empty: open a brand-new project with nothing in it yet.
2.  Large: push a conversation well past several write cycles.

Expected result

The empty project loads fine with a sensible blank state. The large one
stays readable and the app doesn't choke as it grows.

Status

Notes / actual

  Pass
  Fail

EC-6 - Logged-out users get bounced

Nobody who isn't signed in should get anywhere near a project's data.

Requirement

Edge case / FR-1

Preconditions

The user is logged out.

Steps

1.  Log out.
2.  Try to hit a project URL directly.

Expected result

Redirected to login, and no project or context data comes back with the
response.

Status

Notes / actual

  Pass
  Fail

EC-7 - Signed in, but not on this project

Being logged in isn't the same as being allowed in. And we don't want to leak that a project even
exists - otherwise someone could fish for valid IDs.

Requirement

Access control (added this sprint)

Preconditions

The user is logged in but isn't a member of the project they're aiming at.

Steps

1.  Log in as someone who isn't a member of a given project.
2.  Try to open that project's URL directly.

Expected result

They get sent back to their own project list, no error, and no hint the
other project exists.

Status

Notes / actual

  Pass
  Fail

