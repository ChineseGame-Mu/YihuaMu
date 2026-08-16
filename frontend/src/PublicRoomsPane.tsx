import * as React from "react";
import { useEffect, useState, type JSX } from "react";
import styled from "styled-components";

const Row = styled.div`
  display: table-row;
  line-height: 23px;
`;
const LabelCell = styled.div`
  display: table-cell;
  padding-right: 2em;
  font-weight: bold;
  width: 200px;
`;
const Cell = styled.div`
  display: table-cell;
`;

interface RowIProps {
  roomName: string;
  numPlayers: number;
  setRoomName: (name: string, e: React.MouseEvent) => void;
}

const PublicRoomRow = ({
  roomName,
  numPlayers,
  setRoomName,
}: RowIProps): JSX.Element => {
  return (
    <Row>
      <Cell>
        <button onClick={(e) => setRoomName(roomName, e)} className="normal">
          {roomName}
        </button>
      </Cell>
      <Cell>{numPlayers}</Cell>
    </Row>
  );
};

interface IProps {
  setRoomName: (name: string) => void;
}

const PublicRoomsPane = (props: IProps): JSX.Element => {
  const [publicRooms, setPublicRooms] = useState<any[]>([]);

  useEffect(() => {
    loadPublicRooms();
  }, []);
  const loadPublicRooms = (): void => {
    try {
      const fetchAsync = async (): Promise<void> => {
        const fetchResult = await fetch("public_games.json");
        const resultJSON = await fetchResult.json();
        setPublicRooms(resultJSON);
      };

      fetchAsync().catch((e) => {
        console.error(e);
      });
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="">
      <h3>公开房间</h3>
      <div>
        <p>下面的牌局对所有人开放。您可以加入房间，与新的牌友一起玩。</p>
      </div>
      <div style={{ display: "table", borderSpacing: 10 }}>
        <Row>
          <LabelCell>房间代码</LabelCell>
          <LabelCell>玩家人数</LabelCell>
          <LabelCell>
            <button onClick={loadPublicRooms} className="normal">
              刷新
            </button>
          </LabelCell>
        </Row>
        {publicRooms.length === 0 && <Cell>目前没有公开房间</Cell>}
        {publicRooms.map((roomInfo) => {
          return (
            <PublicRoomRow
              key={roomInfo.name}
              roomName={roomInfo.name}
              numPlayers={roomInfo.num_players}
              setRoomName={props.setRoomName}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PublicRoomsPane;
