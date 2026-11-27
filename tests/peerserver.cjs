// a local PeerJS matchmaking server for tests/r17mp.mjs (the game is pointed at it with ?ps=127.0.0.1:9000). Needs `npm i peer`.
const { PeerServer } = require('peer');
PeerServer({ port: 9000, host: '127.0.0.1', path: '/' }, () => console.log('up'));
