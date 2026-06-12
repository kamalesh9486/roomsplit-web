You can feed this document directly into another AI to cleanly recreate or adapt this application.
Architectural Blueprint: Offline-First Collaborative Expense Splitter
This document outlines the system architecture, database design, offline-first sync algorithm, and presentation layer mechanics for a cross-device, collaborative expense-splitting application.
1. Core Architecture Overview
The application is structured as an Offline-First Client-Server Architecture utilizing:
Local Persistence Layer: SQLite database managed via Android ROOM.
Remote Database Layer: Supabase (PostgreSQL) acting as the source of truth.
REST Network API: A Retrofit client communicating with Supabase via PostgREST endpoints.
State Management: MVVM Pattern utilizing Jetpack Compose, Koltin Flows, and dynamic ViewModels.
2. Conceptual Database Schema
To enable offline generation of keys without collision, all primary keys (IDs) are generated on the client side (e.g., standard random unique identifiers) and inserted directly into the remote database.
Table A: Roommate
Represents a group participant or user.
id (Long, Primary Key) — Client-generated unique ID.
name (String) — The display name of the roommate.
Table B: Expense
Represents an individual purchasing event.
id (Long, Primary Key) — Client-generated unique ID.
title (String) — Description of the transaction.
amount (Double) — Total cost of the transaction.
paidById (Long, Foreign Key -> Roommate.id) — The roommate who paid the bill.
date (Long) — Epoch millisecond timestamp of the transaction.
Table C: ExpenseSplit
An association table mapping expenses to multiple roommates with individual division ratios.
id (Long, Primary Key) — Client-generated unique ID.
expenseId (Long, Foreign Key -> Expense.id with CASCADE DELETE) — Associated expense.
roommateId (Long, Foreign Key -> Roommate.id with CASCADE DELETE) — Associated roommate who owes money for this expense.
amount (Double) — The specific share of the expense this roommate owes.
3. Offline-First Sync & Conflict Resolution Engine
The Problem: Sync Echo Loops
In traditional sync setups, if User A deletes an expense while offline/online, that expense disappears from the server. When User B (who still has the item locally) syncs with the server, their local copy appears to the naive sync engine as "new data." Consequently, the deleted item is uploaded back to the cloud, restoring it for everyone.
The Solution: Shared Preference Sync History
The client tracks state transitions using client-side Sync History Sets stored in local persistent key-value configuration (SharedPreferences).
Three persistent string sets are maintained locally:
synced_roommates (Set of Roommate IDs)
synced_expenses (Set of Expense IDs)
synced_splits (Set of Split IDs)
Synchronizing Flow (Step-by-Step)
For each synchronized entity class (Roommates, Expenses, Splits), the sync algorithm maps states sequentially:
1. Remote Data Retrieval
Fetch the complete remote dataset from the Supabase REST API endpoint.
Read the local database status.
Read the local Sync History Set.
2. Reconciliation & Deletion Propagation
Compare each local entity against the remote data:
Case A: Entity Exists Remotely, but is Missing Locally
Action: Download and write the remote entity to the local database.
Metadata: Add the entity's ID to the local Sync History Set.
Case B: Entity Exists Locally, but is Missing Remotely
Decision Fork:
Check Sync History Set: If the ID exists in the Sync History Set, it means this record was successfully uploaded to the cloud in the past but has been deleted by another user.
Action: Cascade-delete the entity from the local table. Do not upload it. Remove its ID from the Sync History Set.
Missing from Sync History Set: If the ID is not present in the Sync History Set, it means the local user created this record while offline and it has never reached the cloud.
Action: Mark the entity as a pending upload.
3. Upload Pending Changes
Perform a batch insertion (upsert) to Supabase for all entities marked as pending uploads in Step 2.
Upon a successful HTTP response (Status 200/201), commit their IDs to the Sync History Set.
4. Business Logic & Presentation Screen Details
The main layout is divided into a three-tab view backed by a single ViewModel that aggregates local ROOM flows into calculated states.
Tab 1: Expenses Screen
List Layout: Shows historic split records, titles, dates, dates formatted chronologically, who paid, and how the expense was divided.
Multi-Selection Deletion: Allows users to long-press and select multiple expenses. Deleting these triggers a bulk deletion locally and issues parallel DELETE requests using URL parameter filters (eq.ID) to PostgREST to clean up cloud records.
Add/Edit Dialog:
Allows entering a Title, Amount, and selecting a "Payer".
Provides split divisions:
Equally: Dynamically divides amount / selected_roommates.size.
Exact Amounts: Allows typing specific currencies (validating that the sum matches the total expense).
Percentage: Divides according to proportions (validating that the sum equals 100%).
Tab 2: Balances & Calculations Screen
This tab performs in-memory evaluations of the expense and split lists to balance books cleanly without saving secondary ledger variables in the database.
The Bilateral Settlement Simplification Algorithm
Calculate Net Balances:
For each roommate, determine Net Balance = (Total Paid as Buyer) - (Total Owed across all splits).
Separate roommates into two lists: Creditors (Net Balance > 0) and Debtors (Net Balance < 0).
Greedy Balance Reduction:
Sort Creditors descending by their claim value.
Sort Debtors ascending by their debt.
Iteratively pair the largest debtor with the largest creditor:
settlementAmount = min(Absolute Owed, Creditor Claim).
Create a transaction: [Debtor] pays [Creditor] -> settlementAmount.
Deduct settlementAmount from both balances.
Remove settled roommates from lists or resort queue.
Visual Output: Shows simple transfer cards stating exactly "User A needs to pay User B $X" to resolve all group debts using the fewest transfers possible.
Tab 3: Roommates & Settings Screen
Shows the roster of participating group members with explicit role-based constraints.
Identities Defined:
Self (Logged-in): The roommate ID associated with the current application profile. Marked visually with a "Logged In User (Self)" badge.
Admin Mode: A globally configuration toggle (e.g., simulating group administrative rights).
Roommate Deletion Constraints:
Self-Deletion Blocked: Under no circumstances can a user delete their own profile (self-identity).
Basic Users: Can only delete other roommates if those roommates have no active transaction history (Net Balance == 0 and has no splits).
Admins: Can delete any roommate except themselves.
Cascading Warning Dialog:
If an administrator tries to delete a roommate with existing transaction histories, an AlertDialog intercepts the click.
It warns that deleting this user will trigger a cascade delete on both local and cloud databases, permanently scrubbing all associated expenses and splits they participated in. Confirming triggers the ViewModel delete subroutine.