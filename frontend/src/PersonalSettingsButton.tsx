import * as React from "react";
import ReactModal from "react-modal";
import { getPersonalEmail, setPersonalEmail } from "./personalSettings";

interface PersonalSettingsButtonProps {
  playerName?: string;
  openSignal?: number;
}

const PersonalSettingsButton = ({
  playerName = "",
  openSignal = 0,
}: PersonalSettingsButtonProps): React.ReactElement => {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    if (open) setEmail(getPersonalEmail(playerName));
  }, [open, playerName]);

  React.useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  const updateEmail = (value: string): void => {
    setEmail(value);
    setPersonalEmail(playerName, value);
  };

  return (
    <>
      <button
        type="button"
        className="normal"
        onClick={() => setOpen(true)}
        aria-label="个人设置"
      >
        个人设置
      </button>
      <ReactModal
        isOpen={open}
        onRequestClose={() => setOpen(false)}
        shouldCloseOnOverlayClick
        shouldCloseOnEsc
        contentLabel="个人设置"
        style={{
          content: {
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "min(520px, 88vw)",
            height: "fit-content",
            transform: "translate(-50%, -50%)",
            padding: "24px",
          },
        }}
      >
        <section className="guandan-personal-settings">
          <h2>个人设置</h2>
          <label htmlFor="personal-victory-email">胜利截图接收邮箱</label>
          <input
            id="personal-victory-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => updateEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <p>
            打A获胜后，全屏获胜截图会发送到此邮箱。设置按玩家名保存在此浏览器，并供本站游戏共用。
          </p>
          <button
            type="button"
            className="normal"
            onClick={() => setOpen(false)}
          >
            完成
          </button>
        </section>
      </ReactModal>
    </>
  );
};

export default PersonalSettingsButton;
