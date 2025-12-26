import { useEffect, useMemo, useState } from 'react';
import { ZeroHash } from 'ethers';
import { usePublicClient } from 'wagmi';

import { TOKEN_ABI, DECIMALS_MULTIPLIER } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import type { TokenRecord } from './LaunchpadApp';

type Props = {
  address?: `0x${string}`;
  tokens: TokenRecord[];
  factoryAddress: `0x${string}`;
  onRefresh?: () => void | Promise<void>;
  disabled?: boolean;
};

type BalanceState = Record<string, string>;
type ClearState = Record<string, bigint>;
type LoadingState = Record<string, boolean>;

export function HoldingsPanel({ address, tokens, factoryAddress, onRefresh, disabled }: Props) {
  const publicClient = usePublicClient();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [balances, setBalances] = useState<BalanceState>({});
  const [decrypted, setDecrypted] = useState<ClearState>({});
  const [decrypting, setDecrypting] = useState<LoadingState>({});
  const [status, setStatus] = useState<string | null>(null);

  const hasWallet = useMemo(() => !!address, [address]);

  useEffect(() => {
    setBalances({});
    setDecrypted({});
  }, [factoryAddress]);

  useEffect(() => {
    const loadBalances = async () => {
      if (!address || !publicClient || !tokens.length || disabled) {
        setBalances({});
        return;
      }

      try {
        const entries = await Promise.all(
          tokens.map(async (token) => {
            const balance = await publicClient.readContract({
              address: token.token,
              abi: TOKEN_ABI,
              functionName: 'confidentialBalanceOf',
              args: [address],
            });
            return [token.token, balance as string];
          }),
        );
        setBalances(Object.fromEntries(entries));
      } catch (error) {
        console.error('Unable to load balances', error);
        setStatus('Unable to fetch balances.');
      }
    };

    loadBalances();
  }, [address, publicClient, tokens, disabled]);

  const formatHuman = (value: bigint) => {
    return (Number(value) / Number(DECIMALS_MULTIPLIER)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };

  const decryptBalance = async (token: TokenRecord) => {
    const encrypted = balances[token.token];
    if (!encrypted || encrypted === ZeroHash) {
      setDecrypted(prev => ({ ...prev, [token.token]: 0n }));
      return;
    }

    if (!instance || !signer || !address) {
      setStatus('Connect wallet and wait for the Zama SDK to initialize.');
      return;
    }

    setDecrypting(prev => ({ ...prev, [token.token]: true }));
    setStatus(null);

    try {
      const keypair = instance.generateKeypair();
      const contractAddresses = [token.token];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const resolvedSigner = await signer;
      const signature = await resolvedSigner?.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      if (!signature) {
        setStatus('Unable to sign decryption request.');
        return;
      }

      const result = await instance.userDecrypt(
        [{ handle: encrypted, contractAddress: token.token }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const value = result[encrypted] ?? 0;
      setDecrypted(prev => ({ ...prev, [token.token]: BigInt(value) }));
    } catch (error) {
      console.error('Failed to decrypt balance', error);
      setStatus('Decryption failed. Try again or re-connect.');
    } finally {
      setDecrypting(prev => ({ ...prev, [token.token]: false }));
    }
  };

  return (
    <div className="card holdings">
      <div className="card-header">
        <p className="card-title">Your encrypted balances</p>
        <button className="ghost" onClick={() => onRefresh?.()} disabled={disabled}>
          Refresh
        </button>
      </div>
      <p className="card-subtitle">
        View balances across every ERC7984 token. Decrypt on demand with Zama’s relayer so only you see the numbers.
      </p>
      {!hasWallet && <p className="helper">Connect a wallet to fetch balances.</p>}
      {zamaLoading && <p className="helper">Loading encryption runtime...</p>}
      {zamaError && <p className="status-text">{zamaError}</p>}
      {status && <p className="status-text">{status}</p>}

      <div className="holdings-list">
        {tokens.map((token) => {
          const encrypted = balances[token.token];
          const clear = decrypted[token.token];

          return (
            <div key={token.token} className="holding-row">
              <div>
                <p className="token-name">{token.name}</p>
                <p className="token-symbol">{token.symbol}</p>
              </div>
              <div className="holding-actions">
                <div className="encrypted-pill">
                  <span className="pill-label">Encrypted</span>
                  <span className="pill-value">{encrypted ? `${encrypted.slice(0, 10)}...` : '—'}</span>
                </div>
                <button
                  className="ghost"
                  onClick={() => decryptBalance(token)}
                  disabled={disabled || decrypting[token.token] || zamaLoading}
                >
                  {decrypting[token.token] ? 'Decrypting...' : 'Decrypt'}
                </button>
                {clear !== undefined && (
                  <span className="pill success">{formatHuman(clear)} tokens</span>
                )}
              </div>
            </div>
          );
        })}
        {tokens.length === 0 && <p className="helper">No tokens deployed yet.</p>}
      </div>
    </div>
  );
}
