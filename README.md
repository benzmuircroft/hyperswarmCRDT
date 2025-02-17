# 🕳️🥊HyperswarmCRDT 🐦‍⬛ 

CRDT on Yjs shared via hyperswarmRouter = opinion / consensus / voting (WIP)

## Installation
```
npm install "github:benzmuircroft/hyperswarmCRDT"
```

## Usage
```js
// First peer
(async () => {
  const router = await require('hyperswarmRouter')('c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f');
  const x = await require('hyperswarmCRDT')({
    network: router,
    join: 'myApp:test'
  });
  console.log('... waiting');
})();
```
```js
// Second peer
(async () => {
  const router = await require('hyperswarmRouter')('c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f');
  const x = await require('hyperswarmCRDT')({
    network: router,
    join: 'myApp:test'
  });
  console.log('... ready to share');
  
  x.getMap('myDoc');

  await x.mapSet('myDoc', 'myKey', 'myValue');
  
})();
```
