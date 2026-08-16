import * as React from "react";
import { Deck } from "./gen-types";
import ArrayUtils from "./util/array";
import { useEngine } from "./useEngine";

import type { JSX } from "react";

interface IProps {
  numPlayers: number;
  decks: Deck[];
  kittySize: number | null | undefined;
  onChange: (newKittySize: number | null) => void;
}

const KittySizeSelector = (props: IProps): JSX.Element => {
  const engine = useEngine();
  const [deckLen, setDeckLen] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    setIsLoading(true);
    engine
      .computeDeckLen(props.decks)
      .then((len) => {
        setDeckLen(len);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error computing deck length:", error);
        setDeckLen(props.decks.length * 54);
        setIsLoading(false);
      });
  }, [props.decks, engine]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newKittySize =
      e.target.value === "" ? null : parseInt(e.target.value, 10);
    props.onChange(newKittySize);
  };
  const kittyOffset = deckLen % props.numPlayers;
  const defaultOptions = [
    kittyOffset,
    kittyOffset + props.numPlayers,
    kittyOffset + 2 * props.numPlayers,
    kittyOffset + 3 * props.numPlayers,
    kittyOffset + 4 * props.numPlayers,
  ];
  const potentialOptions = ArrayUtils.range(
    kittyOffset + 4 * props.numPlayers,
    (v) => v,
  );

  const options = potentialOptions.filter(
    (v) =>
      !defaultOptions.includes(v) &&
      v < deckLen - props.numPlayers &&
      (deckLen - v) % props.numPlayers <= props.decks.length * 4,
  );

  if (isLoading) {
    return <div>正在计算底牌数量选项...</div>;
  }

  return (
    <div>
      <label>
        底牌张数：{" "}
        <select
          value={
            props.kittySize !== undefined && props.kittySize !== null
              ? props.kittySize
              : ""
          }
          onChange={handleChange}
        >
          <optgroup label="标准选项">
            <option value="">默认</option>
            {defaultOptions
              .filter((v) => v < deckLen - props.numPlayers)
              .map((v) => (
                <option value={v} key={v}>
                  {v} 张
                </option>
              ))}
          </optgroup>
          <optgroup label="需要从牌组中移除部分牌">
            {options.map((v) => (
              <option value={v} key={v}>
                {v} 张
              </option>
            ))}
          </optgroup>
        </select>
      </label>
    </div>
  );
};

export default KittySizeSelector;
