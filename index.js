/**
 * hyperswarmCRDT - A module for creating a Conflict-Free Replicated Data Type (CRDT) over a Hyperswarm network.
 * 
 * This module uses Yjs for CRDT operations and integrates with a Hyperswarm network for decentralized synchronization.
 * It supports optional LevelDB persistence for data durability and provides methods to get, set, and delete data in a distributed map-like structure.
 * 
 * @param {Object} options - Configuration options for the CRDT instance.
 * @param {string} options.join - The topic to join in the Hyperswarm network for synchronization.
 * @param {Object} options.network - An instance of the `hyperswarmRouter` module for network communication.
 * @param {string} [options.leveldb] - Path to a LevelDB database for persistent storage (optional).
 * @param {Function} [options.observerFunction] - A callback function to observe changes in the CRDT state.
 * @returns {Promise<Object>} - Resolves to a proxy object providing controlled access to the CRDT API.
 */
const hyperswarmCRDT = async (options) => {
  return new Promise(async (resolve) => {

    // Validate input options
    if (typeof options.join !== 'string') throw new Error('options.join should be a string');
    if (!options.network?.isHyperswarmRouter) throw new Error('network must be an instance of hyperswarmRouter module');

    // Import Yjs for CRDT operations
    const Yjs = await import('yjs');
    
    // Declare variables for persistence, Yjs documents, handlers, and cache
    let 
      LeveldbPersistence
    , persistence
    , y = {} // The Yjs document and its index (ix) in JSON format
    , h = {} // Handlers for Yjs maps/arrays and the index handler
    , c = {} // Cache for the current state of the CRDT
    , broadcast // Function to broadcast updates to the network
    ;

    // Initialize LevelDB persistence if enabled
    if (options.leveldb) {
      LeveldbPersistence = (await import('y-leveldb')).LeveldbPersistence;
      persistence = new LeveldbPersistence(options.leveldb);
      y = {
        doc: await persistence.getYDoc(options.leveldb), // Load or create the Yjs document
        ix: undefined // Initialize the index map later
      };
      const stateVector = await persistence.getStateVector(options.leveldb);
      if (stateVector && stateVector.length > 1) {  // Existing data in LevelDB
        h.ix = y.doc.getMap('ix'); // Get the index map
        y.ix = h.ix.toJSON(); // Convert the index map to JSON
      }
      else { // New data (no existing state)
        h.ix = y.doc.getMap('ix'); // Create a new index map
        y.ix = {}; // Initialize the index as an empty object
      }
      // Load existing maps and arrays from the index into handlers and cache
      c = {};
      if (Object.keys(y.ix).length > 0) {
        for (const [key, val] of Object.keys(y.ix)) { // Iterate over the index keys
          if (val == 'map') h[key] = y.doc.getMap(key); // Create a handler for each map
          else h[key] = y.doc.getArray(key); // or array
          c[key] = h[key].toJSON(); // Cache the current state of the map or array
        }
      }
    }
    else { // No LevelDB persistence
      y = {
        ix: undefined, // Index map handler
        doc: new Yjs.Doc() // Create a new Yjs document
      };
      h.ix = y.doc.getMap('ix'); // Initialize the index map
      y.ix = {}; // Initialize the index as an empty object
      c = {}; // Initialize the cache as an empty object
    }

    // Error message for protected CRDT names
    const errProtected = `crdt names 'ix, doc' are protected`;
    const errType = `supported crdt types include 'map, array' only`;
    const errMapExpected = `this function is for 'map' only`;
    const errArrayExpected = `this function is for 'array' only`;

    /**
     * Get or create a new map in the CRDT.
     *
     * @param {string} name - The name of the map to get or create.
     * @returns {Promise<void>} - Resolves when the map is ready.
     */
    async function map(name) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        else if (!h[name]) { // If the map doesn't exist
          h[name] = y.doc.getMap(name); // Create a new map
        }
        c[name] = h[name].toJSON(); // Update the cache with the map's current state
        if (!y.ix[name]) { // If the map is not in the index
          y.ix[name] = 'map'; // Add it to the index
          h.ix.set(name, y.ix[name]); // Update the index map
          const update = Yjs.encodeStateAsUpdate(y.doc); // Encode the update
          if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
          await broadcast({ name, update }); // Broadcast the update to the network
        }
        done();
      });
    }
    
    /**
     * Set a key-value pair in a map.
     * 
     * @param {string} name - The name of the map.
     * @param {string} key - The key to set.
     * @param {any} val - The value to set.
     * @returns {Promise<void>} - Resolves when the update is complete.
     */
    async function set(name, key, val) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        if (y.ix != 'map') throw new Error(errMapExpected); // limit this function to use with maps
        if (!h[name]) await map(name); // create the map if it doesn't exist
        h[name].set(key, val); // Set the key-value pair in the map
        c[name][key] = val; // Update the cache
        const update = Yjs.encodeStateAsUpdate(y.doc); // Encode the update
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
        await broadcast({ name, update }); // Broadcast the update to the network
        done();
      });
    }

    /**
     * Delete a key from a map.
     * 
     * @param {string} name - The name of the map.
     * @param {string} key - The key to delete.
     * @returns {Promise<void>} - Resolves when the update is complete.
     */
    async function del(name, key) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        if (y.ix != 'map') throw new Error(errMapExpected); // limit this function to use with maps
        h[name].delete(key); // Delete the key from the map
        delete c[name][key]; // Update the cache
        const update = Yjs.encodeStateAsUpdate(y.doc); // Encode the update
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
        await broadcast({ name, update }); // Broadcast the update to the network
        done();
      });
    }

    /**
     * Get or create a new array in the CRDT.
     *
     * @param {string} name - The name of the array to get or create.
     * @returns {Promise<void>} - Resolves when the array is ready.
     */
    async function array(name) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        else if (!h[name]) { // If the map doesn't exist
          h[name] = y.doc.getArray(name); // Create a new array
        }
        c[name] = h[name].toJSON(); // Update the cache with the map's current state
        if (!y.ix[name]) { // If the map is not in the index
          y.ix[name] = 'array'; // Add it to the index
          h.ix.set(name, y.ix[name]); // Update the index map
          const update = Yjs.encodeStateAsUpdate(y.doc); // Encode the update
          if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
          await broadcast({ name, update }); // Broadcast the update to the network
        }
        done();
      });
    }

    /**
     * Inserts content at specified index in the named array
     * @param {string} name - Array identifier
     * @param {number} index - Position to insert at
     * @param {*} content - Content to insert
     * @returns {Promise} Resolves when operation completes
     */
    async function insert(name, index, content) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        if (y.ix != 'array') throw new Error(errArrayExpected); // limit this function to use with arrays
        h[name].insert(index, content); // modify
        c[name] = h[name].toJSON(); // Update the cache
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
        await broadcast({ name, update }); // Broadcast the update to the network
        done();
      });
    }

    /**
     * Adds value to end of the named array
     * @param {string} name - Array identifier  
     * @param {*} val - Value to append
     * @returns {Promise} Resolves when operation completes
     */
    async function push(name, val) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        if (y.ix != 'array') throw new Error(errArrayExpected); // limit this function to use with arrays
        h[name].push(val); // modify
        c[name] = h[name].toJSON(); // Update the cache
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
        await broadcast({ name, update }); // Broadcast the update to the network
        done();
      });
    }

    /**
     * Adds value to beginning of the named array
     * @param {string} name - Array identifier
     * @param {*} val - Value to prepend
     * @returns {Promise} Resolves when operation completes
     */
    async function unshift(name, val) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        if (y.ix != 'array') throw new Error(errArrayExpected); // limit this function to use with arrays
        h[name].unshift(val); // modify
        c[name] = h[name].toJSON(); // Update the cache
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
        await broadcast({ name, update }); // Broadcast the update to the network
        done();
      });
    }

    /**
     * Removes elements from the named array
     * @param {string} name - Array identifier
     * @param {number} index - Starting position to remove from
     * @param {number} length - Number of elements to remove
     * @returns {Promise} Resolves when operation completes
     */
    async function cut(name, index, length) {
      return new Promise(async (done) => {
        if (['ix', 'doc'].includes(name)) throw new Error(errProtected); // Prevent overwriting protected names
        if (y.ix != 'array') throw new Error(errArrayExpected); // limit this function to use with arrays
        h[name].delete(index, length); // modify
        c[name] = h[name].toJSON(); // Update the cache
        if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
        await broadcast({ name, update }); // Broadcast the update to the network
        done();
      });
    }
    
    // Join the Hyperswarm network and set up the broadcast handler
    broadcast = await options.network.join(options.join, async function handler(d) {
      Yjs.applyUpdate(y.doc, d.update); // Apply the received update to the Yjs document
      if (options.leveldb) await persistence.storeUpdate(options.leveldb, update); // Persist the update
      // Update local handlers and cache based on the index map
      const diffs = y.doc.ix.toJSON();
      for (const [key, value] of Object.entries(diffs)) { // Iterate over the index map
        if (!y.ix[key]) { // If the map/array is not in the local index
          y.ix[key] = value; // Add it to the index
          if (value == 'map') h[key] = y.doc.getMap(key); // Create a handler for the map
          else h[key] = y.doc.getArray(key); // Create a handler for the array
        }
        c[key] = h[key].toJSON(); // Update the cache
      }
      // Trigger the observer function if provided
      if (options.observerFunction) {
        options.observerFunction(Object.freeze({ ...c })); // Pass a frozen copy of the cache
      }
    });
    
    // Create a new object with no prototype inheritance
    const api = Object.create(null, {
      // Define c as a getter property that returns a frozen copy of the cache
      c: {
        get() { return Object.freeze({ ...c }) }
      },
      // Define non-enumerable method properties
      map: { value: map },  // Method to get/create new maps
      set: { value: set },  // Method to set values in maps
      del: { value: del },  // Method to delete values from maps
      array: { value: array },  // Method to get/create new arrays
      insert: { value: insert }, // Method to insert content into arrays
      push: { value: push }, // Method to put a value to the back of an array
      unshift: { value: unshift }, // Method to put a value at the front of an array
      cut: { value: cut } // Method to remove a index from an array
    });

    // Add proxy to handle direct property access
    const proxy = new Proxy(api, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return target.c[prop]; // Return cached data for direct property access
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
