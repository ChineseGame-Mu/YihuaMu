import * as React from "react";
import { renderToString } from "react-dom/server";
import PersonalSettingsButton from "./PersonalSettingsButton";
import * as personalSettings from "./personalSettings";

describe("PersonalSettingsButton email reads", () => {
  it("does not read the saved email just because a game view rendered", () => {
    const readEmail = jest.spyOn(personalSettings, "getPersonalEmail");

    renderToString(<PersonalSettingsButton playerName="Alice" />);

    expect(readEmail).not.toHaveBeenCalled();
    readEmail.mockRestore();
  });
});
