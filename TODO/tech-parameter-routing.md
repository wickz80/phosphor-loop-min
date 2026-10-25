# Technical debt: shared parameter routing

Status: open.

Create a parameter registry covering scope, get/set, defaults, dependencies, formatting, automation and serialization. Route manual controls, LFOs and reset actions through it. First fix adj-* LFOs: the thumb moves but source-adjustment model values are not written. Verify actual model/output changes.

Source: [product and Autopilot audit](../docs/product-autopilot-audit.md).

## Controls pass checkpoint

Source-adjustment LFO routing, exclusive loop/mix automation ownership, dependency-aware generated scenes, live Autopilot readouts and Amount-independent beat gating are implemented and covered by focused Node regression checks. Browser verification remains pending. The broader consolidation described above is still open.
