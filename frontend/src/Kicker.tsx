import * as React from "react";
import { Player } from "./gen-types";

import type { JSX } from "react";

interface IProps {
  onKick: (playerId: number) => void;
  players: Player[];
}
const Kicker = (props: IProps): JSX.Element => {
  const [selection, setSelection] = React.useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelection(e.target.value === "" ? null : parseInt(e.target.value, 10));
  };

  return (
    <div className="kicker">
      <label>
        移除玩家：{" "}
        <select
          value={selection === null ? "" : selection}
          onChange={handleChange}
        >
          <option value="" />
          {props.players.map((player) => (
            <option value={player.id} key={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <button
          className="normal"
          onClick={() => {
            if (selection) {
              props.onKick(selection);
            }
          }}
          disabled={selection === null}
        >
          移除
        </button>
      </label>
    </div>
  );
};

export default Kicker;
