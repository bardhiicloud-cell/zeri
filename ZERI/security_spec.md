# Security Specification

## Data Invariants
1. A Report must have an `authorId` matching the creator's UID.
2. Only Admins can change a Report's `status` to 'Approved', 'Rejected', etc.
3. Users can only edit their own reports (title, description, category, urgency) while status is 'Pending Review'.
4. Comments belong to a Report and must have an `authorId` matching the creator.
5. Poll votes are incremented naturally; a user cannot decrease votes.
6. User profiles can only be updated by the owner (except points/badges/role which are admin-only).
7. Admin role is checked against a trusted `/admins/$(userId)` document or a role field in `/users/$(userId)`. Let's use `/users/$(userId).role == 'admin'`.

## The Dirty Dozen Payloads (Expected to be DENIED)
1. **Identity Spoofing**: Citizen A tries to create a report with `authorId: "CitizenB"`.
2. **State Shortcutting**: Citizen A tries to create a report with `status: "Resolved"`.
3. **Privilege Escalation**: Citizen A tries to update their own profile with `role: "admin"`.
4. **Unauthorized Update**: Citizen A tries to update Citizen B's report.
5. **Illegal Status Change**: Citizen A tries to change their report's status from 'Pending Review' to 'Approved'.
6. **Orphaned Write**: Citizen A tries to add a comment to a report that doesn't exist (relational check).
7. **Resource Poisoning**: Citizen A tries to create a report with a 2MB description string.
8. **Negative Voting**: Citizen A tries to update a poll option with a lower `votes` count.
9. **Terminal State Break**: Citizen A tries to update a report after it has been 'Resolved' or 'Rejected'.
10. **Shadow Field injection**: Citizen A tries to add `isVerified: true` to their report.
11. **Bypassing Verification**: User with unverified email tries to post a report (if `email_verified` is required).
12. **Denial of Wallet**: User tries to create a custom ID for a report that is 500 characters long.

## The Test Runner
(I'll provide the rules based on these.)
