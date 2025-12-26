import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Nebula Launch',
  projectId: 'c501d55ad9924cf5905ae1954ec6f7f3',
  chains: [sepolia],
  ssr: false,
});
