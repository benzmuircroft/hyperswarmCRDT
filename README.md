# 🕳️🥊hyperswarmCRDT 🐦‍⬛ 

CRDT for y-map and y-array on [Yjs](https://docs.yjs.dev/api/y.doc) shared via [hyperswarmRouter](https://github.com/benzmuircroft/hyperswarmRouter) and stored using standard [y-leveldb](https://github.com/yjs/y-leveldb) storage adaptor.

## TODO
- WIP: allow a leader with the optional observerFunction to also broadcast task-at-hand

## Installation
```
npm install "github:benzmuircroft/hyperswarmCRDT"
```

## Usage
```js
// First peer
(async () => {
  const router = await require('hyperswarmRouter')('c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f'); // any 64 hex
  const crdt = await require('hyperswarmCRDT')({
    network: router,
    join: 'same-room-as-each-other-with-other-peers',
    // leveldb: './leveldb', // using RAM instead
    observerFunction: function(output) {
      console.log(output);
    }
  });
  console.log('... waiting');
  // will print output from the observer function
  // "myDoc {}"
  // "myDoc { myKey: 'myValue' }"
  // (note: this user can access all methods just as the second user below ...)
})();
```
```js
// Second peer
(async () => {
  const router = await require('hyperswarmRouter')('c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f'); // any 64 hex
  const crdt = await require('hyperswarmCRDT')({
    network: router,
    leveldb: './leveldb', // using persistance (name the folder what you like)
    join: 'same-room-as-each-other-with-other-peers'
  });
  console.log('... ready to share');
  console.log('0 crdt:', crdt); // 0 crdt: {}
  crdt.map('myDoc');
  console.log('1 crdt:', crdt); // 1 crdt: { myDoc: {} }
  console.log('shared:', crdt.myDoc ? crdt.myDoc : 'nothing yet');
  await crdt.set('myDoc', 'myKey', 'myValue');
  console.log('2 crdt:', crdt); // 2 crdt: { myDoc: { myKey: 'MyVal' } }
})();
```

## API
```js
crdt.map('myDoc'); // create a map

await crdt.set('myDoc', 'myKey', 'myValue'); // add or update a key

await crdt.del('myDoc', 'myKey'); // delete a key

console.log(crdt); // will print the whole shared object

console.log(crdt.myDoc); // prints a map 

console.log(crdt.myDoc.myKey); // prints the value of a map's key
```
