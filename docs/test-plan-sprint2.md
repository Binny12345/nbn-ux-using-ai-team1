# Test Plan
Project 21 | NBN – UX Design Practices Using AI | Sprint 1 


## Testing Approach
**Manual testing**

### Reasoning:
The core thing we're testing (BA → UX handoff) relies on AI-generated/compressed content, not fixed input-output pairs, so it's hard to write meaningful automated assertions without just testing the plumbing around the AI rather than whether it actually works properly.

We already have proof manual testing matters for this team, in the Task 2 mock sprint I found a real redirect bug that only showed up through manual testing, lint/typecheck/build all passed the whole time it was broken. That's good evidence manual testing catches real issues here, not just a fallback option.

Given where we're at with Firebase/Firestore experience and Sprint 2's timeline, setting up a proper automated suite (Firestore emulator, mocked AI responses etc) would take more time than we can afford right now.

Testing will be done against the deployed staging environment, not localhost.


## Test Cases: FR-3 / FR-4 (BA → UX Handoff)
### TC-1: BA contribution appears in UX's session
**Preconditions**: BA and UX are both members of the same project, project has no existing context.

**Steps**:
1.	BA opens the project, starts a conversation with the AI, provides requirements input over several turns.
2.	Wait for at least one write trigger to fire (per-turn threshold, size threshold, or 2-minute backstop).
3.	UX opens the same project and starts a new session.

**Expected result**: UX's session is seeded with BA's contribution, clearly attributed to BA, without UX manually copying/pasting anything.

### TC-2: UX sees no update if BA's session hasn't reached a write trigger yet
**Preconditions**: BA has started chatting but has not yet hit a turn/size/time threshold.

**Steps**:
1.	BA sends one message to the AI (below any threshold).
2.	UX opens the project immediately after.

**Expected result**: UX does not see BA's very latest (unflushed) message, since it hasn't been written yet. This confirms the session-boundary sync behaves as designed, not as an error.

### TC-3: Attribution is correct and visible
**Steps**:
1.	BA and UX each contribute to the same project's context.
2.	Open the merged context (either user's session, or however it's surfaced in the UI).

**Expected result**: BA's and UX's contributions are each clearly labeled as coming from them individually, not merged into an anonymous blob.

### TC-4: Multiple rounds of handoff (BA → UX → BA)
**Steps**:
1.	BA contributes, UX's next session reflects it.
2.	UX contributes on top of that.
3.	BA starts a new session.

**Expected result**: BA sees both their own earlier contribution and UX's, correctly attributed to each.

## Test Cases: Edge Cases (from BA Requirements Doc)

### EC-1: Two users write to shared context at the same time
**Steps**: BA and UX are both actively chatting in the same project simultaneously. Both hit a write trigger at roughly the same moment.

**Expected result**: Both contributions are saved correctly, tagged to the correct user's own section. Neither overwrites or corrupts the other's content.

### EC-2: User logs out and back in
**Steps**: User contributes to a project, logs out, logs back in, reopens the same project.

**Expected result**: Their prior contribution and the project's full context are still present, nothing is lost on logout/login.

### EC-3: New user joins mid-project
**Steps**: A project already has existing context from BA. A new member (e.g. UX) is invited and opens the project for the first time.

**Expected result**: New member's session is seeded with the full existing context, not a blank state.

### EC-4: Failed/dropped connection during a write
**Steps**: Simulate a dropped connection (e.g. disable network) at the moment a write trigger would fire.

**Expected result**: No corrupted or partial write lands in Firestore. Either the write completes cleanly once connection resumes (Firestore's offline persistence/retry), or it's cleanly not written at all, not a broken/partial state.

### EC-5: Empty or very large context payload
**Steps (empty)**: Open a brand-new project with no contributions yet.

**Expected result**: Workspace loads normally, no errors, empty state handled gracefully.

**Steps (large)**: Simulate a long-running conversation well past several write-trigger cycles.

**Expected result**: Context remains readable and the app doesn't break or slow unacceptably as payload size grows.

### EC-6: Unauthenticated user tries to access the workspace
**Steps**: Log out, attempt to directly access a project URL.

**Expected result**: Blocked and redirected to login, no project or context data is returned to the client.

### EC-7 (added, not in original BA list but confirmed in scope): Authenticated user tries to access a project they're not a member of
**Steps**: Log in as a user who is not a member of a given project, attempt to access that project's URL directly.

**Expected result**: Redirected back to their own project list, no error message, no indication the target project exists.

