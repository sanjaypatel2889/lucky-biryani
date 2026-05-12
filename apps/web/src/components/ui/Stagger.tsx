'use client';

// Stagger reveal — wraps a list of children and assigns each one a
// per-child --stagger-index CSS variable so the .stagger-rise keyframe
// fans them in one-by-one. Index resets after `mountKey` changes so it
// re-plays when filters change.
//
//   <Stagger mountKey={items.length}>
//     {items.map((i) => <Card key={i.id} ... />)}
//   </Stagger>
//
//   <Stagger as="ul" mountKey={favs.length}>
//     {favs.map((f) => <li key={f.id}>…</li>)}
//   </Stagger>

import { Children, cloneElement, createElement, isValidElement, useEffect, useState } from 'react';

type Props = {
  children: React.ReactNode;
  mountKey?: any;
  className?: string;
  as?: 'div' | 'ul' | 'ol' | 'section';
};

export function Stagger({ children, mountKey, className = '', as = 'div' }: Props) {
  const [version, setVersion] = useState(0);
  useEffect(() => { setVersion((v) => v + 1); }, [mountKey]);

  const items = Children.toArray(children).map((child, i) => {
    if (!isValidElement(child)) return child;
    const props: any = {
      style: {
        ...(child.props.style ?? {}),
        ['--stagger-index' as any]: i,
      },
      className: `stagger-rise ${child.props.className ?? ''}`,
    };
    return cloneElement(child, { ...props, key: child.key ?? i });
  });

  return createElement(as, { key: version, className }, items);
}
