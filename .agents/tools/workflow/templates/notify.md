You just posted a response in a conversation. The user is away from their
screen and will hear this as a notification. Render your previous response
(your most recent assistant message - it is in your context) into a listenable
notification body.

This is the full message made listenable, not a summary. Preserve the substance
and voice of the original response. Strip only unlistenable forms: no code
blocks, no tables, no URLs, no markdown syntax noise. Reference artifacts and
files by name; never quote code. Keep the body under about 5000 characters.
Front-load the punchline: only the first ~200 characters show in the collapsed
notification preview, so the first sentence must carry the headline.

Do not post to the thread. Do not modify project files. Your output is captured
nowhere; the only durable output is the notification row submitted by the CLI.

## Submission

1. Run `npx tsx .agents/tools/workflow/notify.ts --help` to learn the interface.
2. Write the listenable body as plain UTF-8 text to:
   `{{BODY_PATH}}`
3. Invoke:
   `npx tsx .agents/tools/workflow/notify.ts --thread-id {{THREAD_ID}} --input {{BODY_PATH}}`
4. Exit after the CLI prints `ok`.
