// Persistent JSON-backed in-memory MongoDB-compatible store for AI Studio runtime (replaces external MongoDB dependency)
import fs from 'fs';

const DB_FILE = '/tmp/coinspace-db.json';
const collections = new Map();

function serializeVal(val) {
  if (val instanceof Date) {
    return { __csType: 'Date', value: val.toISOString() };
  }
  if (val && typeof val === 'object' && val._bsontype === 'Binary' && val.buffer) {
    return { __csType: 'Binary', value: Buffer.from(val.buffer).toString('base64') };
  }
  if (Buffer.isBuffer(val)) {
    return { __csType: 'Binary', value: val.toString('base64') };
  }
  if (Array.isArray(val)) return val.map(serializeVal);
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) out[k] = serializeVal(v);
    }
    return out;
  }
  return val;
}

function deserializeVal(val) {
  if (Array.isArray(val)) return val.map(deserializeVal);
  if (val && typeof val === 'object') {
    if (val.__csType === 'Date') return new Date(val.value);
    if (val.__csType === 'Binary') return { _bsontype: 'Binary', buffer: Buffer.from(val.value, 'base64') };
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = deserializeVal(v);
    }
    return out;
  }
  return val;
}

function loadPersistedDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [name, docs] of Object.entries(raw)) {
        if (Array.isArray(docs)) {
          collections.set(name, docs.map(deserializeVal));
        }
      }
    }
  } catch { /* ignore corrupt cache file */ }
}

function persistDb() {
  try {
    const data = {};
    for (const [name, docs] of collections.entries()) {
      data[name] = docs.map(serializeVal);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data));
  } catch { /* ignore persistence errors */ }
}

function cloneDoc(val) {
  if (val instanceof Date) return new Date(val.getTime());
  if (val && typeof val === 'object' && val._bsontype === 'Binary' && val.buffer) {
    return { _bsontype: 'Binary', buffer: Buffer.from(val.buffer) };
  }
  if (Buffer.isBuffer(val)) return Buffer.from(val);
  if (Array.isArray(val)) return val.map(cloneDoc);
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = cloneDoc(v);
    }
    return out;
  }
  return val;
}

loadPersistedDb();

function getStore(name) {
  if (!collections.has(name)) {
    collections.set(name, []);
  }
  return collections.get(name);
}

function getByPath(obj, path) {
  const parts = path.split('.');
  let current = [obj];
  for (const part of parts) {
    const next = [];
    for (const item of current) {
      if (item == null) continue;
      if (Array.isArray(item)) {
        for (const el of item) {
          if (el != null && typeof el === 'object' && part in el) {
            next.push(el[part]);
          }
        }
      } else if (typeof item === 'object' && part in item) {
        next.push(item[part]);
      }
    }
    current = next;
  }
  return current;
}

function matchCondition(val, cond) {
  if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date) && !(cond instanceof RegExp)) {
    const keys = Object.keys(cond);
    if (keys.some((k) => k.startsWith('$'))) {
      for (const op of keys) {
        const arg = cond[op];
        if (op === '$ne') {
          if (Array.isArray(val) ? val.includes(arg) : val === arg) return false;
        } else if (op === '$in') {
          const list = Array.isArray(arg) ? arg : [];
          if (Array.isArray(val) ? !val.some((v) => list.includes(v)) : !list.includes(val)) return false;
        } else if (op === '$gte') {
          if (!(val >= arg)) return false;
        } else if (op === '$gt') {
          if (!(val > arg)) return false;
        } else if (op === '$lte') {
          if (!(val <= arg)) return false;
        } else if (op === '$lt') {
          if (!(val < arg)) return false;
        } else if (op === '$not') {
          if (matchCondition(val, arg)) return false;
        } else if (op === '$elemMatch') {
          if (!Array.isArray(val) || !val.some((el) => matchDoc(el, arg))) return false;
        } else if (op === '$nearSphere') {
          // Geo distance check for mecto
          const coords = arg?.$geometry?.coordinates;
          const maxDist = arg?.$maxDistance ?? Infinity;
          if (!coords || !val?.coordinates) return false;
          const [lon1, lat1] = coords;
          const [lon2, lat2] = val.coordinates;
          const R = 6371000;
          const toRad = (d) => (d * Math.PI) / 180;
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
          const dist = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist > maxDist) return false;
        }
      }
      return true;
    }
  }
  return val === cond;
}

function matchDoc(doc, query = {}) {
  if (!query || Object.keys(query).length === 0) return true;
  for (const [key, cond] of Object.entries(query)) {
    if (key === '$or') {
      if (!Array.isArray(cond) || !cond.some((sub) => matchDoc(doc, sub))) return false;
      continue;
    }
    if (key.includes('.')) {
      const vals = getByPath(doc, key);
      if (cond && typeof cond === 'object' && '$ne' in cond) {
        if (vals.some((v) => v === cond.$ne)) return false;
      } else if (vals.length === 0) {
        if (!matchCondition(undefined, cond)) return false;
      } else if (!vals.some((v) => matchCondition(v, cond))) {
        return false;
      }
    } else {
      const val = doc[key];
      if (Array.isArray(val) && !(cond && typeof cond === 'object' && '$elemMatch' in cond)) {
        if (cond && typeof cond === 'object' && '$ne' in cond) {
          if (val.includes(cond.$ne)) return false;
        } else if (!val.some((v) => matchCondition(v, cond)) && !matchCondition(val, cond)) {
          return false;
        }
      } else if (!matchCondition(val, cond)) {
        return false;
      }
    }
  }
  return true;
}

function findMatchedArrayIndex(doc, filter) {
  for (const [key, cond] of Object.entries(filter)) {
    if (key.includes('.')) {
      const [arrField, ...rest] = key.split('.');
      const subPath = rest.join('.');
      const arr = doc[arrField];
      if (Array.isArray(arr)) {
        const idx = arr.findIndex((el) => {
          const vals = getByPath(el, subPath);
          return vals.some((v) => matchCondition(v, cond));
        });
        if (idx !== -1) return { arrField, idx };
      }
    } else if (cond && typeof cond === 'object' && '$elemMatch' in cond && Array.isArray(doc[key])) {
      const idx = doc[key].findIndex((el) => matchDoc(el, cond.$elemMatch));
      if (idx !== -1) return { arrField: key, idx };
    }
  }
  return null;
}

function wrapBson(val) {
  if (Buffer.isBuffer(val)) {
    return { _bsontype: 'Binary', buffer: val };
  }
  if (Array.isArray(val)) return val.map(wrapBson);
  if (val && typeof val === 'object' && !(val instanceof Date) && val._bsontype !== 'Binary') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = wrapBson(v);
    }
    return out;
  }
  return val;
}

function setNested(obj, path, value, positionalIdx) {
  const resolved = path.replace(/\.\$\./g, `.${positionalIdx ?? 0}.`).replace(/\.\$$/, `.${positionalIdx ?? 0}`);
  const parts = resolved.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = wrapBson(value);
}

function incNested(obj, path, delta, positionalIdx) {
  const resolved = path.replace(/\.\$\./g, `.${positionalIdx ?? 0}.`).replace(/\.\$$/, `.${positionalIdx ?? 0}`);
  const parts = resolved.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') {
      cur[p] = {};
    }
    cur = cur[p];
  }
  const leaf = parts[parts.length - 1];
  cur[leaf] = (Number(cur[leaf]) || 0) + delta;
}

function applyUpdate(doc, update, filter, isInsert) {
  const matchInfo = findMatchedArrayIndex(doc, filter);
  const posIdx = matchInfo ? matchInfo.idx : 0;

  if (update.$setOnInsert && isInsert) {
    for (const [k, v] of Object.entries(update.$setOnInsert)) {
      setNested(doc, k, v, posIdx);
    }
  }
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      setNested(doc, k, v, posIdx);
    }
  }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      incNested(doc, k, v, posIdx);
    }
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[k])) doc[k] = [];
      if (v && typeof v === 'object' && '$each' in v) {
        doc[k].push(...v.$each.map(wrapBson));
        if (v.$sort && typeof v.$sort === 'object') {
          const sortEntries = Object.entries(v.$sort);
          doc[k].sort((a, b) => {
            for (const [field, dir] of sortEntries) {
              const av = a?.[field];
              const bv = b?.[field];
              if (av === bv) continue;
              if (av === undefined) return 1;
              if (bv === undefined) return -1;
              return (av < bv ? -1 : 1) * dir;
            }
            return 0;
          });
        }
        if (typeof v.$slice === 'number') {
          doc[k] = v.$slice < 0 ? doc[k].slice(v.$slice) : doc[k].slice(0, v.$slice);
        }
      } else {
        doc[k].push(wrapBson(v));
      }
    }
  }
  if (update.$pull) {
    for (const [k, cond] of Object.entries(update.$pull)) {
      if (Array.isArray(doc[k])) {
        doc[k] = doc[k].filter((item) => {
          if (cond && typeof cond === 'object') {
            return !matchDoc(item, cond);
          }
          return item !== cond;
        });
      }
    }
  }
}

function projectDoc(doc, projection) {
  if (!doc || !projection) return doc;
  const entries = Object.entries(projection);
  if (entries.length === 0) return doc;
  const isInclusion = entries.some(([k, v]) => k !== '_id' && v);
  if (isInclusion) {
    const res = {};
    if (projection._id !== 0 && projection._id !== false && '_id' in doc) {
      res._id = doc._id;
    }
    for (const [k, v] of entries) {
      if (v && k in doc) res[k] = doc[k];
    }
    return res;
  }
  const res = { ...doc };
  for (const [k, v] of entries) {
    if (!v) delete res[k];
  }
  return res;
}

class Cursor {
  #docs;
  #limit = 0;
  #sortSpec = null;
  #projection = null;

  constructor(docs, options = {}) {
    this.#docs = docs;
    if (options.limit) this.#limit = options.limit;
    if (options.sort) this.#sortSpec = options.sort;
    if (options.projection) this.#projection = options.projection;
  }

  limit(n) {
    this.#limit = n;
    return this;
  }

  sort(spec) {
    this.#sortSpec = spec;
    return this;
  }

  async toArray() {
    let result = [...this.#docs];
    if (this.#sortSpec && typeof this.#sortSpec === 'object') {
      const entries = Object.entries(this.#sortSpec);
      result.sort((a, b) => {
        for (const [field, dir] of entries) {
          const av = a[field];
          const bv = b[field];
          if (av === bv) continue;
          if (av === undefined) return 1;
          if (bv === undefined) return -1;
          return (av < bv ? -1 : 1) * dir;
        }
        return 0;
      });
    }
    if (this.#limit > 0) {
      result = result.slice(0, this.#limit);
    }
    if (this.#projection) {
      result = result.map((d) => projectDoc(cloneDoc(d), this.#projection));
    } else {
      result = result.map((d) => cloneDoc(d));
    }
    return result;
  }
}

function createDuplicateKeyError() {
  const err = new Error('E11000 duplicate key error');
  err.name = 'MongoError';
  err.code = 11000;
  return err;
}

function createCollection(name) {
  const store = getStore(name);

  return {
    async createIndexes() {
      return [];
    },
    find(query = {}, options = {}) {
      const matched = store.filter((doc) => matchDoc(doc, query));
      return new Cursor(matched, options);
    },
    async findOne(query = {}, options = {}) {
      const doc = store.find((d) => matchDoc(d, query)) || null;
      if (!doc) return null;
      const cloned = cloneDoc(doc);
      return options.projection ? projectDoc(cloned, options.projection) : cloned;
    },
    async insertOne(doc) {
      const item = wrapBson(cloneDoc(doc));
      if (item._id !== undefined && store.some((d) => d._id === item._id)) {
        throw createDuplicateKeyError();
      }
      store.push(item);
      persistDb();
      return { insertedCount: 1, insertedId: item._id };
    },
    async updateOne(filter, update, options = {}) {
      const idx = store.findIndex((d) => matchDoc(d, filter));
      if (idx === -1) {
        if (options.upsert) {
          const newDoc = {};
          if (filter._id !== undefined && typeof filter._id !== 'object') {
            newDoc._id = filter._id;
          }
          if (newDoc._id !== undefined && store.some((d) => d._id === newDoc._id)) {
            throw createDuplicateKeyError();
          }
          applyUpdate(newDoc, update, filter, true);
          store.push(newDoc);
          persistDb();
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      }

      const target = store[idx];
      if (name === 'wallets' && update.$set?.username_sha) {
        const clash = store.find((d, i) => i !== idx && d.username_sha === update.$set.username_sha);
        if (clash) {
          throw createDuplicateKeyError();
        }
      }

      applyUpdate(target, update, filter, false);
      persistDb();
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    },
    async findOneAndUpdate(filter, update, options = {}) {
      const idx = store.findIndex((d) => matchDoc(d, filter));
      if (idx === -1) {
        return { value: null };
      }
      const before = cloneDoc(store[idx]);
      applyUpdate(store[idx], update, filter, false);
      persistDb();
      return { value: options.returnDocument === 'after' ? cloneDoc(store[idx]) : before };
    },
    async deleteOne(filter) {
      const idx = store.findIndex((d) => matchDoc(d, filter));
      if (idx === -1) return { deletedCount: 0 };
      store.splice(idx, 1);
      persistDb();
      return { deletedCount: 1 };
    },
    async removeOne(filter) {
      return this.deleteOne(filter);
    },
    async deleteMany(filter = {}) {
      const before = store.length;
      const kept = store.filter((d) => !matchDoc(d, filter));
      store.length = 0;
      store.push(...kept);
      persistDb();
      return { deletedCount: before - kept.length };
    },
    async bulkWrite(ops = []) {
      for (const op of ops) {
        if (op.updateOne) {
          await this.updateOne(op.updateOne.filter, op.updateOne.update, {
            upsert: op.updateOne.upsert,
          });
        }
      }
      persistDb();
      return { ok: 1 };
    },
    aggregate() {
      return {
        toArray: async () => [],
      };
    },
  };
}

const db = {
  collection(name) {
    return createCollection(name);
  },
};

export function dbMemoize(target, { key, ttl }) {
  if (!key) throw new TypeError('"key" is required');
  if (!ttl) throw new TypeError('"ttl" is required');
  let promise;
  return new Proxy(target, {
    apply(targetFn, thisArg, argumentsList) {
      if (!promise) {
        promise = (async () => {
          try {
            const cacheCol = db.collection('cache');
            const cached = await cacheCol.findOne({ _id: `cache-${key}` });
            if (cached && cached.expire > new Date()) {
              return JSON.parse(cached.value);
            }
            const result = await Reflect.apply(targetFn, thisArg, argumentsList);
            await cacheCol.updateOne(
              { _id: `cache-${key}` },
              {
                $set: {
                  value: JSON.stringify(result),
                  expire: new Date(Date.now() + ttl * 1000),
                },
              },
              { upsert: true }
            );
            return result;
          } finally {
            promise = undefined;
          }
        })();
      }
      return promise;
    },
  });
}

export default db;
