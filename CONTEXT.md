# Nordic Financial Compliance Studio

A calm, structured workspace for Nordic wealth managers, banks, and funds to monitor statutory regulations, explore statutory chapters and cross-references, track operational tasks, and inspect token-level legislative diffs.

## Language

### Statutory Model

**Regulation**:
An authoritative statutory act, directive, or supervisory standard enacted by a parliament or supervisory authority (e.g., SFS 2004:46, DORA EU 2022/2554, SFS 2017:630).
_Avoid_: Statute document, law file, rulebook entity

**Chapter**:
A major structural subdivision within a regulation containing related statutory provisions (e.g., 1 kap. Inledande bestämmelser, Chapter II ICT Risk Management).
_Avoid_: Category, legal partition

**Section**:
An individual enforceable statutory paragraph or article within a chapter (e.g., 1 kap. 100 §, Article 28).
_Avoid_: Clause, rule line, statutory node

**Cross Reference**:
An explicit statutory link where one section or regulation refers to another standard (e.g., SFS 2004:46 § 1 referencing DORA Regulation EU 2022/2554).
_Avoid_: Legal hyperlink, dependency citation

**Statutory Diff**:
A token-level comparison showing additions, deletions, and modifications introduced by an amending legislative act (e.g., SFS 2026:916 modifying SFS 2004:46).
_Avoid_: Policy redline, law patch, text comparison

**Tag**:
A domain or supervisory topic applied to regulations and sections to group cross-cutting obligations (e.g., `#ICT-Risk`, `#AML`, `#Funds`, `#Sanctions`, `#Finansinspektionen`).
_Avoid_: Label, badge, category

### Operational Governance

**Project**:
An internal compliance implementation package or supervisory review initiative grouping related obligations for a regulation or audit cycle.
_Avoid_: Workspace container, sprint, rulebook board

**Task**:
A concrete operational requirement or compliance action assigned to an officer, linked directly to a statutory section citation.
_Avoid_: Ticket, issue, obligation inventory item

**Supervisory Authority**:
A national or European regulatory body with legal oversight and enforcement jurisdiction over the entity (e.g., Finansinspektionen, FIN-FSA, ESMA, EBA).
_Avoid_: Regulator agency, supervisory body
