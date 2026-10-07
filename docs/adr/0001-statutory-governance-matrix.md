# 1. Statutory Governance Matrix: Policies, Controls, and Risks Linked to Law Changes

Date: 2026-10-07

## Status

Accepted

## Context

Nordic financial institutions (wealth managers, banks, UCITS fund companies) struggle with "regulatory decay": when a national parliament or European authority amends a statute (e.g., SFS 2026:916 amending SFS 2004:46 on algorithmic trading, or DORA Art. 28 ICT resilience requirements), the changes sit in legal silos disconnected from the firm's internal operational controls and board policies. Compliance officers must manually read legal gazettes and cross-reference spreadsheets to figure out what broke.

## Decision

We link internal governance entities directly to statutory sections and amendments within the Studio:

1. **Direct Matrix Causality**:
   - `Statutory Section` $\leftrightarrow$ `Policy` (the governing board/executive rule).
   - `Statutory Section` $\leftrightarrow$ `Control` (the operational technical parameter, safeguard, or procedure).
   - `Compliance Gap / Risk`: Evaluated on the exposure between the statute requirements and current control health.

2. **Hybrid Law Change Trigger**:
   - Amending legislative diffs (status `MODIFIED` or `ADDED`) automatically flag linked policies and controls with an `Impacted by [Amending Act]` alert.
   - Compliance officers resolve gaps via a 3-way mitigation workflow:
     1. Link an existing operational control.
     2. Create a new mitigation task / policy update.
     3. Formally sign-off as covered (no gap).

3. **Unified Dual Surface**:
   - **Top-Level Registries**: Sidebar category `SÄÄDÖKSET JA HALLINTO` exposing `Säädökset`, `Käytännöt` (Policies), `Kontrollit` (Controls), and `Riskit` (Risks).
   - **Contextual Section Inspection**: Finlex reader sections display a compact inline governance strip linking to policies and controls, opening an interactive detail drawer on click.

## Consequences

- Direct traceability during regulatory inspections (FIN-FSA, Finansinspektionen).
- Clear audit trails when statutory amendments trigger policy reviews.
- Clean separation of concerns: `core/store.js` manages lookup helpers and state transitions; `data/governance.js` hosts the seed registries; pages render calm, unbloated Scandinavian interfaces.
