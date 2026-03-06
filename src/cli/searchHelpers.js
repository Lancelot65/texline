export function filterSearchChoices(choices, term) {
  const needle = String(term || "").toLowerCase();
  return choices.filter((choice) => {
    const name = String(choice.name || choice.value || "").toLowerCase();
    const description = String(choice.description || "").toLowerCase();
    return !needle || name.includes(needle) || description.includes(needle);
  });
}

export function buildChoiceList(values, mapChoice) {
  return [...new Set(values)].map((value) => mapChoice(value));
}
