<script>
import { base64 } from '@scure/base';

const DEFAULT_PROFILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none">
  <defs>
    <clipPath id="cs-avatar-clip">
      <circle cx="40" cy="40" r="40"/>
    </clipPath>
  </defs>
  <g clip-path="url(#cs-avatar-clip)">
    <circle cx="40" cy="40" r="40" fill="#EBF3FF"/>
    <circle cx="40" cy="30" r="13" fill="#5C6B7A"/>
    <path d="M14 74C14 59.6406 25.6406 48 40 48C54.3594 48 66 59.6406 66 74V82H14V74Z" fill="#5C6B7A"/>
  </g>
</svg>`;

const DEFAULT_PROFILE_SRC = `data:image/svg+xml;base64,${base64.encode(new TextEncoder().encode(DEFAULT_PROFILE_SVG))}`;

export default {
  props: {
    avatar: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      default: 48,
    },
    own: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    src() {
      const [type, hash] = (this.avatar || '').split(':');
      if (type === 'gravatar' && hash) {
        return `https://www.gravatar.com/avatar/${hash}?size=${this.size}&d=mp`;
      }
      return DEFAULT_PROFILE_SRC;
    },
  },
};
</script>

<template>
  <img
    class="&"
    :class="{
      '&--own': own,
      '&--own-tor': own && ($isOnion || env.VITE_DISTRIBUTION === 'tor'),
    }"
    :src="src"
  >
</template>

<style lang="scss">
  .#{ $filename } {
    width: var(--spacing-4xl);
    height: var(--spacing-4xl);
    border-radius: 50%;
    animation: fix-ios 0.2s ease-in; // fix safari bug with initial render

    &--own {
      outline: 2px solid transparent;
      transition: all 0.1s ease-out;
    }

    &--own-tor {
      outline: 2px solid #8a2be2;
      outline-offset: -2px;
    }

    @keyframes fix-ios {
      0% { opacity: 1; }
      100% { opacity: 1; }
    }
  }
</style>
