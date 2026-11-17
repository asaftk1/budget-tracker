import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog, DialogContent, DialogTitle } from './dialog';

describe('DialogContent', () => {
  test('the close button has a Hebrew accessible name', async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        <Dialog open>
          <DialogContent><DialogTitle>t</DialogTitle></DialogContent>
        </Dialog>
      );
    });
    const close = document.body.querySelector('button[aria-label="סגור"]');
    expect(close).not.toBeNull();
  });
});
