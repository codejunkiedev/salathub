import { useEffect, useState } from 'react';
import { LoadingStep } from '@/constants/loading';

// Carried across mounts so each new loading screen continues from where the
// last one (or the static splash) left off instead of restarting at zero.
let lastProgress: number = LoadingStep.Bundle;

type LoadingProps = {
  /** 0–1: how much of the loading has actually finished. */
  progress?: number;
  /** What is being waited on right now. */
  label?: string;
};

export default function Loading({
  progress = LoadingStep.Page,
  label = 'Opening page',
}: LoadingProps) {
  const [width, setWidth] = useState(lastProgress);

  useEffect(() => {
    lastProgress = progress;
    const frame = requestAnimationFrame(() => setWidth(progress));
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  // Styled by the .splash rules in index.html, shared with the static splash.
  return (
    <div className='splash'>
      <div className='splash-inner'>
        <div className='splash-brand'>
          <div className='splash-logo'>
            <img src='/icons/icon-192.png' alt='' />
          </div>
          <div className='splash-title'>SalatHub</div>
        </div>
        <div className='splash-progress'>
          <div
            role='progressbar'
            aria-label='Loading'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(width * 100)}
            className='splash-track'
          >
            <div className='splash-fill' style={{ width: `${width * 100}%` }} />
          </div>
          <p className='splash-step' role='status'>
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
