import { useState } from "react";
import "./App.css";
import { Client, Hint } from "archipelago.js";

type PlayerInfo = {
  client: Client;
  hints: Hint[];
};

async function login(
  url: string,
  name: string,
  connectedClients: Map<string, PlayerInfo>,
): Promise<Map<string, PlayerInfo>> {
  const client = new Client();

  await client.login(url, name).then(async () => {
    const player = client.players.self;
    console.log(
      `Logged in as ${player.name}(${player.alias}) playing ${player.game}`,
    );
    if (connectedClients.has(player.name)) {
      console.error("Logging in as already logged in client");
      return;
    }

    let playerInfo: PlayerInfo = { client: client, hints: [] };

    connectedClients.set(player.name, playerInfo);

    if (connectedClients.size < 2) {
      // We need to connect all other clients.
      const promises = [];
      for (const slotInfo of Object.values(client.players.slots).filter(
        (si) => si.name !== name,
      )) {
        // TODO: Make parallel instead.
        promises.push(login(url, slotInfo.name, connectedClients));
      }
      await Promise.all(promises);
    }
  });

  return connectedClients;
}

function App() {
  const [connectedClients, setConnectedClients] = useState(
    new Map<string, PlayerInfo>(),
  );

  const classProgression = "hint-progression";
  const classUseful = "hint-useful";

  function playerHintNode(hint: Hint) {
    // To avoid clutter of information, we only want to include hints for progression items that haven't been found yet.
    // TODO: Maybe filter this earlier?
    if (hint.found || !hint.item.progression) {
      return null;
    }

    const classes = `${hint.item.progression ? classProgression : ""} ${hint.item.useful ? classUseful : ""}`;

    return (
      <li key={hint.item.toString()} className={classes}>
        <div className="hint-item-name">{hint.item.toString()}</div>
        <div className="hint-item-location">{hint.item.locationName}</div>
        <div className="hint-item-sender">{hint.item.sender.toString()}</div>
        <div className="hint-found">{hint.found}</div>
      </li>
    );
  }

  function playerInfoNode(playerInfo: PlayerInfo) {
    /**
     * Compares two hints by their importance.
     * Progression items are ranked highest, followed by useful items, followed by lexicographical order.
     */
    // TODO: Figure out how to sort.
    // function hintImportanceComparator(a: HTMLElement, b: HTMLElement): number {
    //   const aName = a.querySelector(".hint-item-name")?.textContent ?? ""
    //   const bName = b.querySelector(".hint-item-name")?.textContent ?? ""
    //   if (!aName) {
    //     console.warn(`Hint node ${a} doesn't have a name`)
    //   }
    //   if (!bName) {
    //     console.warn(`Hint node ${b} doesn't have a name`)
    //   }
    //   return (+b.classList.contains(classProgression) - +a.classList.contains(classProgression)) || (+b.classList.contains(classUseful) - +a.classList.contains(classUseful)) || aName.localeCompare(bName)
    // }

    return (
      <div key={playerInfo.client.players.self.slot}>
        <div>
          <span className="alias">{playerInfo.client.players.self.alias}</span>
        </div>
        <div className="game">{playerInfo.client.game}</div>
        <div>Hints:</div>
        <ul className="hints">
          {
            // TODO: Sort
            playerInfo.hints.map(playerHintNode)
          }
        </ul>
      </div>
    );
  }

  return (
    <>
      <h1>Hello test!</h1>
      <div id="player-list">
        {[...connectedClients.values()].map(playerInfoNode)}
      </div>
      <div>
        <label htmlFor="login-url-input">
          Enter Archipelago server url and port
        </label>
        <input
          type="text"
          id="login-url-input"
          placeholder="192.168.1.107:38281"
        ></input>
      </div>
      <div>
        <label htmlFor="login-player-name-input">Enter player name</label>
        <input
          type="text"
          id="login-player-name-input"
          placeholder="Login as player"
        ></input>
      </div>
      <div>
        <button
          onClick={async () => {
            const loginPlayerNameInput = document.getElementById(
              "login-player-name-input",
            ) as HTMLInputElement;
            const loginUrlInput = document.getElementById(
              "login-url-input",
            ) as HTMLInputElement;

            const url = loginUrlInput.value;
            const playerName = loginPlayerNameInput.value;

            const clients = new Map<string, PlayerInfo>();
            const newMap = await login(url, playerName, clients);

            for (const [playerName, info] of newMap) {
              info.client.items.on("hintReceived", (hint) =>
                setConnectedClients((oldConnectedClients) => {
                  const newConnectedClients = new Map(oldConnectedClients);
                  newConnectedClients.get(playerName)!.hints.push(hint);
                  return newConnectedClients;
                }),
              );

              info.hints = await info.client.players.self.fetchHints();
            }

            setConnectedClients(newMap);
          }}
          id="login-button"
        >
          Login
        </button>
      </div>
    </>
  );
}

export default App;
