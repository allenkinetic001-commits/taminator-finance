<script>
import CsButton from '../components/CsButton.vue';
import CsFormInput from '../components/CsForm/CsFormInput.vue';
import CsListItem from '../components/CsListItem.vue';
import CsListItems from '../components/CsListItems.vue';
import CsNavbar from '../components/CsNavbar.vue';
import CsNavbarButton from '../components/CsNavbarButton.vue';
import MainLayout from '../layouts/MainLayout.vue';

import ArrowLeftIcon from '../assets/svg/arrowLeft.svg';
import ChevronRightIcon from '../assets/svg/chevronRight.svg';
import HomeIcon from '../assets/svg/home.svg';
import RefreshIcon from '../assets/svg/refresh.svg';
import SearchIcon from '../assets/svg/search.svg';

const BOOKMARKS = [
  {
    name: 'Google',
    description: 'Search the web',
    url: 'https://www.google.com/',
  },
  {
    name: 'DuckDuckGo',
    description: 'Privacy web search',
    url: 'https://html.duckduckgo.com/html/',
  },
  {
    name: 'CoinMarketCap',
    description: 'Crypto prices & market caps',
    url: 'https://coinmarketcap.com/',
  },
  {
    name: 'CoinGecko',
    description: 'Cryptocurrency prices & charts',
    url: 'https://www.coingecko.com/',
  },
  {
    name: 'Uniswap',
    description: 'Decentralized token swap',
    url: 'https://app.uniswap.org/',
  },
  {
    name: 'Aave',
    description: 'Decentralized lending & borrowing',
    url: 'https://app.aave.com/',
  },
  {
    name: '1inch',
    description: 'DeFi swap aggregator',
    url: 'https://app.1inch.io/',
  },
  {
    name: 'Etherscan',
    description: 'Ethereum blockchain explorer',
    url: 'https://etherscan.io/',
  },
];

export default {
  components: {
    ArrowLeftIcon,
    ChevronRightIcon,
    CsButton,
    CsFormInput,
    CsListItem,
    CsListItems,
    CsNavbar,
    CsNavbarButton,
    HomeIcon,
    MainLayout,
    RefreshIcon,
    SearchIcon,
  },
  data() {
    return {
      address: '',
      activeUrl: '',
      historyStack: [],
      historyIndex: -1,
      reloadNonce: 0,
      isLoading: false,
      bookmarks: BOOKMARKS,
    };
  },
  computed: {
    iframeSrc() {
      if (!this.activeUrl) return '';
      return `/api/browser/proxy?url=${encodeURIComponent(this.activeUrl)}&_r=${this.reloadNonce}`;
    },
    canGoBack() {
      return this.historyIndex > 0;
    },
    canGoForward() {
      return this.historyIndex >= 0 && this.historyIndex < this.historyStack.length - 1;
    },
  },
  mounted() {
    window.addEventListener('message', this.handleFrameMessage);
  },
  beforeUnmount() {
    window.removeEventListener('message', this.handleFrameMessage);
  },
  methods: {
    resolveTarget(input) {
      const trimmed = (input || '').trim();
      if (!trimmed) return '';
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
      if (/^[^\s]+\.[^\s]{2,}([/:?#].*)?$/i.test(trimmed)) {
        return `https://${trimmed}`;
      }
      return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
    },
    loadUrl(target, pushHistory = true) {
      if (!target) {
        this.activeUrl = '';
        return;
      }
      if (pushHistory) {
        const nextStack = this.historyStack.slice(0, this.historyIndex + 1);
        if (nextStack[nextStack.length - 1] !== target) {
          nextStack.push(target);
        }
        this.historyStack = nextStack;
        this.historyIndex = nextStack.length - 1;
      }
      this.address = target;
      this.activeUrl = target;
      this.isLoading = true;
    },
    navigate(input = this.address) {
      const target = this.resolveTarget(input);
      if (!target) {
        this.goHome();
        return;
      }
      this.loadUrl(target, true);
    },
    openBookmark(url) {
      this.loadUrl(url, true);
    },
    goBack() {
      if (!this.canGoBack) return;
      this.historyIndex -= 1;
      this.loadUrl(this.historyStack[this.historyIndex], false);
    },
    goForward() {
      if (!this.canGoForward) return;
      this.historyIndex += 1;
      this.loadUrl(this.historyStack[this.historyIndex], false);
    },
    reload() {
      if (!this.activeUrl) return;
      this.reloadNonce += 1;
      this.isLoading = true;
    },
    goHome() {
      this.activeUrl = '';
      this.address = '';
      this.isLoading = false;
    },
    handleFrameLoad() {
      this.isLoading = false;
    },
    handleFrameMessage(event) {
      const frameWindow = this.$refs.browserFrame?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;
      const payload = event.data;
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'taminator-browser-navigate' && typeof payload.url === 'string') {
        if (/^https?:\/\//i.test(payload.url)) {
          this.loadUrl(payload.url, true);
        }
      } else if (payload.type === 'taminator-browser-loaded' && typeof payload.url === 'string') {
        if (/^https?:\/\//i.test(payload.url)) {
          this.address = payload.url;
          this.isLoading = false;
        }
      }
    },
  },
};
</script>

<template>
  <MainLayout
    wide
    title="Browser"
    @back="$router.push({ name: 'home' })"
  >
    <template #navbar>
      <CsNavbar
        title="Browser"
        @back="$router.push({ name: 'home' })"
      >
        <template #left>
          <CsNavbarButton
            :title="$t('Back')"
            :aria-label="$t('Back')"
            @click="$router.push({ name: 'home' })"
          >
            <ArrowLeftIcon class="rtl-mirror" />
          </CsNavbarButton>
        </template>
      </CsNavbar>
    </template>

    <div class="&">
      <form
        class="&__bar"
        @submit.prevent="navigate()"
      >
        <CsButton
          v-if="activeUrl"
          type="secondary"
          small
          :disabled="!canGoBack"
          title="Previous page"
          aria-label="Previous page"
          @click="goBack"
        >
          <ArrowLeftIcon class="rtl-mirror" />
        </CsButton>
        <CsButton
          v-if="activeUrl"
          type="secondary"
          small
          :disabled="!canGoForward"
          title="Next page"
          aria-label="Next page"
          @click="goForward"
        >
          <ChevronRightIcon class="rtl-mirror" />
        </CsButton>
        <CsButton
          v-if="activeUrl"
          type="secondary"
          small
          title="Reload"
          aria-label="Reload"
          @click="reload"
        >
          <RefreshIcon />
        </CsButton>
        <CsFormInput
          v-model="address"
          class="&__input"
          small
          clear
          :trim="false"
          placeholder="Search or enter website / dApp URL"
          @keydown.enter.prevent="navigate()"
        >
          <template #before>
            <SearchIcon />
          </template>
        </CsFormInput>
        <CsButton
          type="primary"
          small
          @click="navigate()"
        >
          Go
        </CsButton>
        <CsButton
          v-if="activeUrl"
          type="secondary"
          small
          title="Bookmarks"
          aria-label="Bookmarks"
          @click="goHome"
        >
          <HomeIcon />
        </CsButton>
      </form>

      <div
        v-if="activeUrl"
        class="&__frame-section"
      >
        <div class="&__notice">
          <span class="&__notice-text">
            {{ isLoading ? 'Loading page...' : activeUrl }}
          </span>
          <div class="&__notice-actions">
            <a
              class="&__external-link"
              :href="activeUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open tab
            </a>
          </div>
        </div>
        <iframe
          ref="browserFrame"
          :key="iframeSrc"
          :src="iframeSrc"
          class="&__iframe"
          title="Web Browser"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer"
          @load="handleFrameLoad"
        />
      </div>

      <template v-else>
        <CsListItems title="Explore Sites & dApps">
          <CsListItem
            v-for="item in bookmarks"
            :key="item.url"
            :title="item.name"
            :description="item.description"
            @click="openBookmark(item.url)"
          />
        </CsListItems>
      </template>
    </div>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    display: flex;
    height: 100%;
    flex-direction: column;
    gap: var(--spacing-xl);

    &__bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacing-xs);
    }

    &__input {
      min-width: 12rem;
      flex-grow: 1;
    }

    &__frame-section {
      display: flex;
      min-height: 28rem;
      flex: 1 1 auto;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    &__notice {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-xs) var(--spacing-md);
      border-radius: 0.625rem;
      background-color: var(--color-secondary-light);
      gap: var(--spacing-sm);
    }

    &__notice-text {
      @include text-xs;
      overflow: hidden;
      max-width: 34rem;
      color: var(--color-secondary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__notice-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    &__external-link {
      @include text-sm;
      @include text-bold;
      color: var(--color-primary);
      text-decoration: none;
    }

    &__iframe {
      width: 100%;
      min-height: 26rem;
      flex: 1 1 auto;
      border: 1px solid var(--color-divider);
      border-radius: 0.625rem;
      background-color: var(--color-white);
    }
  }
</style>
