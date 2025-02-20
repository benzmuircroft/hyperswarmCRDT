const hyperswarmCRDT = async (options) => {
  return new Promise(async (resolve) => {

    if (typeof options.join !== 'string') throw new Error('options.join should be a string');
    if (!options.network?.isHyperswarmRouter) throw new Error('network must be an instance of hyperswarmRouter module');

    const Yjs = await import('yjs');
    
    let 
    //  LeveldbPersistence
    //, 
      persistence
    , y// the doc + the xi to json
    , h // handlers + ix handler (meaning all handlers including ix)
    , c // cache - ix
    , broadcast
    ;

    if (options.leveldb) {
      persistence = new ((await import('y-leveldb')).LeveldbPersistence(options.leveldb));
      // LeveldbPersistence = (await import('y-leveldb')).LeveldbPersistence;
      // persistence = new LeveldbPersistence(options.leveldb);
      y = {
        doc: await persistence.getYDoc(options.leveldb), // todo: here instead
        ix: undefined // assign ix later below
      };
      h = {
        // doc: await persistence.getYDoc(options.leveldb) // todo: not here
      };
      const stateVector = await persistence.getStateVector(options.leveldb);
      if (stateVector && stateVector.length > 1) {
        // y.ix = y.doc.ix.toJSON(); // existing data
        y.ix = y.doc.ix.toJSON(); // existing data
      }
      else {
        // y.ix = y.doc.getMap(); // just created data
        y.ix = y.doc.getMap(); // just created data
      }
      c = {};
      for (const key of Object.keys(y.ix)) { // from y = ({ ix, doc }).ix
        c[key] = h[key].toJSON(); // get the real objects from the y.ix keys and translate them to getting from the handlers
      }
      /*
      y.doc.on('update', update => {
        console.log('update');
        persistence.storeUpdate(options.leveldb, update);
      });
      */
    }
    else {
      h = {
        ix: undefined, // index list of crdt-name = map
        doc: new Yjs.Doc()
      };
      h.ix = y.doc.getMap();
    }

    const errProtected = `crdt names 'ix, doc' are protected`;

    async function getMap(name) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected);
        else if (!h[name]) {
          h[name] = y.doc.getMap();
        }
        if (!h.ix[name]) {
          // h.ix[name] = 'map';
          y.ix.set(name, 'map'); // y.doc.ix.set(name, 'map');
          //
          console.log('test1:', y.doc.ix, h.ix);
          console.log('test2:', h.ix.toJSON());
          //
          const update = Yjs.encodeStateAsUpdate(y.doc);
          if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
          await broadcast({ name, update });
        }
        done();
      });
    }
    
    async function mapSet(name, key, val) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected);
        h[name].set(key, val);
        console.log(h[name].toJSON());
        const update = Yjs.encodeStateAsUpdate(y.doc);
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
        await broadcast({ name, update });
        done();
      });
    }

    async function mapDel(name, key) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected);
        h[name].delete(key);
        const update = Yjs.encodeStateAsUpdate(y.doc);
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
        await broadcast({ name, update });
        done();
      });
    }


    /*
    * setup joining a sub-topic on the network
    * feed it a handler and a higher handler function
    * return a broadcaster for this network sub-topic
    * todo: setup subscriptions for sub-topics in broadcast (it sends to everyone right now like a machine gun!)
    */
    broadcast = await options.network.join(options.join, async function handler(d) {
      // if (h[d.name] === undefined) await getMap(d.name);
      Yjs.applyUpdate(y.doc, d.update);
      if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
      // keep our mirror local handler object updated as well :
      const diffs = y.doc.ix.toJSON();
      for (const [key, value] of Object.entries(diffs)) { // check the ix map and fix our map handlers
        if (!h.ix[key]) { // if we dont have this map then we dont have the handler
          h.ix[key] = value; // map, todo: array
          if (value == 'map') h[key] = y.doc[key]; // so we can handle them
        }
      }
      if (options.testing) console.log(`${d.name}:`, h[d.name].toJSON()); // testing
      // trigger the observer who could be one or many leader roles
      // they could add functionality or a new task
      if (options.observerFunction) {
        // let output = {}; // todo: do this on load
        for (const key of Object.keys(y.ix)) { // from y = ({ ix, doc }).ix
          c[key] = h[key].toJSON(); // get the real objects from the y.ix keys and translate them to getting from the handlers
        }
        options.observerFunction(output);
      }
    });

    resolve({
      c, //cache collection
      getMap,
      mapSet,
      mapDel
    });

  });
};

module.exports = hyperswarmCRDT;
