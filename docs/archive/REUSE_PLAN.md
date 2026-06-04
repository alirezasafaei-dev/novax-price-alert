# Reuse Plan

## Executive Summary

`novax-price-alert` should reuse the **infrastructure and application structure direction** of `rubika-bot-saas`, while rebuilding the product/domain layer around Bale price alerts.

At the time of writing, the strongest confirmed evidence comes from the old repository’s published project description and README-style material.  
This is enough to confidently reuse the overall backend foundation strategy, but not enough to claim exact code-level reuse of every module without source inspection.

This document therefore separates:

- **Facts**: what is confirmed from available repository evidence
- **Implications**: what those facts mean for the new project
- **Decisions**: what should be reused, adapted, or rebuilt

---

## What Was Inspected in `rubika-bot-saas`

### Confirmed inspected sources
- repository landing content / README-style project description
- declared architecture summary
- declared stack
- declared project structure
- declared configuration principles
- declared API versioning approach

### Not yet verified directly from code
- concrete implementation of app bootstrap
- actual config class structure
- actual SQLAlchemy model base/session patterns
- actual Alembic quality
- actual worker bootstrapping code
- actual logging implementation
- actual tests and coverage depth
- actual Docker/runtime maturity

---

## Facts

### Fact 1
The old project is explicitly positioned as a **self-hostable modular monolith backend**.

### Implication
This is strongly compatible with the new product’s needs.

### Decision
Reuse the modular monolith deployment and organization strategy.

---

### Fact 2
The old project explicitly targets:
- Python 3.12
- FastAPI
- PostgreSQL
- SQLAlchemy 2
- Alembic
- Pydantic v2
- Redis + RQ
- pytest
- Ruff
- MyPy
- uv

### Implication
The old project’s technology direction is almost an exact match for `novax-price-alert`.

### Decision
Reuse the same stack direction for MVP to maximize consistency and reduce architectural churn.

---

### Fact 3
The old project declares a structure centered around:
- `app/api/v1`
- `app/core`
- `app/db`
- `app/models`
- `app/schemas`
- `app/repositories`
- `app/services`
- `app/workers`
- `tests`
- `alembic`

### Implication
This structure maps very well to the new domain.

### Decision
Adopt nearly the same repository layout, with domain-specific modules replaced for the price alert use case.

---

### Fact 4
The old project explicitly states:
- environment-based configuration
- clear API versioning
- centralized error handling
- structured logging
- production-oriented defaults
- migrations from the beginning

### Implication
These are infrastructure-level concerns and should be preserved.

### Decision
Reuse these principles directly.

---

## Confirmed Reusable Foundations

These are safe to reuse conceptually even before full code-level verification:

### Reusable as architectural direction
- modular monolith
- FastAPI app structure
- API versioning under `/api/v1`
- environment-driven settings
- PostgreSQL + SQLAlchemy + Alembic baseline
- Redis + RQ baseline
- production-aware MVP philosophy
- local-first/self-hostable orientation

### Likely reusable at implementation level after code inspection
- app bootstrap pattern
- settings/config classes
- DB session/base wiring
- Alembic scaffolding
- router registration pattern
- health/readiness pattern
- worker startup pattern
- pytest project skeleton
- lint/type-check tooling
- Docker/Makefile conventions

---

## Reusable With Adaptation

These areas are likely worth adapting rather than copying directly:

### Authentication / security utilities
If the old project has auth helpers, token utilities, or security primitives, only reuse the generic parts.  
Do not import old auth assumptions unless required by the new product.

### Worker pattern
Reuse queue bootstrapping and job registration style, but replace domain jobs with:

- fetch prices
- evaluate alerts
- send notifications

### Event / webhook handling
If the old project has internal event processing conventions, reuse the handling shape, but replace Rubika event semantics with Bale command/webhook semantics.

### Reporting patterns
If there are generic reporting/query patterns, adapt only if they remain useful for notification or delivery introspection.

### Ownership model
The old project uses workspace-based ownership in its product domain.  
The new project should simplify ownership to **user-centric alerts** unless a strong generic ownership abstraction is proven useful.

---

## Not Reusable / Should Be Rebuilt

The following should be rebuilt from scratch for the new domain:

- Rubika-specific integrations
- channel management
- scheduled posts
- auto replies
- message filter domain logic
- workspace-domain entities
- product-specific reporting logic
- old domain terminology
- any API contract built specifically around Rubika automation workflows

---

## Naming and Structure Decisions

The new project should preserve the **shape** of the old backend while replacing domain modules.

### Keep
- `app/api/v1`
- `app/core`
- `app/db`
- `app/models`
- `app/schemas`
- `app/repositories`
- `app/services`
- `app/workers`
- `tests`
- `alembic`

### Replace old domain with
- users
- assets
- providers
- prices
- alerts
- notifications
- Bale integration

---

## Risks in Reusing the Old Repo

### 1. Documentation vs implementation mismatch
Because current evidence is doc-level, some patterns may be aspirational rather than fully implemented.

### 2. Domain leakage
Old workspace/channel abstractions may pollute the new product if copied too aggressively.

### 3. Premature complexity
The old project may contain abstractions justified by its original product that are unnecessary for a price alert MVP.

### 4. Incomplete worker maturity
If worker patterns exist only partially, direct reuse may create hidden technical debt.

---

## Migration Strategy from Old Architectural Base to New Domain

### Step 1
Extract infrastructure foundation:
- config
- db
- alembic
- logging
- errors
- app bootstrap
- router registration
- worker bootstrap
- tests skeleton

### Step 2
Remove or exclude old domain modules:
- workspace
- channels
- posts
- auto replies
- filters
- Rubika domain handlers

### Step 3
Introduce new domain:
- users
- assets
- providers
- prices
- alerts
- events
- notifications

### Step 4
Add Bale adapter:
- client
- parser
- formatter

### Step 5
Add provider architecture:
- base interface
- registry
- mock provider
- future real providers

---

## Final Recommendation

`rubika-bot-saas` is a strong **architectural base candidate** for `novax-price-alert` because its documented stack, boundaries, and deployment philosophy match the new project unusually well.

Recommendation:

- reuse infrastructure patterns aggressively
- reuse domain logic minimally
- preserve stack/tooling consistency
- rebuild the business layer for the new product cleanly
- verify code-level reuse opportunities as soon as source files are inspected directly

## Practical Reuse Classification

### Reuse As-Is (provisional)
- repository layout
- stack selection
- API versioning approach
- config philosophy
- migration-first philosophy
- self-hostable deployment stance

### Reuse With Adaptation
- app bootstrap
- database wiring
- worker bootstrapping
- logging/error handling implementation
- test conventions
- Docker/runtime files

### Build From Scratch
- domain models
- Bale integration
- providers
- alert logic
- notification flow
- bot command behavior