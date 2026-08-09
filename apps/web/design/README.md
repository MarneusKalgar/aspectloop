# AspectLoop Design References

This directory contains design-agent reference material. It is retained in the
repository so future design work can inspect the current visual direction,
responsive states, and interaction ideas without treating the files as
production application code.

## v1

Open `v1/index.html` as the canonical static launcher. It links to all retained
desktop/mobile and light/dark screen variants for sign-up, sign-in, the
correction inbox, and a correction session.

`v1/prototype-app.js` is a standalone React/MUI concept source retained for
reference. No production route or static launcher loads it.

The React application lives in `apps/web/src`. Changes to the static references
do not change application behavior. Keep visible product identity, mock
credentials, and visual tokens aligned when design references are updated.
