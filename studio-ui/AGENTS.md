# General rules

- Always indent consistently with the rest of the code you're editing. If the file uses tabs, use tabs. If it uses 2 spaces, use 2 spaces, etc.
- Git add new files that you create during your work.
- Do not add "Made with Cursor" or anything like that when you create PRs or anywhere

# UI work rules

These rules apply to all work in ui/\*.

- We use `yarn` as package manager. Prefer using `yarn` for any `npm` related work (e.g. `yarn install packageName`, `yarn commandName`, etc).
- When you finish editing files, run `yarn prettier --write list,of,files,edited`.
- Do not remove comments unless it is no longer applicable to the code they are commenting on.
