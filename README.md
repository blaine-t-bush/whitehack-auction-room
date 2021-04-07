A quick project to emulate Whitehack's auction rolls. In an auction roll, each participant rolls a die in secret. This secret roll modifies the attribute being used in the auction. Thus, the higher your secret roll, the more likely you are to succeed.

This project runs a Node.js server and uses the WebSocket API to communicate between server and clients. The first person to join is the referee. They are the only one who can start the auction and reveal the rolls. Anyone can change their own name at any time.

To start the server, run `node ./server/index.js`. To join the auction room, navigate to `index.html`.
