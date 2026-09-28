export const PERSONAL_EMAIL_KEY = "personal_email";
export const PERSONAL_SETTINGS_UPDATED_EVENT = "personal-settings-updated";

const ownerKey = (playerName: string): string =>
  `${PERSONAL_EMAIL_KEY}:${playerName.trim().toLocaleLowerCase() || "default"}`;

export const getPersonalEmail = (playerName = ""): string =>
  window.localStorage.getItem(ownerKey(playerName)) ??
  window.localStorage.getItem(ownerKey("")) ??
  window.localStorage.getItem(PERSONAL_EMAIL_KEY) ??
  window.localStorage.getItem("guandan_screenshot_email") ??
  "";

export const setPersonalEmail = (playerName: string, email: string): void => {
  window.localStorage.setItem(ownerKey(playerName), email);
  window.dispatchEvent(new Event(PERSONAL_SETTINGS_UPDATED_EVENT));
};
