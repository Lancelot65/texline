export function isPromptCancelled(error) {
  return (
    error == null ||
    error === "" ||
    error?.name === "AbortPromptError" ||
    error?.name === "ExitPromptError"
  );
}

export async function runPromptSafely(runPrompt, cancelledValue) {
  try {
    return await runPrompt();
  } catch (error) {
    if (isPromptCancelled(error)) return cancelledValue;
    throw error;
  }
}
