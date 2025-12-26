import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <div>
            <p className="brand-title">Nebula Launch</p>
            <p className="brand-subtitle">Confidential ERC7984 studio</p>
          </div>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
