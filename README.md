# 🕳️🥊HyperswarmCDRT 🐦‍⬛ 

CRDT on Yjs shared via Hyperswarm = opinion / consensus / voting (WIP)

## Installation
```
npm install "github:benzmuircroft/hyperswarmCDRT"
```

## Usage
```js
// First peer
(async () => {
  const x = await require('./hyperswarmCDRT')({ join: 'c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f' });
  console.log('... wait for this log to start the second peer');
  // expect log of "myDoc: { myKey: 'myValue' }"
})();
```
```js
// Second peer
(async () => {
  const x = await require('./hyperswarmCDRT')({ join: 'c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f' });
  console.log('... ready');
  x.getMap('myDoc');
  await x.mapSet('myDoc', 'myKey', 'myValue');
})();
```
