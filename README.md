# 🕳️🥊HyperswarmCRDT 🐦‍⬛ 

CRDT on [Yjs](https://docs.yjs.dev/api/y.doc) shared via [hyperswarmRouter](https://github.com/benzmuircroft/hyperswarmRouter) = opinion / consensus / voting (WIP)

## Installation
```
npm install "github:benzmuircroft/hyperswarmCRDT"
```

## Usage
```js
// First peer
(async () => {
  const router = await require('hyperswarmRouter')('c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f');
  const crdt = await require('hyperswarmCRDT')({
    network: router,
    join: 'same-room-as-each-other-with-other-peers',
    testing: true // to log changes
  });
  console.log('... waiting');
  // will print "myDoc { myKey: 'myValue' }"
})();
```
```js
// Second peer
(async () => {
  const router = await require('hyperswarmRouter')('c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f');
  const crdt = await require('hyperswarmCRDT')({
    network: router,
    join: 'same-room-as-each-other-with-other-peers'
  });
  console.log('... ready to share');
  crdt.getMap('myDoc');
  await crdt.mapSet('myDoc', 'myKey', 'myValue');
})();
```

## API
```js
crdt.getMap('myDoc'); // create a map

await crdt.mapSet('myDoc', 'myKey', 'myValue'); // add or update a key

await crdt.mapDel('myDoc', 'myKey'); // delete a key
```
