import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');

  if (normalized.includes('/node_modules/')) {
    if (
      normalized.includes('/react/') ||
      normalized.includes('/react-dom/') ||
      normalized.includes('/react-router-dom/')
    ) {
      return 'react-vendor';
    }
    if (normalized.includes('/@radix-ui/')) {
      return 'radix-ui';
    }
    if (normalized.includes('/lucide-react/')) {
      return 'lucide';
    }
    return undefined;
  }

  if (normalized.includes('/apps/web/src/features/assurance/')) {
    return 'assurance-workbench';
  }
  if (
    normalized.includes('/apps/web/src/features/evidence/') ||
    normalized.includes('/apps/web/src/features/conmon/')
  ) {
    return 'evidence-operations';
  }
  if (normalized.includes('/apps/web/src/features/advanced-risk/')) {
    return 'advanced-risk';
  }
  if (normalized.includes('/apps/web/src/features/modules/')) {
    return 'scale-modules';
  }
  if (
    normalized.includes('/apps/web/src/features/grc/') ||
    normalized.includes('/apps/web/src/features/fedramp/')
  ) {
    return 'grc-governance';
  }
  if (
    normalized.includes('/apps/web/src/features/builders/') ||
    normalized.includes('/apps/web/src/features/ai/')
  ) {
    return 'builders-ai';
  }
  if (
    normalized.includes('/apps/web/src/features/ops/') ||
    normalized.includes('/apps/web/src/features/parity/')
  ) {
    return 'ops-surfaces';
  }
  if (
    normalized.includes('/apps/web/src/features/assessments/') ||
    normalized.includes('/apps/web/src/features/risk/') ||
    normalized.includes('/apps/web/src/features/tprm/') ||
    normalized.includes('/apps/web/src/features/privacy/') ||
    normalized.includes('/apps/web/src/features/resilience/') ||
    normalized.includes('/apps/web/src/features/reports/')
  ) {
    return 'program-operations';
  }
  if (
    normalized.includes('/apps/web/src/features/integrations/') ||
    normalized.includes('/apps/web/src/features/imports/') ||
    normalized.includes('/apps/web/src/features/portal/') ||
    normalized.includes('/apps/web/src/features/chat/')
  ) {
    return 'workspace-utilities';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
