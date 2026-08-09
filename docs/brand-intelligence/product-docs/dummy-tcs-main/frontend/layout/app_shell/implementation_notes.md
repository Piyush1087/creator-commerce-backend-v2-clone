# Implementation Notes

Desktop shell and mobile shell are maintained independently.

Business logic must never exist inside the shell.

The shell should expose a reusable Content Area into which feature modules render.

Future shell improvements should propagate across every module.

The shell should remain visually stable across the application lifecycle.
