<script>
import { measureText } from '../lib/helpers.js';

import CsButton from '../components/CsButton.vue';
import CsButtonGroup from '../components/CsButtonGroup.vue';
import CsCryptoList from '../components/CsCryptoList.vue';

import BrowserIcon from '../assets/svg/browser.svg';
import HomeIcon from '../assets/svg/home.svg';
import PlusIcon from '../assets/svg/plus.svg';
import SettingsIcon from '../assets/svg/settings.svg';

const CHANGE_PERIODS = ['1D', '7D', '14D', '1M', '1Y'];

export default {
  components: {
    BrowserIcon,
    CsButton,
    CsButtonGroup,
    CsCryptoList,
    HomeIcon,
    PlusIcon,
    SettingsIcon,
  },
  props: {
    active: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      changePeriodIndex: 0,
    };
  },
  computed: {
    portfolioData() {
      let totalBalance = 0;
      const changeAccumulator = CHANGE_PERIODS.reduce((result, key) => { result[key] = 0; return result; }, {});
      for (const item of this.$cryptos) {
        if (!item.market?.price || !item.balanceFiat) continue;
        const balance = item.balanceFiat;
        totalBalance += balance;
        const change = item.market.change || {};
        for (const period of CHANGE_PERIODS) {
          const percent = (change[period] || 0) / 100;
          changeAccumulator[period] += balance * percent;
        }
      }
      if (totalBalance > 0) {
        for (const period of CHANGE_PERIODS) {
          changeAccumulator[period] /= totalBalance;
        }
      }
      return {
        balance: totalBalance,
        changePercent: changeAccumulator,
      };
    },
    portfolioBalanceSize() {
      if (this.$isHiddenBalance) return 'normal';
      const str = this.$fiat(this.portfolioData.balance);
      const { width } = measureText(str);
      if (width < 120) return 'normal';
      if (width < 200) return 'large';
      return '';
    },
    changePeriod() {
      return CHANGE_PERIODS[this.changePeriodIndex];
    },
    changePeriodLabel() {
      switch (this.changePeriod) {
        case '1D':
          return this.$t('1 day');
        case '7D':
          return this.$t('7 days');
        case '14D':
          return this.$t('14 days');
        case '1M':
          return this.$t('1 month');
        case '1Y':
          return this.$t('1 year');
      }
    },
  },
  methods: {
    nextChangePeriod() {
      if (this.$isHiddenBalance) return this.$account.toggleHiddenBalance();
      this.changePeriodIndex = (this.changePeriodIndex + 1) % CHANGE_PERIODS.length;
    },
  },
};
</script>

<template>
  <div
    class="&"
    :class="{ '&--active': active }"
  >
    <div class="&__navbar">
      <div
        dir="ltr"
        class="&__portfolio-amount"
        :class="`&__portfolio-amount--${portfolioBalanceSize}`"
        @click="$account.toggleHiddenBalance()"
      >
        {{ $isHiddenBalance ? '*****' : $fiat(portfolioData.balance) }}
      </div>
      <div class="&__portfolio-label">
        {{ $t('Portfolio value') }}
      </div>
      <div
        class="&__portfolio-change"
        :class="{
          '&__portfolio-change--positive': !$isHiddenBalance && portfolioData.changePercent[changePeriod] > 0,
          '&__portfolio-change--negative': !$isHiddenBalance && portfolioData.changePercent[changePeriod] < 0,
        }"
        @click="nextChangePeriod"
      >
        <template v-if="!$isHiddenBalance">
          {{ $n(portfolioData.changePercent[changePeriod], 'percent') }} ({{ changePeriodLabel }})
        </template>
        <template v-else>
          *****
        </template>
      </div>
    </div>
    <div class="&__content">
      <CsCryptoList
        class="&__content-list"
        :header="$t('Wallet')"
        :items="$cryptos"
        :selected="$route.params.cryptoId"
        :changePeriod="changePeriod"
        @select="(id) => $router.push({ name: 'crypto', params: { cryptoId: id }})"
      />
      <div class="&__add-crypto">
        <CsButton
          type="primary-link"
          @click="$router.push({ name: 'crypto.add', force: true })"
        >
          <PlusIcon />
          {{ $t('Add crypto') }}
        </CsButton>
      </div>
    </div>

    <CsButtonGroup
      class="&__nav-actions"
      type="circle"
    >
      <CsButton
        class="&__nav-btn"
        :class="{ '&__nav-btn--active': $route.name === 'home' }"
        type="circle"
        title="Home"
        aria-label="Home"
        @click="$router.push({ name: 'home' })"
      >
        <template #circle>
          <HomeIcon />
        </template>
        Home
      </CsButton>
      <CsButton
        class="&__nav-btn"
        :class="{ '&__nav-btn--active': $route.name === 'browser' }"
        type="circle"
        title="Browser"
        aria-label="Browser"
        @click="$router.push({ name: 'browser' })"
      >
        <template #circle>
          <BrowserIcon />
        </template>
        Browser
      </CsButton>
      <CsButton
        class="&__nav-btn"
        :class="{ '&__nav-btn--active': $route.path.startsWith('/settings') }"
        type="circle"
        :title="$t('Settings')"
        :aria-label="$t('Settings')"
        @click="$router.push({ name: 'settings' })"
      >
        <template #circle>
          <SettingsIcon />
        </template>
        {{ $t('Settings') }}
      </CsButton>
    </CsButtonGroup>
  </div>
</template>

<style lang="scss">
  .#{ $filename } {
    display: none;
    width: 100%;
    height: 100%;
    flex-direction: column;
    background-color: var(--color-background);
    overflow-y: auto;

    @include breakpoint(lg) {
      display: flex;
      width: 22.5rem;
      flex-shrink: 0;
      border-radius: 0.625rem;
    }

    &--active {
      display: flex;
    }

    &__navbar {
      padding:
        var(--spacing-3xl)
        var(--spacing-xl)
        var(--spacing-xl)
        var(--spacing-xl);
    }

    &__nav-actions {
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      align-items: center;
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--color-background);
      border-top: 1px solid var(--color-divider);
      position: sticky;
      bottom: 0;
      z-index: 10;
      margin-top: auto;
    }

    &__nav-btn {
      flex: 1;
      max-width: 5rem;

      &--active {
        color: var(--color-primary);

        .cs-button__circle {
          background-color: var(--color-primary-light);
        }

        svg [stroke] {
          stroke: var(--color-primary);
        }

        svg [fill] {
          fill: var(--color-primary);
        }
      }
    }

    &__portfolio-amount {
      @include ellipsis;
      margin-bottom: var(--spacing-2xs);
      cursor: pointer;
      text-align: center;
      &--large { @include text-lg; }
      &--normal { @include text-3xl; }
    }

    &__portfolio-label {
      @include text-sm;
      margin-bottom: var(--spacing-2xs);
      color: var(--color-secondary);
      text-align: center;
    }

    &__portfolio-change {
      @include text-sm;
      cursor: pointer;
      overflow-wrap: break-word;
      text-align: center;

      &--positive {
        color: var(--color-primary);
      }

      &--negative {
        color: var(--color-danger);
      }
    }

    &__content {
      display: flex;
      flex: 1 1 100%;
      flex-direction: column;
      padding:
        var(--spacing-xl)
        var(--spacing-xl)
        max(var(--spacing-3xl), env(safe-area-inset-bottom))
        var(--spacing-xl);
      gap: var(--spacing-2xs);
      @include breakpoint(lg) {
        overflow-y: auto;
        scrollbar-width: thin;
      }
    }

    &__content-list {
      flex-grow: 1;
    }

    &__add-crypto {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      justify-content: flex-end;
    }
  }
</style>
