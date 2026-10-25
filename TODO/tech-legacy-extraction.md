# Technical debt: legacy cleanup and module boundaries

Status: open.

Incrementally extract state, automation and DOM coordination from app.js after coverage exists. Remove inactive legacy surfaces and the excluded Ribbit startup build. Retain renderer/audio foundations; avoid a wholesale rewrite. Clarify pre-grade versus final-output safety checks.

Source: [product and Autopilot audit](../docs/product-autopilot-audit.md).
