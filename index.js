const hyperswarmCRDT = async (options) => {
  return new Promise(async (resolve) => {

    if (typeof options.join !== 'string') throw new Error('options.join should be a string');
    if (!options.network?.isHyperswarmRouter) throw new Error('network must be an instance of hyperswarmRouter module');

    const Yjs = await import('yjs');
    
    let 
      LeveldbPersistence
    , persistence
    , y = {} // the doc + the xi to json
    , h = {} // handlers + ix handler (meaning all handlers including ix)
    , c = {} // cache - ix
    , broadcast
    ;

    if (options.leveldb) {
      LeveldbPersistence = (await import('y-leveldb')).LeveldbPersistence;
      persistence = new LeveldbPersistence(options.leveldb);
      y = {
        doc: await persistence.getYDoc(options.leveldb), // todo: here instead
        ix: undefined // assign ix later below
      };
      const stateVector = await persistence.getStateVector(options.leveldb);
      if (stateVector && stateVector.length > 1) {  // existing data
        h.ix = y.doc.getMap('ix');
        y.ix = h.ix.toJSON();
      }
      else { // just created data
        h.ix = y.doc.getMap('ix');
        y.ix = {};
      }
      // unload y.doc into h using y.ix
      c = {};
      if (Object.keys(y.ix).length > 0) {
        for (const key of Object.keys(y.ix)) { // from y = ({ ix, doc }).ix
          h[key] = y.doc.getMap(key);
          c[key] = h[key].toJSON(); // get the real objects from the y.ix keys and translate them to getting from the handlers
        }
      }
    }
    else {
      y = {
        ix: undefined, // index list of crdt-name = map
        doc: new Yjs.Doc()
      };
      h.ix = y.doc.getMap('ix');
      y.ix = {};
      c = {};
    }

    const errProtected = `crdt names 'ix, doc' are protected`;

    async function get(name) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected);
        else if (!h[name]) {
          h[name] = y.doc.getMap(name);
        }
        c[name] = h[name].toJSON();
        if (!y.ix[name]) { // if the ix does not have it
          y.ix[name] = 'map';
          h.ix.set(name, y.ix[name]);
          const update = Yjs.encodeStateAsUpdate(y.doc);
          if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
          await broadcast({ name, update });
        }
        done();
      });
    }
    
    async function set(name, key, val) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected);
        if (!h[name]) await get(name);
        h[name].set(key, val);
        c[name][key] = val;
        console.log(h[name].toJSON());
        const update = Yjs.encodeStateAsUpdate(y.doc);
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
        await broadcast({ name, update });
        done();
      });
    }

    async function del(name, key) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected);
        h[name].delete(key);
        delete c[name][key];
        const update = Yjs.encodeStateAsUpdate(y.doc);
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
        await broadcast({ name, update });
        done();
      });
    }
    
    broadcast = await options.network.join(options.join, async function handler(d) {
      Yjs.applyUpdate(y.doc, d.update);
      if (options.leveldb) await persistence.storeUpdate(options.leveldb, update);
      // keep our mirror local handler object updated as well :
      const diffs = y.doc.ix.toJSON();
      for (const [key, value] of Object.entries(diffs)) { // check the ix map and fix our map handlers
        if (!y.ix[key]) { // if we dont have this map then we dont have the handler
          y.ix[key] = value; // map, todo: array
          if (value == 'map') h[key] = y.doc.getMap(key); // so we can handle them
        }
        c[key] = h[key].toJSON(); // get the real objects from the y.ix keys and translate them to getting from the handlers
      }
      // trigger the observer who could be one or many leader roles
      // they could add functionality or a new task
      if (options.observerFunction) {
        options.observerFunction(Object.freeze({ ...c }));
      }
    });
    
    // Create a new object with no prototype inheritance
    const api = Object.create(null, {
      // Define c as a getter property that returns a frozen copy of internal cache
      c: {
        get() { return Object.freeze({ ...c }) }
      },
      // Define non-enumerable method properties
      get: { value: get },  // Method to get/create new maps
      set: { value: set },  // Method to set values in maps
      del: { value: del },  // Method to delete values from maps
    });

    // Add proxy to handle direct property access
    const proxy = new Proxy(api, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return target.c[prop];
      }
    });

    // Custom object representation that shows only the cache contents
    Object.defineProperty(api, Symbol.for('nodejs.util.inspect.custom'), {
      value: function() { return this.c }
    });

    // Return the API object with controlled access to internal state
    resolve(proxy);

  });
};

module.exports = hyperswarmCRDT;
