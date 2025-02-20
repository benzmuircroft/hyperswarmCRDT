const hyperswarmCRDT = async (options) => {
  return new Promise(async (resolve) => {

    if (typeof options.join !== 'string') throw new Error('options.join should be a string');
    if (!options.network?.isHyperswarmRouter) throw new Error('network must be an instance of hyperswarmRouter module');

    const Y = await import('yjs');
    
    let broadcast;

    const y = {
      doc: new Y.Doc()
    };

    function getMap(name) {
      return new Promise(async (done) => {
        if (name == 'doc') throw new Error(`crdt name 'doc' is protected`);
        y[name] = y.doc.getMap();
        done();
      });
    }
    
    function mapSet(name, key, val) {
      return new Promise(async (done) => {
        if (name == 'doc') throw new Error(`crdt name 'doc' is protected`);
        y[name].set(key, val);
        console.log(y[name].toJSON());
        const update = Y.encodeStateAsUpdate(y.doc);
        await broadcast({ name, update });
        done();
      });
    }

    function mapDel(name, key) {
      return new Promise(async (done) => {
        if (name == 'doc') throw new Error(`crdt name 'doc' is protected`);
        y[name].delete(key);
        const update = Y.encodeStateAsUpdate(y.doc);
        await broadcast({ name, update });
        done();
      });
    }
    
    broadcast = await options.network.join(options.join, async function handler(d) {
      if (y[d.name] === undefined) await getMap(d.name);
      Y.applyUpdate(y.doc, d.update);
      if (options.testing) console.log(`${d.name}:`, y[d.name].toJSON()); // testing
    });

    resolve({
      y, // todo: can be better!
      getMap,
      mapSet,
      mapDel
    });

  });
};

module.exports = hyperswarmCRDT;
