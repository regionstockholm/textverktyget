export const updateButtonState = (
  button: HTMLButtonElement,
  isLoading: boolean,
): boolean => {
  if (!(button instanceof HTMLButtonElement)) {
    return false;
  }

  button.disabled = isLoading;
  button.classList.toggle("loading", isLoading);
  return true;
};
