<script>
import CsButton from '../components/CsButton.vue';
import CsFormInput from '../components/CsForm/CsFormInput.vue';
import CsListItem from '../components/CsListItem.vue';
import CsListItems from '../components/CsListItems.vue';
import CsNavbar from '../components/CsNavbar.vue';
import CsNavbarButton from '../components/CsNavbarButton.vue';
import MainLayout from '../layouts/MainLayout.vue';

import ArrowLeftIcon from '../assets/svg/arrowLeft.svg';
import BrowserIcon from '../assets/svg/browser.svg';
import HomeIcon from '../assets/svg/home.svg';
import SearchIcon from '../assets/svg/search.svg';

const BOOKMARKS = [
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
    description: 'Decentralized token swap (connect via WalletConnect)',
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
    BrowserIcon,
    CsButton,
    CsFormInput,
    CsListItem,
    CsListItems,
    CsNavbar,
    CsNavbarButton,
    HomeIcon,
    MainLayout,
    SearchIcon,
  },
  data() {
    return {
      address: '',
      activeUrl: '',
      bookmarks: BOOKMARKS,
    };
  },
  methods: {
    navigate(input = this.address) {
      const trimmed = (input || '').trim();
      if (!trimmed) {
        this.activeUrl = '';
        return;
      }
      let target = trimmed;
      if (/^https?:\/\//i.test(target)) {
        // valid scheme
      } else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(target)) {
        target = `https://${target}`;
      } else {
        target = `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
      }
      this.address = target;
      this.activeUrl = target;
    },
    openBookmark(url) {
      this.address = url;
      this.activeUrl = url;
    },
    goHome() {
      this.activeUrl = '';
      this.address = '';
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
        <template #right>
          <CsNavbarButton
            title="WalletConnect"
            aria-label="WalletConnect"
            @click="$router.push({ name: 'settings.walletconnect' })"
          >
            <BrowserIcon />
          </CsNavbarButton>
        </template>
      </CsNavbar>
    </template>

    <div class="&">
      <form
        class="&__bar"
        @submit.prevent="navigate()"
      >
        <CsFormInput
          v-model="address"
          class="&__input"
          small
          clear
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
            If the site blocks embedded viewing, open it in a new browser tab and pair with WalletConnect.
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
            <CsButton
              type="primary-link"
              small
              @click="$router.push({ name: 'settings.walletconnect' })"
            >
              WalletConnect
            </CsButton>
          </div>
        </div>
        <iframe
          :key="activeUrl"
          :src="activeUrl"
          class="&__iframe"
          title="Web3 Browser"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer"
        />
      </div>

      <template v-else>
        <CsListItems title="Quick Connect">
          <CsListItem
            title="WalletConnect"
            description="Connect to dApps via WalletConnect URI or QR"
            @click="$router.push({ name: 'settings.walletconnect' })"
          />
        </CsListItems>

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
      align-items: center;
      gap: var(--spacing-sm);
    }

    &__input {
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
      color: var(--color-secondary);
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
