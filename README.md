# Digital Twin of a Distillation Column with Partial Reflux

Educational web app that simulates the **distillation unit operation** in a tray column with **partial reflux**, working as a **digital twin** so Chemical Engineering students can operate the column, trigger disturbances and observe real-time responses.

## Languages

**Trilingual** application: Galician, Spanish and English. On first access a
language picker shows the three flags (SVG) and saves the choice to
`localStorage` (flag button in the header to change it later). The whole UI,
the engine messages (scenarios, optimization) and the quiz follow the selected
language. The theory document (`docs/teoria-destilacion.md`) is in Galician.

## Getting started

```bash
npm install        # install dependencies
npm run dev        # development server (Vite)
npm run test       # test suite (69 tests)
npm run build      # production build → dist/
npm run preview    # serve the build
```

## Contents

```
destilador-digital-twin/
├── docs/
│   └── teoria-destilacion.md   ← Theory background (fundamentals, VLE, material
│                                 and energy balances, MESH and dynamic models,
│                                 McCabe–Thiele, digital twin, worked example)
├── src/
│   ├── core/                   ← Calculation engine (no UI dependencies)
│   │   ├── antoine.ts          ← Antoine equation (P_sat, T_sat)
│   │   ├── components.ts       ← Components + systems (ideal, Wilson, NRTL)
│   │   ├── activity.ts         ← Activity coefficients (Wilson, NRTL) with
│   │   │                          fast binary path
│   │   ├── thermo.ts           ← K-values, bubble/dew, flash (Rachford–Rice),
│   │   │                          cached equilibrium curve
│   │   ├── mccabeThiele.ts     ← Numerical McCabe–Thiele (ideal and non-ideal,
│   │   │                          azeotrope detection, R_min, Fenske)
│   │   ├── columnDynamic.ts    ← Stage-by-stage dynamic model (CMO, total/partial
│   │   │                          condenser, reboiler, reflux)
│   │   ├── integrator.ts       ← RK4 and implicit Euler
│   │   ├── control.ts          ← PID with anti-windup + L/D, R/V, D/V schemes
│   │   ├── twin.ts             ← Digital twin mode (plant+model, noise,
│   │   │                          reproducible RNG, disturbances)
│   │   ├── session.ts          ← Session log (audited events, JSON export)
│   │   └── assessment.ts       ← Quiz bank + session rubric (mission scoring)
│   ├── i18n/                   ← Trilingual system (gl/es/en)
│   │   ├── translations.ts     ← Dictionaries (all keys in 3 languages)
│   │   └── index.tsx           ← Provider, useI18n hook, tGlobal, SVG flags
│   ├── sim/                    ← React UI
│   │   ├── engine.ts           ← UI simulation engine (rAF loop)
│   │   ├── charts.tsx          ← SVG charts (x–y, profiles, time series)
│   │   ├── Simulator.tsx       ← Simulator panel (controls, animated column)
│   │   ├── TwinPanel.tsx       ← Digital twin panel
│   │   ├── AssessmentPanel.tsx ← Quiz + session report
│   │   ├── TheoryPanel.tsx     ← Theory rendered (Markdown + KaTeX + Mermaid)
│   │   └── LanguagePicker.tsx  ← Language modal with flags
│   └── App.tsx                 ← Shell with tabs
└── README.md
```

## Supported thermodynamic systems

| System | Model | Behaviour |
|---|---|---|
| Benzene–Toluene | Ideal (Raoult) | α ≈ 2.5, classic McCabe–Thiele |
| Ethanol–Water | Wilson | Minimum-boiling azeotrope (x ≈ 0.895, 78.2 °C) |
| Methanol–Water | Wilson | Non-ideal without azeotrope |
| Acetone–Chloroform | NRTL | Maximum-boiling azeotrope (x ≈ 0.34, 64.5 °C) |
| Benzene–Toluene–Ethylbenzene | Ideal | **Ternary multicomponent** (80.1/110.6/136.2 °C) |
| Benzene–Toluene–Ethylbenzene–Styrene | Ideal | **Quaternary** BTXS (80.1/110.6/136.2/145.2 °C) |

## Teaching features

- **Switchable control schemes**: L/D (R), R/V (V_R) and D/V (ratio
  D/V → R = (1−r)/r), with per-scheme recommended gains and anti-windup.
  Raising Kp/Ki too much causes a limit cycle (a tuning lesson in itself).
- **Model identification mode** (digital twin): the student disturbs the
  plant, enables identification and adjusts the model V_R and holdup factors
  until the residuals are minimized (window RMSE of x_D, x_B and bottoms T).
- **Guided energy optimization**: sets D* from the mission balance
  (D* = F·(z−x_Bmax)/(x_Dmin−x_Bmax)) and searches the minimum R with
  V_R = (R+1)·D* by coarse search + bisection on the dynamic model. It shows
  real savings when the point is over-separated, or the energy cost of purity
  when the mission is stricter ("purity has a price").
- **Condenser reflux modes**: no reflux (R = 0), partial reflux (R adjustable)
  and total reflux (R → ∞, D ≈ 0, Fenske limit).
- **Automatic assessment**: 6-question quiz graded instantly (0–10, logged in
  the session) and a session report with a rubric (purity mission, efficiency
  by number of adjustments, bonus for using control).
- **Session log**: every action (setpoints, scenarios, disturbances, control,
  optimization, import/export) is audited with the column state (x_D, x_B, Q_R)
  at the event time; exported as JSON.
- **Multicomponent columns**: the UI supports ternary and quaternary systems
  (per-component z_F sliders, composition profile with component selector,
  x_D/x_B of key components); McCabe–Thiele is reserved for binaries.

## Validation (69 tests)

- **Thermodynamics:** benzene–toluene bubble/dew (92.0/98.8 °C), ethanol–water
  and acetone–chloroform azeotropes, binary/ternary flash, γ at the azeotrope.
- **McCabe–Thiele:** reproduces the theory document example (13 stages, feed
  tray 5, R_min 1.10, Fenske 6.4) and infeasibility above the azeotrope.
- **Dynamic:** the steady state matches the McCabe–Thiele design; stable step
  dt = 0.0005 h. **Ternary and quaternary**: exact per-component balances
  (F·z = D·x_D + B·x_B).
- **Control:** PID tracks setpoints with anti-windup in the three schemes
  (L/D, R/V, D/V); high gain causes a limit cycle — a didactic phenomenon.
- **Optimization:** finds the minimum R (search + bisection) meeting the
  mission; real savings from an over-separated point and well-reported
  infeasibility.
- **UI engine:** teaching scenarios, export/import with exact roundtrip;
  session log with per-event state.
- **Twin:** reproducible noise, step disturbances, identification
  (informative residuals in x_B/T_B).
- **Assessment:** quiz scores hits/misses; session rubric (mission,
  efficiency, control bonus, quiz).
- **i18n:** dictionaries complete in the 3 languages (same keys, no empty
  values); SSR render verified in Spanish and English.
- **UI:** SSR render of the four panels; performance < 40 ms/tick.

## Roadmap

- ✅ **Phase 0 — Theory background**: `docs/teoria-destilacion.md` complete.
- ✅ **Phase 1 — Simulation engine**: thermodynamics, McCabe–Thiele, dynamic
  model, PID, digital twin.
- ✅ **Phase 2 — Web UI**: controls, animated column, live x–y diagram,
  profiles, time series, twin panel, theory with KaTeX/Mermaid.
- ✅ **Phase 3 — Teaching and extensions**:
  - Trilingual interface (Galician, Spanish, English) with language picker.
  - Switchable control schemes L/D, R/V, D/V.
  - Model identification mode (V_R and holdups adjustable, RMSE).
  - Condenser reflux modes: none / partial / total.
  - Guided energy optimization (minimum reflux for a purity mission).
  - Automatic assessment (quiz + session report with rubric).
  - Session log with per-event state and JSON export.
  - Multicomponent columns: ternary (BTE) and quaternary (BTES).
  - Teaching scenarios, JSON export/import and guided questions.
- ⏳ **Future ideas**: packing vs. trays, multi-objective optimization (energy
  vs. number of trays), and automatic grading of open answers.

---

*Educational project · Unit Operations · Distillation · React + TypeScript + Vite*
