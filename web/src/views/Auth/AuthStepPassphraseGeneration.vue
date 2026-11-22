<script>
import { wordlist } from '@scure/bip39/wordlists/english';
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';

import AuthStepLayout from '../../layouts/AuthStepLayout.vue';
import CsButton from '../../components/CsButton.vue';
import CsStep from '../../components/CsStep.vue';

export default {
  components: {
    CsButton,
    AuthStepLayout,
  },
  extends: CsStep,
  methods: {
    async generate() {
      const passphrase = generateMnemonic(wordlist, 128);
      const seed = await mnemonicToSeed(passphrase);
      this.updateStorage({ passphrase, seed });
      this.next('passphrase');
    },
  },
};
</script>

<template>
  <AuthStepLayout
    :title="$t('New wallet')"
    faded
  >
    <div class="&__wallet">
      <img
        src="/assets/aistudio/cat-logo-transparent_7f5a03c6.png"
        alt="Taminator Robocat Logo"
        class="&__wallet-icon"
      >
      <img
        src="/assets/aistudio/taminator_transparent_1590ccfa.png"
        alt="Taminator"
        class="&__wallet-wordmark"
      >
    </div>
    <div class="&__container">
      <div class="&__header">
        {{ $t('We are about to generate your very own passphrase') }}
      </div>
      <div class="&__text">
        {{ $t('This allows you to open your wallet on multiple devices and keeps it secure.') }}
      </div>
      <div class="&__text">
        {{ $t('It is very important to write down the passphrase.') }}
      </div>
    </div>
    <CsButton
      class="&__generate"
      type="primary"
      @click="generate"
    >
      {{ $t('Generate passphrase') }}
    </CsButton>
  </AuthStepLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    &__wallet {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-xs);
      @include breakpoint(lg) {
        flex-grow: 0;
        align-items: flex-start;
        justify-content: flex-start;
      }
    }

    &__wallet-icon {
      width: 6.5rem;
      height: auto;
      object-fit: contain;
      @include breakpoint(lg) {
        width: 4.5rem;
      }
    }

    &__wallet-wordmark {
      width: 11rem;
      max-width: 100%;
      height: auto;
      object-fit: contain;
      @include breakpoint(lg) {
        width: 8.5rem;
      }
    }

    &__container {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      @include breakpoint(lg) {
        flex-grow: 1;
      }
    }

    &__header {
      @include text-lg;
      @include text-bold;
    }

    &__text {
      @include text-md;
    }

    &__generate {
      flex-shrink: 0;
    }
  }
</style>
