import { render } from '@testing-library/react';

import { App } from '../App';

export function renderAppAtRoute(route: string) {
  window.history.pushState({}, '', route);

  return render(<App />);
}
