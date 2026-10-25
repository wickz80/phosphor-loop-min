# Technical debt: automation ownership

Status: open.

Define how manual gestures, LFOs, Autopilot and music reactions own or compose parameter values. Restarting Autopilot currently leaves texture LFOs active. Make scene generation dependency-aware, synchronize visible sliders during ramps, and remove invisible legacy constraints. Keep pinning removed.

Source: [product and Autopilot audit](../docs/product-autopilot-audit.md).

## Controls pass checkpoint

Source-adjustment LFO routing, exclusive loop/mix automation ownership, dependency-aware generated scenes, live Autopilot readouts and Amount-independent beat gating are implemented and covered by focused Node regression checks. Browser verification remains pending. The broader consolidation described above is still open.
