# Delta Resume

A single-page frontend for tailoring resume bullets to a job description. Attach a base resume, paste a job description, and review suggested bullet rewrites with an inline diff. Accept or reject each change, then copy the tailored resume.

## Stack

- Vite + React + TypeScript
- Mantine UI (`@mantine/core`, `@mantine/dropzone`)
- `diff` (jsdiff) for word-level inline diffs

## Running

```bash
npm install
npm run dev
```

Then open the printed local URL (defaults to http://localhost:5200).

## Notes

- `.txt` and `.md` uploads are read directly in the browser. PDF/DOCX uploads are accepted but load sample resume text for now; real parsing is deferred.
