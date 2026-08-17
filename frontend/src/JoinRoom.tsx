import * as React from "react";
import { WebsocketContext } from "./WebsocketProvider";
import { TimerContext } from "./TimerProvider";
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

const ROOM_CODE_LENGTH = 2;

const JoinRoom = (props: IProps): JSX.Element => {
  const [editable, setEditable] = React.useState<boolean>(false);
  const [shouldGenerate, setShouldGenerate] = React.useState<boolean>(
    props.room_name.length !== ROOM_CODE_LENGTH,
  );
  const [creatingNewRoom, setCreatingNewRoom] = React.useState<boolean>(
    props.room_name.length !== ROOM_CODE_LENGTH,
  );
  const { send } = React.useContext(WebsocketContext);
  const { setTimeout } = React.useContext(TimerContext);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void =>
    props.setName(event.target.value.trim());

  const handleRoomChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setCreatingNewRoom(false);
    props.setRoomName(event.target.value.replace(/\D/g, "").slice(0, ROOM_CODE_LENGTH));
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

  const editableRoomName = (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]{2}"
      placeholder="请输入2位房间代码"
      value={props.room_name}
      onChange={handleRoomChange}
      maxLength={ROOM_CODE_LENGTH}
    />
  );
  const nonEditableRoomName = (
    <span
      title="设置房间名称"
      onClick={(evt) => {
        evt.preventDefault();
        setEditable(true);
      }}
    >
      {props.room_name}
    </span>
  );

  const generateRoomName = (): void => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    setShouldGenerate(false);
    setCreatingNewRoom(true);
    props.setRoomName(String(arr[0] % 100).padStart(ROOM_CODE_LENGTH, "0"));
  };

  if (shouldGenerate) {
    setTimeout(generateRoomName, 0);
  }

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
              {editable ? editableRoomName : nonEditableRoomName}{" "}
              <span title="生成新房间" onClick={() => generateRoomName()}>
                🎲
              </span>{" "}
            </label>
          </h2>
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
          <input
            type="submit"
            value="加入（或创建）游戏"
            disabled={
              props.room_name.length !== ROOM_CODE_LENGTH ||
              props.name.length === 0 ||
              props.name.length > 32
            }
          />
        </div>
      </form>
      <div>
        <p>
          欢迎来到升级 /
          找朋友游戏！在上方输入您的姓名即可创建新游戏；如果房间已经存在，也可以重新加入。
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
