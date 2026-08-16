import * as React from "react";
import { WebsocketContext } from "./WebsocketProvider";
import LabeledPlay from "./LabeledPlay";
import PublicRoomsPane from "./PublicRoomsPane";
import { isWasmAvailable } from "./detectWasm";

import type { JSX } from "react";

interface IProps {
  name: string;
  room_name: string;
  setName: (name: string) => void;
  setRoomName: (name: string) => void;
}

const buttonStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  padding: "13px 24px",
  minWidth: 190,
  borderRadius: 10,
  border: "1px solid #8f0010",
  background: "#bb0313",
  color: "white",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "white",
  color: "#8f0010",
};

const inputStyle: React.CSSProperties = {
  fontSize: 18,
  padding: "11px 12px",
  borderRadius: 8,
  border: "1px solid #aaa",
  width: "min(100%, 320px)",
  boxSizing: "border-box",
};

const JoinRoom = (props: IProps): JSX.Element => {
  const [editable, setEditable] = React.useState<boolean>(false);
  const [showRoomForm, setShowRoomForm] = React.useState<boolean>(
    props.room_name.length === 16,
  );
  const { send } = React.useContext(WebsocketContext);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void =>
    props.setName(event.target.value.trim());

  const handleRoomChange = (event: React.ChangeEvent<HTMLInputElement>): void =>
    props.setRoomName(event.target.value.trim());

  const handleSubmit = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    if (props.name.length > 0 && props.room_name.length === 16) {
      send({
        room_name: props.room_name,
        name: props.name,
        disable_compression: !isWasmAvailable(),
      });
    }
  };

  const generateRoomName = (mode: "Tractor" | "FindingFriends"): void => {
    sessionStorage.setItem("yihuaDesiredGameMode", mode);
    const arr = new Uint8Array(8);
    window.crypto.getRandomValues(arr);
    props.setRoomName(
      Array.from(arr, (d) => ("0" + d.toString(16)).substr(-2)).join(""),
    );
    setEditable(false);
    setShowRoomForm(true);
  };

  const joinExistingRoom = (): void => {
    sessionStorage.removeItem("yihuaDesiredGameMode");
    props.setRoomName("");
    setEditable(true);
    setShowRoomForm(true);
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
      <div style={{ margin: "12px auto 26px", display: "inline-block" }}>
        <LabeledPlay
          cards={["🃟", "🃟", "🃏", "🃏"]}
          trump={{ NoTrump: {} }}
          label={null}
        />
      </div>

      {!showRoomForm ? (
        <section>
          <h2 style={{ fontSize: 28, marginBottom: 10 }}>请选择玩法</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7 }}>
            新建房间时直接选择「升级 / Tractor」或「找朋友 / Finding Friends」。
          </p>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              margin: "28px 0 16px",
            }}
          >
            <button
              type="button"
              style={buttonStyle}
              onClick={() => generateRoomName("Tractor")}
            >
              升级 / Tractor
            </button>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => generateRoomName("FindingFriends")}
            >
              找朋友 / Finding Friends
            </button>
          </div>
          <div style={{ margin: "14px 0 28px" }}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={joinExistingRoom}
            >
              加入已有房间
            </button>
          </div>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 520,
            margin: "0 auto 30px",
            padding: "24px 20px",
            border: "1px solid #ddd",
            borderRadius: 14,
          }}
        >
          <h2 style={{ marginTop: 0 }}>进入游戏</h2>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{ display: "block", fontWeight: 700, marginBottom: 8 }}
            >
              房间代码
            </label>
            {editable ? (
              <input
                type="text"
                style={inputStyle}
                placeholder="请输入16位房间代码"
                value={props.room_name}
                onChange={handleRoomChange}
                maxLength={16}
              />
            ) : (
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  wordBreak: "break-all",
                }}
              >
                <span
                  title="修改房间代码"
                  onClick={() => setEditable(true)}
                  style={{ cursor: "pointer" }}
                >
                  {props.room_name}
                </span>{" "}
                <span
                  title="生成新的升级房间"
                  onClick={() => generateRoomName("Tractor")}
                  style={{ cursor: "pointer" }}
                >
                  🎲
                </span>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 22 }}>
            <label
              style={{ display: "block", fontWeight: 700, marginBottom: 8 }}
            >
              玩家姓名
            </label>
            <input
              type="text"
              style={inputStyle}
              placeholder="请输入您的姓名"
              value={props.name}
              onChange={handleChange}
              autoFocus={true}
            />
          </div>
          <button
            type="submit"
            style={{
              ...buttonStyle,
              opacity:
                props.room_name.length !== 16 ||
                props.name.length === 0 ||
                props.name.length > 32
                  ? 0.5
                  : 1,
            }}
            disabled={
              props.room_name.length !== 16 ||
              props.name.length === 0 ||
              props.name.length > 32
            }
          >
            加入（或创建）游戏
          </button>
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="normal"
              onClick={() => setShowRoomForm(false)}
            >
              返回选择玩法
            </button>
          </div>
        </form>
      )}

      <div
        style={{
          textAlign: "left",
          fontSize: 16,
          lineHeight: 1.75,
          margin: "30px auto",
          maxWidth: 680,
        }}
      >
        <p>进入游戏后，把房间链接发给至少三位朋友，就可以开始打牌。</p>
        <p>
          如果您还不熟悉玩法，可以先阅读{" "}
          <a href="rules.html" target="_blank">
            游戏规则
          </a>
          。升级各地玩法差异很多，请在开始前查看游戏设置，确认已经选择您习惯的规则。
        </p>
      </div>
      <div style={{ textAlign: "left", maxWidth: 680, margin: "0 auto" }}>
        <PublicRoomsPane setRoomName={props.setRoomName} />
      </div>
    </div>
  );
};

export default JoinRoom;
