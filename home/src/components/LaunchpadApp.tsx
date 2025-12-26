import { useEffect, useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { Header } from './Header';
import { TokenCreationForm } from './TokenCreationForm';
import { TokenGrid } from './TokenGrid';
import { HoldingsPanel } from './HoldingsPanel';
import { DECIMALS_MULTIPLIER, FACTORY_ABI, FACTORY_ADDRESS, TOKENS_PER_ETH } from '../config/contracts';
import '../styles/Launchpad.css';

export interface TokenRecord {
  token: `0x${string}`;
  name: string;
  symbol: string;
  maxSupply: bigint;
  mintedSupply: bigint;
  creator: `0x${string}`;
}

export function LaunchpadApp() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [factoryAddress, setFactoryAddress] = useState<`0x${string}`>(FACTORY_ADDRESS as `0x${string}`);
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const factoryReady = useMemo(
    () => isAddress(factoryAddress) && factoryAddress !== '0x0000000000000000000000000000000000000000',
    [factoryAddress],
  );

  const tokensPerEth = useMemo(() => TOKENS_PER_ETH / DECIMALS_MULTIPLIER, []);

  const fetchTokens = async () => {
    if (!publicClient || !factoryReady) {
      return;
    }

    setIsLoadingTokens(true);
    try {
      const result = await publicClient.readContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'getAllTokens',
      });
      setTokens((result as TokenRecord[]) ?? []);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load tokens', err);
      setLoadError('Unable to load tokens from the factory');
    } finally {
      setIsLoadingTokens(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [publicClient, factoryReady, factoryAddress]);

  const creatorTokens = useMemo(() => {
    if (!address) return [];
    return tokens.filter(t => t.creator.toLowerCase() === address.toLowerCase());
  }, [tokens, address]);

  return (
    <div className="launchpad-shell">
      <Header />

      <section className="hero">
        <div>
          <p className="eyebrow">Encrypted launch studio</p>
          <h1 className="hero-title">Spin up ERC7984 tokens and sell privately</h1>
          <p className="hero-subtitle">
            Generate confidential tokens, list them instantly at a fixed rate, and let buyers decrypt their balances
            without exposing amounts on-chain.
          </p>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-label">Price curve</span>
              <span className="stat-value">1 ETH = {tokensPerEth.toLocaleString()} tokens</span>
            </div>
            <div className="stat">
              <span className="stat-label">Decimals</span>
              <span className="stat-value">6</span>
            </div>
          </div>
        </div>
        <div className="factory-box">
          <p className="factory-label">Factory address</p>
          <input
            value={factoryAddress}
            onChange={(e) => setFactoryAddress(e.target.value as `0x${string}`)}
            className="factory-input"
            placeholder="0x..."
          />
          {!factoryReady && (
            <p className="factory-warning">
              Set your deployed ConfidentialTokenFactory address to start creating and trading tokens.
            </p>
          )}
        </div>
      </section>

      <section className="panels">
        <TokenCreationForm
          disabled={!factoryReady}
          factoryAddress={factoryAddress}
          onCreated={fetchTokens}
          tokensPerEth={tokensPerEth}
        />
        <HoldingsPanel
          address={address}
          factoryAddress={factoryAddress}
          tokens={tokens}
          onRefresh={fetchTokens}
          disabled={!factoryReady}
        />
      </section>

      <section className="grid-section">
        <TokenGrid
          title="Your launched tokens"
          factoryAddress={factoryAddress}
          tokens={creatorTokens}
          isLoading={isLoadingTokens}
          onRefresh={fetchTokens}
          disabled={!factoryReady}
        />
        <TokenGrid
          title="Marketplace"
          factoryAddress={factoryAddress}
          tokens={tokens}
          isLoading={isLoadingTokens}
          onRefresh={fetchTokens}
          disabled={!factoryReady}
        />
        {loadError && <div className="error-box">{loadError}</div>}
      </section>
    </div>
  );
}
