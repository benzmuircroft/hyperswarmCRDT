# 🕳️🥊HyperswarmCRDT 🐦‍⬛ 

CRDT on [Yjs](https://docs.yjs.dev/api/y.doc) shared via [hyperswarmRouter](https://github.com/benzmuircroft/hyperswarmRouter) and stored using standard y-leveldb storage adaptor.

## TODO
- Add y-array
- WIP: allow an leader with the optional observerFunction to also broadcast task-at-hand

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
    // leveldb: './leveldb', // using RAM instead
    observerFunction: function(output) {
      console.log('output:', output);
    }
  });
  console.log('... waiting');
  // will print "myDoc { myKey: 'myValue' }" from the observer function
})();
```
```js
// Second peer
(async () => {
  const router = await require('hyperswarmRouter')('c915296031bf40b58ef7f1d6b883512e799c1982b83acdc7ce27a2079a8c196f');
  const crdt = await require('hyperswarmCRDT')({
    network: router,
    leveldb: './leveldb', // using persistance (name the folder what you like)
    join: 'same-room-as-each-other-with-other-peers'
  });
  console.log('... ready to share');
  console.log('0 crdt:', crdt);
  crdt.get('myDoc');
  console.log('1 crdt:', crdt);
  console.log('shared:', crdt.myDoc ? crdt.myDoc : 'nothing yet');
  await crdt.set('myDoc', 'myKey', 'myValue');
  console.log('2 crdt:', crdt);
})();
```

## API
```js
crdt.get('myDoc'); // create a map

await crdt.set('myDoc', 'myKey', 'myValue'); // add or update a key

await crdt.del('myDoc', 'myKey'); // delete a key

console.log(crdt); // will print the whole shared object

console.log(crdt.myDoc); // prints a map 

console.log(crdt.myDoc.myKey); // prints the value of a map's key
```
