import { useMemo, useState } from 'react';
import { Contract, ethers } from 'ethers';
import { usePublicClient } from 'wagmi';

import { DECIMALS_MULTIPLIER, FACTORY_ABI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import type { TokenRecord } from './LaunchpadApp';

type Props = {
  title: string;
  tokens: TokenRecord[];
  factoryAddress: `0x${string}`;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  disabled?: boolean;
};

type DraftState = Record<string, string>;
type PendingState = Record<string, boolean>;
type MessageState = Record<string, string | null>;

export function TokenGrid({ title, tokens, factoryAddress, isLoading, onRefresh, disabled }: Props) {
  const signer = useEthersSigner();
  const publicClient = usePublicClient();

  const [drafts, setDrafts] = useState<DraftState>({});
  const [pending, setPending] = useState<PendingState>({});
  const [messages, setMessages] = useState<MessageState>({});

  const hasTokens = useMemo(() => tokens.length > 0, [tokens.length]);

  const formatHuman = (value: bigint) => {
    return (Number(value) / Number(DECIMALS_MULTIPLIER)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const updateMessage = (token: string, message: string | null) => {
    setMessages(prev => ({ ...prev, [token]: message }));
  };

  const handleBuy = async (token: TokenRecord) => {
    const ethInput = drafts[token.token] ?? '0.1';
    const value = ethers.parseEther(ethInput || '0');

    updateMessage(token.token, null);

    if (!signer) {
      updateMessage(token.token, 'Connect your wallet to buy.');
      return;
    }

    if (!publicClient) {
      updateMessage(token.token, 'RPC client unavailable.');
      return;
    }

    if (value <= 0n) {
      updateMessage(token.token, 'Enter an ETH amount above zero.');
      return;
    }

    setPending(prev => ({ ...prev, [token.token]: true }));
    try {
      const quoted = await publicClient.readContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'quoteFromEth',
        args: [token.token, value],
      });

      if ((quoted as bigint) === 0n) {
        updateMessage(token.token, 'Quote returned zero tokens. Try a larger amount.');
        return;
      }

      const remaining = await publicClient.readContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'remainingSupply',
        args: [token.token],
      });

      if ((quoted as bigint) > (remaining as bigint)) {
        updateMessage(token.token, 'Not enough supply left for that purchase.');
        return;
      }

      const writer = new Contract(factoryAddress, FACTORY_ABI, await signer);
      const tx = await writer.buyTokens(token.token, { value });
      await tx.wait();
      updateMessage(token.token, 'Purchase confirmed on-chain.');
      await onRefresh?.();
    } catch (error) {
      console.error('Failed to buy token', error);
      updateMessage(token.token, 'Purchase failed. Confirm the factory address and try again.');
    } finally {
      setPending(prev => ({ ...prev, [token.token]: false }));
    }
  };

  return (
    <div className="grid-block">
      <div className="grid-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3 className="section-title">Available tokens</h3>
        </div>
        <button className="ghost" onClick={() => onRefresh?.()} disabled={disabled || isLoading}>
          Refresh
        </button>
      </div>

      {!hasTokens && (
        <div className="empty">
          <p>{isLoading ? 'Loading tokens...' : 'No tokens found yet. Launch one to get started.'}</p>
        </div>
      )}

      <div className="token-grid">
        {tokens.map((token) => {
          const minted = token.mintedSupply;
          const remaining = token.maxSupply - minted;

          return (
            <div key={token.token} className="token-card">
              <div className="token-header">
                <div>
                  <p className="token-name">{token.name}</p>
                  <p className="token-symbol">{token.symbol}</p>
                </div>
                <span className="pill">Creator: {token.creator.slice(0, 6)}...{token.creator.slice(-4)}</span>
              </div>

              <div className="token-meta">
                <div>
                  <p className="meta-label">Minted</p>
                  <p className="meta-value">{formatHuman(minted)} / {formatHuman(token.maxSupply)}</p>
                </div>
                <div>
                  <p className="meta-label">Remaining</p>
                  <p className="meta-value">{formatHuman(remaining)}</p>
                </div>
              </div>

              <div className="purchase-box">
                <label className="field">
                  <span>Spend (ETH)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={drafts[token.token] ?? '0.1'}
                    onChange={(e) => setDrafts(prev => ({ ...prev, [token.token]: e.target.value }))}
                    disabled={disabled || pending[token.token]}
                  />
                </label>
                <button
                  className="primary full"
                  onClick={() => handleBuy(token)}
                  disabled={disabled || pending[token.token]}
                >
                  {pending[token.token] ? 'Buying...' : 'Buy & mint'}
                </button>
              </div>
              {messages[token.token] && <p className="status-text">{messages[token.token]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
