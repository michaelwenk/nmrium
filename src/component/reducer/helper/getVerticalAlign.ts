import { Draft } from 'immer';

import { State, VerticalAlignment } from '../Reducer';

export function getVerticalAlign(
  state: State | Draft<State>,
  defaultAlign: VerticalAlignment = 'bottom',
) {
  const {
    view: {
      verticalAlign,
      spectra: { activeTab },
    },
  } = state;

  return verticalAlign?.[activeTab] || defaultAlign;
}
