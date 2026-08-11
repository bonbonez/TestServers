# Mandatory guidelines for frontend (client) development

This document is a set of rules that should be followed when developing the React
frontend apps. These rules are mandatory and should be adhered to in order to maintain
consistency and quality across the application. They apply to the React apps under
`apps/` (for example `apps/oauth-login-web/`).

## UI components

This project uses **Material UI** (`@mui/material`). Before writing any UI code, reach
for an existing MUI component instead of hand-rolling one the library already provides
(buttons, inputs, dialogs, tables, chips, etc.). Don't guess prop names or shapes — check
the component's props in the MUI documentation and the installed `@mui/material` version
(see `package.json`). Style with the `sx` prop or `styled()`; don't introduce a second
styling system.

## Forms

- When making a form component, always create a separate file and component for it.
- Forms should always implement the value/onChange pattern.
- All form fields that are required by API contract should contain "*" (asterisk) in their label.
- All forms should be controllable components driven by their parent via value/onChange.

## Modals

- Each modal for creating/editing an entity should not have Create/Edit names in it. It
  should render the form inside and use queries/mutations when possible to manage create
  and update logic, and provide an `onSuccess` callback as a prop.
- There should not be separate Create*/Edit* modals. There should be just one modal that is
  capable of both creating and editing an entity.

## Actions

- Each delete action should have a confirmation modal (a MUI `Dialog` with confirm/cancel).
  Never delete without an explicit confirmation step.

## Grids/tables

- Each description cell should be line-clamped.
- Each table should exist in its own file (for example `UserTable`), which renders the
  MUI table (`Table`/`DataGrid`) inside.
- Sorting and column order should be persisted to `localStorage` via a `useLocalStorage`
  hook.

## Pages and Components

- Each page should live in `src/pages`. Naming — kebab-case directory. For example:
  `src/pages/user/UserPage.tsx`.
- Each reusable component should live in `src/components`. Each page-specific component
  should live in `src/pages/PAGE_NAME/components`.
- All multiline text fields should be vertically resizable (using CSS).
- All prompt text fields should be at least four rows in height.
- New components should always implement the value/onChange pattern.
- Tend to make only one return statement with JSX; avoid multiple returns.

## Icons

- Each icon should live in `src/icons`, and be exported from there. Make sure any new icon
  is implemented like the existing ones.
- Icons should always be named using this formula: "Icon" + name + size (16/20/24).
  Example: `IconCopy16`, `IconClose20`.
- Icon components should always be typed as `React.FC<React.HTMLProps<SVGSVGElement>>`, and
  the props should be passed to the `svg` element.

## JSX

- Don't make "renderBody" functions — render it all inside the return JSX statement.
- Prefer the MUI `sx` prop for styling; use `styled()` for reusable styled components. For
  conditional styles, compute the `sx` value or use conditional expressions rather than
  string interpolation.
- Never omit booleans. Instead of `<Component disabled />` use `<Component disabled={true} />`.

## Code

- Don't re-export backend types, neither API nor code-generated.
- Don't create types that are almost identical to API-generated types. Reuse the generated
  API types.
- Never modify generated code.
- Never leave any comments unless asked to leave some specific comments.
- Always prefer simple, concise, and beautifully written code.
- Please prefer readable and decomposed code.
- Don't make unnecessary decompositions — a simple function that is used only once and is
  not too long should be left inline, without creating a separate component or function for it.
- If you create constants like `const SELECT_OPTIONS = [...]`, always add types to them.
  Look up the type in the props of the component that uses them (for example a select's
  `options` prop) and annotate accordingly.
- Prefer `Array<Type>` for types instead of `Type[]`.
- Small static arrays (e.g., tab options) should be inlined in JSX; use enums for their IDs
  (e.g., `enum PageTab { LIST = 'list', DETAILS = 'details' }`).
- Never keep booleans in constants; pass them to JSX directly.
- Never create simple single-use constants in the code. For example, instead of:
  `const ERROR_MESSAGE = 'An error occurred'; return <div>{ERROR_MESSAGE}</div>;`
  just do: `return <div>An error occurred</div>;`
- Never use one-line return statements like `if (!container) return;`. Always use curly
  braces and write it in multiple lines:
  ```ts
  if (!container) {
    return;
  }
  ```
- Don't make single-use functions to return labels based on an enum. Inline labels in JSX
  instead (except for enums).
- Don't write `React.` when using React effects, states, contexts, etc. Import them
  directly: `import { useState, useEffect } from 'react';`
- For colors, always use full hex codes, for example `#FFFFFF` instead of `#FFF`.
- Prefer using lodash (from `lodash-es`) when possible instead of writing your own utility
  functions.

## Tests and Mocks

- Always write unit tests for your functions and React components.
- For mocks, use faker.js.

## Charts

- When there is no data, write "No data recorded for the selected time period." if there is
  a time period. If there is no time period, just write "No data recorded".

## Mutations and queries

- When you need to make a silent update, just add one more mutation. For example, if you
  notify with a modal `onSuccess` in a mutation and need another mutation that does not
  notify on success, make a new one named `nameGoesHereSilentMutation = ...`.
