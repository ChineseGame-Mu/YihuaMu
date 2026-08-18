import * as React from "react";
import { WebsocketContext } from "./WebsocketProvider";
import LabeledPlay from "./LabeledPlay";
import PublicRoomsPane from "./PublicRoomsPane";
import { isWasmAvailable } from "./detectWasm";

import type { JSX } from "react";

type GameModeChoice = "Tractor" | "FindingFriends";

interface IProps {
  name: string;
  room_name: string;
  setName: (name: string) => void;
  setRoomName: (name: string) => void;
  gameMode?: GameModeChoice;
}

export const ROOM_CODE_LENGTH = 4;

const JoinRoom = (props: IProps): JSX.Element => {
  const [creatingNewRoom, setCreatingNewRoom] = React.useState<boolean>(
    props.room_name.length !== ROOM_CODE_LENGTH,
  );
  const { send } = React.useContext(WebsocketContext);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void =>
    props.setName(event.target.value.trim());

  const handleRoomChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setCreatingNewRoom(false);
    props.setRoomName(
      event.target.value.replace(/\D/g, "").slice(0, ROOM_CODE_LENGTH),
    );
  };

  const handleSubmit = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    if (props.name.length > 0 && props.room_name.length === ROOM_CODE_LENGTH) {
      send({
        room_name: props.room_name,
        name: props.name,
        disable_compression: !isWasmAvailable(),
      });

      if (creatingNewRoom) {
        const gameMode = props.gameMode ?? "Tractor";
        if (gameMode === "Tractor") {
          send({ Action: { SetGameMode: "Tractor" } });
        } else {
          send({
            Action: {
              SetGameMode: {
                FindingFriends: {
                  num_friends: null,
                },
              },
            },
          });
        }
      }
    }
  };

  const generateRoomName = React.useCallback((): void => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const code = String(arr[0] % 10000).padStart(ROOM_CODE_LENGTH, "0");
    setCreatingNewRoom(true);
    props.setRoomName(code);
  }, [props.setRoomName]);

  React.useEffect(() => {
    if (props.room_name.length === 0) {
      generateRoomName();
    }
  }, [props.room_name.length, generateRoomName]);

  const canSubmit =
    props.room_name.length === ROOM_CODE_LENGTH &&
    props.name.length > 0 &&
    props.name.length <= 32;

  const submitLabel = creatingNewRoom
    ? `创建并进入房间 ${props.room_name}`
    : `进入指定房间 ${props.room_name}`;

  return (
    <div>
      <LabeledPlay
        cards={["🃟", "🃟", "🃏", "🃏"]}
        trump={{ NoTrump: {} }}
        label={null}
      ></LabeledPlay>
      <form className="join-room" onSubmit={handleSubmit}>
        <div>
          <h2>
            <label>
              <strong>房间代码：</strong>{" "}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                aria-label="4位房间代码"
                placeholder="输入4位房间号"
                value={props.room_name}
                onChange={handleRoomChange}
                maxLength={ROOM_CODE_LENGTH}
                style={{ width: "5em", fontSize: "1em" }}
              />
            </label>
          </h2>
          <p>
            <strong>加入朋友的房间：</strong>
            把上面的4位号码改成朋友给您的房间号，然后点击下面的“进入指定房间”按钮。
          </p>
        </div>
        <div>
          <label>
            <strong>玩家姓名：</strong>{" "}
            <input
              type="text"
              placeholder="请输入您的姓名"
              value={props.name}
              onChange={handleChange}
              autoFocus={true}
            />
          </label>
        </div>
        <div style={{ marginTop: "1em", marginBottom: "1em" }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              fontSize: "1.15em",
              fontWeight: 700,
              padding: "0.6em 1em",
              minWidth: "15em",
            }}
          >
            {submitLabel}
          </button>
        </div>
      </form>
      <div>
        <p>
          欢迎来到升级 / 找朋友游戏！4位房间代码创建后会保持不变。把房间代码或当前页面链接发给朋友，对方即可进入同一个房间。
        </p>
        <p>
          如果您还不熟悉玩法，可以先阅读{" "}
          <a href="rules.html" target="_blank">
            游戏规则
          </a>{" "}
          。也可以使用与另一位玩家完全相同的姓名加入，以旁观该玩家的牌局。
        </p>
        <p>进入游戏后，把房间链接发给至少三位朋友，就可以开始打牌。</p>
        <p>
          各地玩法差异很多，请在开始前查看游戏设置，确认是否已经选择您习惯的规则。页面顶部的齿轮按钮还可以调整个人显示方式。
        </p>
      </div>
      <PublicRoomsPane setRoomName={props.setRoomName} />
    </div>
  );
};

export default JoinRoom;
