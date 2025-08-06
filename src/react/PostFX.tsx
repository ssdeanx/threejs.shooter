import React, { Suspense } from 'react';

export type PostFXProps = {
  enabled: boolean;
};

/**
 * PostFX
 * Toggleable minimal post-processing chain. Default-off usage in App.
 * - When disabled: returns null without importing heavy modules.
 * - When enabled: dynamically imports @react-three/postprocessing and renders FXAA inside EffectComposer.
 * - No per-frame allocations beyond library internals.
 */
export default function PostFX(props: PostFXProps): React.ReactElement | null {
  if (!props.enabled) {
    return null;
  }

  // Lazy-load heavy postprocessing modules only when enabled
  const EffectComposer = React.lazy(async () => {
    const mod = await import('@react-three/postprocessing');
    return { default: mod.EffectComposer };
  });

  const FXAA = React.lazy(async () => {
    const mod = await import('@react-three/postprocessing');
    return { default: mod.FXAA };
  });

  // Suspense boundary to handle dynamic import resolution
  return (
    <Suspense fallback={null}>
      <EffectComposer multisampling={0}>
        <FXAA />
      </EffectComposer>
    </Suspense>
  );
}