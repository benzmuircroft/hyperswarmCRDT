const hyperswarmCDRT = async (options) => {
  return new Promise(async (resolve) => {

    if (typeof options.join !== 'string' && options.join.length != 64) throw new Error('options.join should be a 64 character hex code');

    const Hyperswarm = require('hyperswarm');
    const Y = await import('yjs');
    const b4a = require('b4a');
    const cbor = require('cbor');

    const y = {
      doc: new Y.Doc()
    };

    function getMap(name) {
      return new Promise(async (done) => {
        if (name == 'doc') throw new Error(`cdrt name 'doc' is protected`);
        y[name] = y.doc.getMap();
        // const update = Y.encodeStateAsUpdate(y.doc); // todo: rpc tell them to make the new map
        // await broadcast(b4a.from(cbor.encode({ name, update })));
        done();
      });
    }
    
    function mapSet(name, key, val) {
      return new Promise(async (done) => {
        if (name == 'doc') throw new Error(`cdrt name 'doc' is protected`);
        y[name].set(key, val);
        console.log(y[name].toJSON());
        const update = Y.encodeStateAsUpdate(y.doc);
        await broadcast(b4a.from(cbor.encode({ name, update })));
        done();
      });
    }

    function mapDel(name, key) {
      return new Promise(async (done) => {
        if (name == 'doc') throw new Error(`cdrt name 'doc' is protected`);
        y[name].delete(key);
        const update = Y.encodeStateAsUpdate(y.doc);
        await broadcast(b4a.from(cbor.encode({ name, update })));
        done();
      });
    }
    
    

    const swarm = new Hyperswarm();
    const peers = {};

    async function broadcast(encoded) {
      return new Promise(async (done) => {
        for (const peer of Object.values(peers)) {
          console.log('broadcasting ...');
          peer.write(encoded);
        }
        done();
      });
    };

    swarm.on('connection', (peer, info) => { // todo: can the handling of this be done after swarm.flush
      const id = b4a.toString(peer.remotePublicKey, 'hex');
      console.log('peer', id);
      peers[id] = peer;
      peer.once('close', () => delete peers[id]);
      peer.on('data', async d => {
        const decoded = cbor.decode(b4a.from(d));
        if (y[decoded.name] === undefined) await getMap(decoded.name);
        Y.applyUpdate(y.doc, decoded.update);
        console.log(`${decoded.name}:`, y[decoded.name].toJSON()); // testing
      });
      peer.on('error', e => console.log(`Connection error: ${e}`));
    });
    console.log(b4a.alloc(32).fill(options.join));
    const discovery = swarm.join(b4a.alloc(32).fill(options.join), { server: true, client: true });
    await discovery.flushed();
    await swarm.flush();
    swarm.listen(); // todo: in the right order?

    resolve({
      shared: y, // todo: can be better!
      getMap,
      mapSet,
      mapDel
    });

  });
};

module.exports = hyperswarmCDRT;
