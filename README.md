# texline

Minimal terminal chat client with OpenAI-compatible providers, Markdown rendering, and inline LaTeX.

## Demo

[Watch the presentation video](assets/videos/texline-demo.mp4)

## Requirements

- Node.js 20+
- `glow`
- `latex`
- `dvipng`
- `Ghostty` or `Kitty` if you want inline image rendering for math

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env
```

3. Edit `.env` and set at least one provider key:

```dotenv
MISTRAL_API_KEY=your_mistral_api_key_here
```

4. Start the app:

```bash
npm start
```

5. Inside the app, verify the setup:

```text
.doctor
```

## Environment variables

Example local config:

```dotenv
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_BASE_URL=https://api.mistral.ai/v1

OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

TUI_CHAT_GLOW_STYLE=dark
```

`index.js` loads `.env` automatically through `dotenv`, so you do not need to `export` variables manually.

## Run

Start a new session:

```bash
npm start
```

Reopen a saved session:

```bash
node index.js .history/texline_1234567890.md
```

## Main commands

- `.help`
- `.doctor`
- `.providers`
- `.provider <name>`
- `.provider use <name>`
- `.provider add <name> <base_url> <api_key_env> [model]`
- `.provider rm <name>`
- `.files`
- `.files add <path>`
- `.files rm <path>`
- `.models`
- `.models refresh`
- `.models use <model_id>`
- `.model <model_id>`
- `.temp <0..1>`
- `.history`
- `.undo`
- `.retry`
- `.save [file]`
- `.load <file>`
- `.system`
- `.clear`
- `.quit`
- `.exit`

## Custom providers

Add any OpenAI-compatible provider from inside the app:

```text
.provider add openrouter https://openrouter.ai/api/v1 OPENROUTER_API_KEY your_model_id
.provider use openrouter
.models
.model your_model_id
```

Provider config is stored locally in `.tui_chat.providers.json`.

## File references

Add read-only roots first:

```text
.files add .
.files add /absolute/path/to/docs
```

Then reference files directly in prompts:

```text
read @README.md
summarize @"docs/design notes.pdf"
compare @src/app.js with @'notes/todo list.txt'
```

Rules:

- Only files under configured `.files` roots are allowed.
- Text files are injected directly into the prompt.
- PDFs and images are processed through Mistral OCR.
- If OCR fails, the prompt fails clearly instead of skipping the file.

Saved conversations go to `.history/` by default when you run `.save` without a path.
