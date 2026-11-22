import { SUPPORTED_PLATFORMS } from '../constants.js';
import { deepFreeze } from '../helpers.js';
import femver from '@suchipi/femver';

export default class CryptoDB {
  #request;
  #db;
  #platforms = new Map();
  #new = [];
  #popular = [];

  get all() {
    return this.#db;
  }

  get new() {
    return this.#new;
  }

  get popular() {
    return this.#popular;
  }

  #isSupported(crypto) {
    if (crypto.supported === false) {
      return false;
    } else if (SUPPORTED_PLATFORMS.includes(crypto.platform)) {
      if (typeof crypto.supported === 'string' && femver.isValid(crypto.supported)) {
        return femver.gte(import.meta.env.VITE_VERSION || '6.33.0', crypto.supported);
      }
      return true;
    }
    return false;
  }

  constructor({ request, account }) {
    if (!request) throw new TypeError('request is required');
    if (!account) throw new TypeError('account is required');
    this.#request = (config) => {
      return request({
        seed: 'device',
        ...config,
        baseURL: account.getBaseURL('price'),
      });
    };
  }

  async init() {
    const db = await this.#request({
      url: 'api/v1/cryptos',
      method: 'get',
    });
    if (!Array.isArray(db)) {
      throw new TypeError('Invalid cryptos response');
    }
    this.#db = db;
    for (const item of this.#db) {
      item.supported = this.#isSupported(item);
      if (!item.meta || typeof item.meta !== 'object') {
        item.meta = {};
      }
      deepFreeze(item);
      if (item.type === 'coin') {
        this.#platforms.set(item.platform, item);
      }
      if (item.meta.new) {
        this.#new.push(item);
      }
      if (item.meta.popular) {
        this.#popular.push(item);
      }
    }
    this.#new.sort((a, b) => a.meta.new - b.meta.new);
    this.#popular.sort((a, b) => a.meta.popular - b.meta.popular);
  }

  get(id) {
    return this.#db.find((item) => item._id === id);
  }

  platform(platform) {
    return this.#platforms.get(platform);
  }

  platforms(platforms) {
    const result = [];
    for (const item of this.#platforms.values()) {
      if (platforms.includes(item.platform)) {
        result.push(item);
      }
    }
    return result;
  }

  getTokenByAddress(platform, address) {
    return this.#db
      .find((item) => item.type === 'token' && item.platform === platform && item.address === address);
  }
}
