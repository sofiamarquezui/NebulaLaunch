import { useState } from 'react';
import { Contract } from 'ethers';

import { FACTORY_ABI, DEFAULT_SUPPLY } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';

type Props = {
  disabled?: boolean;
  factoryAddress: `0x${string}`;
  onCreated?: () => void | Promise<void>;
  tokensPerEth: bigint;
};

export function TokenCreationForm({ disabled, factoryAddress, onCreated, tokensPerEth }: Props) {
  const signer = useEthersSigner();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('10000000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const createToken = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);

    if (!signer) {
      setStatus('Connect your wallet to deploy a token.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedSymbol = symbol.trim();
    const parsedSupply = supply.trim() ? BigInt(supply.trim()) : DEFAULT_SUPPLY;

    if (!trimmedName || !trimmedSymbol) {
      setStatus('Token name and symbol are required.');
      return;
    }

    if (parsedSupply <= 0) {
      setStatus('Supply must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const writer = new Contract(factoryAddress, FACTORY_ABI, await signer);
      const tx = await writer.createToken(trimmedName, trimmedSymbol, parsedSupply);
      await tx.wait();

      setStatus('Token created successfully.');
      setName('');
      setSymbol('');
      setSupply('10000000');
      await onCreated?.();
    } catch (error) {
      console.error('Failed to create token', error);
      setStatus('Failed to create token. Verify your factory address and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <p className="card-title">Create a confidential token</p>
      <p className="card-subtitle">
        Deploy a capped ERC7984 token. Balances stay encrypted while holders can decrypt on demand.
      </p>
      <form className="form" onSubmit={createToken}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            placeholder="Nebula Credit"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled || isSubmitting}
          />
        </label>
        <label className="field inline">
          <div>
            <span>Symbol</span>
            <input
              type="text"
              placeholder="NEB"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={disabled || isSubmitting}
            />
          </div>
          <div>
            <span>Supply (whole tokens)</span>
            <input
              type="number"
              min="1"
              value={supply}
              onChange={(e) => setSupply(e.target.value)}
              disabled={disabled || isSubmitting}
            />
          </div>
        </label>
        <p className="helper">
          Default supply is 10,000,000 tokens (6 decimals). Price is fixed at 1 ETH for {tokensPerEth.toLocaleString()}{' '}
          tokens.
        </p>
        <button type="submit" className="primary" disabled={disabled || isSubmitting}>
          {isSubmitting ? 'Deploying...' : 'Launch token'}
        </button>
        {status && <p className="status-text">{status}</p>}
      </form>
    </div>
  );
}
