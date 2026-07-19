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

- Uploads are parsed in the browser: `.txt` / `.md` as text, `.pdf` via pdf.js, `.docx` via mammoth. Legacy `.doc` is not supported.
